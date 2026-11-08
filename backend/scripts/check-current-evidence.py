#!/usr/bin/env python3
"""Read-only, private generation-bound live evidence and original-CARB check.

Never send a frozen reference to an advancing server and assume it still exists.
Only a proven concurrent replacement is retryable; approval/arithmetic failures fail.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import shlex
import subprocess
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class GenerationChanged(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError("Evidence verification does not follow redirects.")


def save(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2, allow_nan=False) + "\n").encode()
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as stream:
        stream.write(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ready", type=Path, required=True)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--superseded", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model-fragment", required=True)
    parser.add_argument("--source-root", type=Path)
    args = parser.parse_args()
    ready = json.loads(args.ready.read_bytes())
    # Reload the application's recorded build source, even if the active checkout
    # has since gained additive read fields that are not deployed there yet.
    args.source_root = args.source_root or Path(ready.get("build_workspace", Path(__file__).resolve().parents[2]))
    base = ready["base_url"].rstrip("/")
    url = urlsplit(base)
    if url.scheme != "http" or url.hostname not in ("127.0.0.1", "localhost", "::1") or url.username or url.password:
        raise RuntimeError("This private checker requires a loopback HTTP application.")
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    registry_data = Path(ready["approved_registry_path"]).read_bytes()
    assert hashlib.sha256(registry_data).hexdigest() == ready["registry_sha256"]
    assert ready["selected_context"].endswith("+stop-v1")
    assert ready["selected_stop_observation"]["image_displacement_per_s"] == 0.0225
    registry_path = args.output / "registry.json"
    save(registry_path, registry_data)
    token = next(shlex.split(line.split("=", 1)[1])[0]
                 for line in Path(ready["private_worker_environment_path"]).read_text().splitlines()
                 if line.removeprefix("export ").startswith("EMISSION_LENS_WORKER_TOKEN="))
    opener = build_opener(NoRedirect())

    def get(path, authenticated=False):
        request = Request(base + path, headers={"Authorization": "Bearer " + token} if authenticated else {})
        try:
            with opener.open(request, timeout=5) as response:
                assert response.headers.get("Cache-Control") == "no-store"
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, None

    def snapshot():
        data = Path(ready["authoritative_store_path"]).read_bytes()
        return data, json.loads(data)

    def selected(store):
        return [e for e in store.get("measurement_batches", [])
                if e["source"]["camera_id"] == "222" and e["source"]["mode"] == "live"
                and args.model_fragment in e["source"]["run"]["model_version"]]

    original = json.loads(args.baseline.read_bytes())
    factors = {}
    with (args.source_root / "emissions/data/la-2026/carb-source.csv").open() as stream:
        for row in csv.DictReader(stream):
            if row["process"] == "RUNEX" and row["pollutant"].lower() in ("co2", "nox"):
                factors[(row["vehicle_class"], row["pollutant"].lower(), float(row["speed_time"]),
                         float(row["temperature"]), float(row["relative_humidity"]))] = float(row["emission_rate"])
    edges = sorted({key[2] for key in factors})

    def grams(traversal, duration, approved, pollutant):
        if duration is None or duration <= 0:
            return None
        speed = traversal["distance_m"] / duration * 3600 / 1609.344
        edge = next((v for v in edges if speed <= v or math.isclose(speed, v, rel_tol=2e-15)), None)
        if edge is None:
            return None
        weather = approved["meteorology"]
        mixture = approved["class_mapping"]["classes"].get(traversal["vehicle_class"])
        if not mixture:
            return None
        return sum(traversal["distance_m"] / 1609.344 * mix["vmt_share"] * factors[
            (mix["emfac_class"], pollutant, edge, weather["temperature_f"], weather["relative_humidity_pct"])]
            for mix in mixture)

    def equal_number(expected, actual):
        if expected is None:
            assert actual is None
        else:
            assert actual is not None and math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-14)

    # This subprocess reloads sealed bytes and invokes the same production reads.
    # Credentials never enter its arguments, output, or environment.
    reload_code = """
import {readFileSync} from 'node:fs';
import {readSnapshot} from './backend/src/persistence.ts';
import {read_measurement_evidence,read_measurement_window} from './backend/src/measurements.ts';
import {compare_completed_traversal_scenario} from './emissions/src/scenario.ts';
const manifest=JSON.parse(readFileSync(process.argv[1],'utf8'));
readSnapshot(process.env.EMISSION_LENS_STORE_PATH);
const evidence=manifest.references.map(reference=>read_measurement_evidence(reference));
const scenarios=evidence.map(e=>e.approved_input?compare_completed_traversal_scenario({...e.approved_input,stopped_time_reduction_pct:20}):null);
const view=read_measurement_window({cameraId:'222',mode:'live',now:new Date(manifest.to),stoppedTimeReductionPct:20});
console.log(JSON.stringify({evidence,scenarios,view}));
"""
    samples = []
    generation_races = 0
    for sample in range(2):
        if sample:
            time.sleep(6)
        for attempt in range(3):
            directory = args.output / f"sample-{sample}-attempt-{attempt}"
            directory.mkdir(mode=0o700)
            data, store = snapshot()
            entries = selected(store)
            assert entries, "No actual stopped-policy cohorts retained."
            save(directory / "snapshot.json", data)
            workers = {e["batch"]["batch_id"]: e for e in store["batches"]}
            measurements = {e["source"]["batch_id"]: e for e in store["measurement_batches"]}
            assert all(workers[e["batch"]["batch_id"]] == e for e in original["batches"])
            assert all(measurements[e["source"]["batch_id"]] == e for e in original["measurement_batches"])
            try:
                status, view = get("/api/measurements?camera=222&mode=live&reduce=20")
                assert status == 200
                retained_refs = {e["derived"]["evidence_ref"] for e in store["measurement_batches"] if not e["source"]["retract"]}
                if not set(view["evidence_refs"]).issubset(retained_refs):
                    _, after = snapshot()
                    assert set(view["evidence_refs"]).issubset({e["derived"]["evidence_ref"] for e in after["measurement_batches"]})
                    raise GenerationChanged()
                responses = []
                for entry in entries:
                    ref = entry["derived"]["evidence_ref"]
                    assert get("/api/measurements/evidence?reference=" + ref)[0] == 401
                    status, response = get("/api/measurements/evidence?reference=" + ref, True)
                    if status == 404:
                        _, after = snapshot()
                        replacement = next(e for e in after["measurement_batches"] if e["source"]["batch_id"] == entry["source"]["batch_id"])
                        assert replacement["derived"]["evidence_ref"] != ref
                        raise GenerationChanged()
                    assert status == 200 and response["current"] is True
                    assert response["source"] == entry["source"]
                    assert response["dependency_key"] == entry["derived"]["dependency_key"]
                    assert response["registry_digest"] == entry["derived"]["registry_digest"]
                    assert response["calculation"] == entry["derived"]["calculation"]
                    assert response["approved_input"] == entry["derived"]["input"]
                    responses.append(response)
                save(directory / "http-evidence.json", responses)
                save(directory / "public.json", view)
                manifest = directory / "manifest.json"
                save(manifest, {"references": [e["derived"]["evidence_ref"] for e in entries], "to": view["to"]})
                environment = {k: v for k, v in os.environ.items() if "TOKEN" not in k and "SECRET" not in k}
                environment.update(EMISSION_LENS_STORE_PATH=str((directory / "snapshot.json").resolve()),
                                   EMISSION_LENS_REGISTRY_PATH=str(registry_path.resolve()))
                raw = subprocess.check_output([ready.get("node_executable", "node"), "--import", "tsx", "--input-type=module", "-e", reload_code, str(manifest.resolve())],
                                              cwd=args.source_root, env=environment, text=True)
                reloaded = json.loads(raw)
                assert reloaded["evidence"] == responses
                if reloaded["view"] != view:
                    _, after = snapshot()
                    before_refs = {e["source"]["batch_id"]: e["derived"]["evidence_ref"] for e in store["measurement_batches"]}
                    assert any(before_refs.get(e["source"]["batch_id"]) != e["derived"]["evidence_ref"] for e in after["measurement_batches"])
                    raise GenerationChanged()
                save(directory / "fresh-process.json", reloaded)
                break
            except GenerationChanged:
                generation_races += 1
        else:
            raise RuntimeError("Three captures raced with ingestion; no same-generation acceptance was obtained.")

        summaries = []
        stopped = []
        for entry, evidence, scenario in zip(entries, responses, reloaded["scenarios"]):
            source = entry["source"]
            assert source["calibration_version"] == "222-ground-esri-v1-7f52d53d8fc8"
            assert source["mapping_version"] == "pretrained-visual-to-emfac2007-v1"
            assert source["timing"]["basis"] == "estimated_hls_media_utc"
            ref = source["observation_ref"]
            linked = workers[ref["batch_id"]]["batch"]
            assert linked["revision"] == ref["revision"] and linked["run"]["run_id"] == source["run"]["run_id"]
            assert any(row["camera_id"] == "222" and row["mode"] == "live" and datetime.fromisoformat(row["minute"].replace("Z", "+00:00")) == datetime.fromisoformat(source["minute"].replace("Z", "+00:00")) for row in linked["traffic"])
            approved = evidence["approved_input"]
            assert approved is not None and approved["class_mapping"] is not None and scenario is not None
            assert scenario["assumptions"]["electric_fleet_share_applied"] is False
            assert scenario["assumptions"]["class_mapping"] == approved["class_mapping"]
            assert scenario["assumptions"]["meteorology"] == approved["meteorology"]
            traversals = approved["traversals"]
            for traversal in traversals:
                assert traversal["distance_m"] == 20
                value = traversal["stopped_time_s"]
                assert value is None or 0 <= value <= traversal["traversal_time_s"]
                stopped.append(value)
            pollutants = {}
            for pollutant in ("co2", "nox"):
                baseline_values = [grams(t, t["traversal_time_s"], approved, pollutant) for t in traversals]
                next_values = [grams(t, None if t["stopped_time_s"] is None else t["traversal_time_s"] - 0.2 * t["stopped_time_s"], approved, pollutant) for t in traversals]
                baseline = sum(baseline_values) if baseline_values and all(v is not None for v in baseline_values) else None
                hypothetical = sum(next_values) if next_values and all(v is not None for v in next_values) else None
                equal_number(baseline, next(row["estimate_g"] for row in evidence["calculation"]["rows"] if row["pollutant"] == pollutant))
                equal_number(hypothetical, next(row["estimate_g"] for row in scenario["scenario"]["rows"] if row["pollutant"] == pollutant))
                pollutants[pollutant] = {"baseline_g": baseline, "hypothetical20_g": hypothetical, "signed_change_g": None if baseline is None or hypothetical is None else hypothetical - baseline}
            summaries.append({"minute": source["minute"], "completed_candidates": len(traversals), "pollutants": pollutants})
        assert all(row["scenario_g"] is None for row in view["scenario"]["pollutants"].values())
        for camera in ("223", "220", "228"):
            status, other = get("/api/measurements?camera=" + camera + "&mode=live")
            assert status == 200 and other["minutes"] == [] and other["scenario"]["completed_cohort"]["count"] is None
        run_ids = {e["source"]["run"]["run_id"] for e in entries}
        statuses = [row for e in store["batches"] if e["batch"]["run"]["run_id"] in run_ids
                    for row in e["batch"]["statuses"] if row["camera_id"] == "222" and row["mode"] == "live" and row["heartbeat_at"] is not None]
        latest_status = max(statuses, key=lambda row: datetime.fromisoformat(row["heartbeat_at"].replace("Z", "+00:00")))
        assert latest_status["state"] == "live"
        heartbeat = latest_status["heartbeat_at"]
        samples.append({"captured_at": datetime.now(timezone.utc).isoformat(), "snapshot_sha256": hashlib.sha256(data).hexdigest(), "heartbeat": heartbeat,
                        "current_authenticated_reads": len(responses), "positive_stops": sum(v is not None and v > 0 for v in stopped), "zero_stops": stopped.count(0),
                        "null_stops": stopped.count(None), "cohorts": summaries})
    assert datetime.fromisoformat(samples[1]["heartbeat"].replace("Z", "+00:00")) > datetime.fromisoformat(samples[0]["heartbeat"].replace("Z", "+00:00"))
    superseded = 0
    if args.superseded:
        stale_store = json.loads(args.superseded.read_bytes())
        _, latest = snapshot()
        current_entries = {e["source"]["batch_id"]: e for e in latest["measurement_batches"]}
        for old in selected(stale_store):
            replacement = current_entries[old["source"]["batch_id"]]
            if old["derived"]["evidence_ref"] == replacement["derived"]["evidence_ref"]:
                continue
            assert get("/api/measurements/evidence?reference=" + old["derived"]["evidence_ref"], True)[0] == 404
            superseded += 1
    result = {"state": "PASS_current_generation_HTTP_original_CARB20_reload", "checked_at": datetime.now(timezone.utc).isoformat(),
              "generation_races_reacquired": generation_races, "samples": samples, "superseded_frozen_references_return_404": superseded,
              "legacy_worker_entries_preserved": len(original["batches"]), "legacy_measurement_entries_preserved": len(original["measurement_batches"]),
              "public_full_window20_remains_null": True, "other_three_new_metrics_unavailable": True,
              "fresh_process_evidence_and_entire_public_view_equal": True, "original_CARB_csv_baseline_and20_math": True,
              "literal_threshold": 0.0225, "running_application_and_services_unchanged": True,
              "limits": ["Two advancing samples, not sustained/recovery or field accuracy acceptance.", "20% is hypothetical estimated emissions; supported zero/null results remain intact."]}
    save(args.output / "result.json", result)
    print(json.dumps({"state": result["state"], "checked_at": result["checked_at"], "result_path": str(args.output / "result.json"),
                      "current_authenticated_reads": [s["current_authenticated_reads"] for s in samples],
                      "superseded_frozen_references_return_404": superseded, "generation_races_reacquired": generation_races}, indent=2))


if __name__ == "__main__":
    main()
