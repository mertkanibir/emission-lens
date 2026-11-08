#!/usr/bin/env python3
"""Read-only private acceptance for the separate 222/223 stop-v1 replays.

The manifest supplies an isolated application's ready_path and two actual runtime
reports/configuration/source paths. This driver starts no application or worker.
"""
import argparse
import csv
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import shlex
import subprocess
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

THRESHOLDS = {"222": 0.0225, "223": 0.0283}


def instant(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def save(path, value):
    data = value if isinstance(value, bytes) else (json.dumps(value, indent=2, allow_nan=False) + "\n").encode()
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "wb") as stream:
        stream.write(data)


def strict_sum(values):
    return sum(values) if values and all(v is not None for v in values) else None


def near(expected, actual):
    if expected is None:
        assert actual is None, "Unavailable cohort was converted to a supported number."
    else:
        assert actual is not None and math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-14), "Original-CARB arithmetic differs."


class CarbOracle:
    def __init__(self, path):
        self.factors = {}
        with Path(path).open() as stream:
            for row in csv.DictReader(stream):
                if row["process"] == "RUNEX" and row["pollutant"].lower() in ("co2", "nox"):
                    key = (row["vehicle_class"], row["pollutant"].lower(), float(row["speed_time"]), float(row["temperature"]), float(row["relative_humidity"]))
                    assert key not in self.factors
                    self.factors[key] = float(row["emission_rate"])
        self.edges = sorted({key[2] for key in self.factors})

    def grams(self, traversal, duration, approved, pollutant):
        if duration is None or duration <= 0:
            return None
        mixture = (approved["class_mapping"] or {}).get("classes", {}).get(traversal["vehicle_class"])
        if not mixture:
            return None
        speed = traversal["distance_m"] / duration * 3600 / 1609.344
        edge = next((v for v in self.edges if speed <= v or math.isclose(speed, v, rel_tol=2e-15)), None)
        if edge is None:
            return None
        weather = approved["meteorology"]
        values = [self.factors.get((m["emfac_class"], pollutant, edge, weather["temperature_f"], weather["relative_humidity_pct"])) for m in mixture]
        if any(v is None for v in values):
            return None
        return sum(traversal["distance_m"] / 1609.344 * m["vmt_share"] * factor for m, factor in zip(mixture, values))

    def compare(self, approved, pollutant):
        if approved is None:
            return {"baseline_g": None, "scenario_g": None, "change_g": None}
        rows = approved["traversals"]
        baseline = strict_sum([self.grams(t, t["traversal_time_s"], approved, pollutant) for t in rows])
        scenario = strict_sum([self.grams(t, None if t["stopped_time_s"] is None else t["traversal_time_s"] - 0.2 * t["stopped_time_s"], approved, pollutant) for t in rows])
        return {"baseline_g": baseline, "scenario_g": scenario, "change_g": None if baseline is None or scenario is None else scenario - baseline}


def validate_policy(camera, raw):
    assert camera in THRESHOLDS and raw["camera_id"] == camera
    assert raw["context_version"].endswith("+stop-v1")
    assert raw["stop_observation"]["image_displacement_per_s"] == THRESHOLDS[camera], "The exact supplied literal stopped threshold changed."
    assert raw["stop_observation"]["method_version"] == f"{camera}-image-stop-v1-{THRESHOLDS[camera]}"


def per_camera(value, camera):
    return value.get("by_camera", {}).get(camera, value)


class GenerationChanged(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise RuntimeError("Private evidence checks do not follow redirects.")


RELOAD = """
import {readFileSync} from 'node:fs';
import {readSnapshot} from './backend/src/persistence.ts';
import {read_measurement_evidence,read_measurement_window} from './backend/src/measurements.ts';
import {compare_completed_traversal_scenario} from './emissions/src/scenario.ts';
const m=JSON.parse(readFileSync(process.argv[1],'utf8'));
readSnapshot(process.env.EMISSION_LENS_STORE_PATH);
const evidence=m.references.map(reference=>read_measurement_evidence(reference));
const scenarios=evidence.map(e=>e.approved_input?compare_completed_traversal_scenario({...e.approved_input,stopped_time_reduction_pct:20}):null);
const views=m.queries.map(q=>read_measurement_window({...q,now:new Date(q.now),stoppedTimeReductionPct:20}));
console.log(JSON.stringify({evidence,scenarios,views}));
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_bytes())
    ready = json.loads(Path(manifest["ready_path"]).read_bytes()) if "ready_path" in manifest else manifest
    source_root = Path(ready["build_workspace"])
    base = ready["base_url"].rstrip("/")
    url = urlsplit(base)
    assert url.scheme == "http" and url.hostname in ("127.0.0.1", "localhost", "::1") and not url.username and not url.password
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    registry_data = Path(ready["approved_registry_path"]).read_bytes()
    assert digest(registry_data) == ready["registry_sha256"]
    registry = json.loads(registry_data)
    assert {c["camera_id"] for c in registry["calibrations"]} == {"222", "223", "220", "228"}, "The supplied registry is not the current four-camera registry."
    save(args.output / "registry.json", registry_data)
    assert len(manifest["runs"]) == 2 and {r["camera_id"] for r in manifest["runs"]} == set(THRESHOLDS)
    runs, provenance = {}, {}
    for item in manifest["runs"]:
        camera = item["camera_id"]
        runtime_data = Path(item["runtime_report_path"]).read_bytes()
        runtime = json.loads(runtime_data)
        policy_data = Path(item["traversal_policy_path"]).read_bytes()
        policy = json.loads(policy_data)
        validate_policy(camera, policy)
        geometry_data = Path(item["geometry_path"]).read_bytes()
        source_data = Path(item["source_recording_path"]).read_bytes()
        assert digest(source_data) == item["source_sha256"]
        assert runtime["failure"] is None and runtime["run"]["mode"] == "replay"
        assert runtime["run"]["ended_at"] is not None and runtime["run"]["device"].startswith("cuda")
        assert runtime["settings"]["duration_s"] == 300 and runtime["gpu"] is not None
        assert runtime["settings"]["target_sampling_fps"] == 15 and runtime["settings"]["image_size"] == 640
        assert runtime["delivery"]["enabled"] and runtime["delivery"]["pending_batches"] == 0
        assert runtime["measurement_delivery"]["enabled"] and runtime["measurement_delivery"]["pending_batches"] == 0
        measurement = per_camera(runtime["measurements"], camera)
        assert measurement["config_sha256"] == digest(geometry_data)
        assert measurement["traversal"]["config_sha256"] == digest(policy_data)
        assert "|v:" + digest(policy_data)[:16] in runtime["run"]["model_version"]
        assert runtime["runtime_sha256"] == digest((source_root / "worker/main.py").read_bytes())
        window = item.get("source_window_s")
        if window is not None:
            assert len(window) == 2 and window[0] >= 0 and window[1] > window[0]
        camera_report = runtime["cameras"][camera]
        spans = list(camera_report["media_by_session"].values())
        assert spans and camera_report["processed_frames"] > 0
        first, last = min(s["first_s"] for s in spans), max(s["last_s"] for s in spans)
        assert 0 <= first <= last
        if window is not None:
            assert first >= window[0] - 1e-6 and last <= window[1] + 1e-6
        source_link = False
        if item.get("execution_receipt_path"):
            receipt = json.loads(Path(item["execution_receipt_path"]).read_bytes())
            assert receipt["run_id"] == runtime["run"]["run_id"] and receipt["runtime_report_sha256"] == digest(runtime_data)
            assert receipt["source_sha256"] == item["source_sha256"] and receipt.get("source_window_s") == window
            assert receipt["traversal_policy_sha256"] == digest(policy_data) and receipt["geometry_sha256"] == digest(geometry_data)
            source_link = True
        run_id = runtime["run"]["run_id"]
        runs[run_id] = {"item": item, "runtime": runtime, "policy": policy, "camera": camera}
        provenance[camera] = {"runtime_report_sha256": digest(runtime_data), "policy_sha256": digest(policy_data), "geometry_sha256": digest(geometry_data),
                              "source_sha256": item["source_sha256"], "weights_sha256": runtime["weights_sha256"], "literal_threshold": THRESHOLDS[camera], "configured_wall_duration_s": 300, "source_window_s": window,
                              "actual_first_media_s": first, "actual_last_media_s": last, "actual_media_span_s": last - first,
                              "requested_source_endpoints_covered_within_1s": None if window is None else first <= window[0] + 1 and last >= window[1] - 1,
                              "source_execution_receipt_linked": source_link, "processed_frames": camera_report["processed_frames"], "reader_frames_dropped": camera_report["reader_frames_dropped"],
                              "media_by_session": camera_report["media_by_session"], "reader_state": camera_report["reader_state"],
                              "traversal_issues": per_camera(runtime["completed_traversals"], camera)["issues"],
                              "coverage_limit": "Wall duration is not processed source duration. Native intra-session PTS gaps are not retained by this aggregate report; no continuous/loss-free coverage is claimed."}
    assert len(runs) == 2, "Replay cameras must have separate run identities."
    assert len({p["weights_sha256"] for p in provenance.values()}) == 1
    if manifest.get("weights_sha256"):
        assert all(p["weights_sha256"] == manifest["weights_sha256"] for p in provenance.values())
    oracle = CarbOracle(source_root / "emissions/data/la-2026/carb-source.csv")
    baseline = json.loads(Path(manifest["baseline_snapshot_path"]).read_bytes()) if manifest.get("baseline_snapshot_path") else {"batches": [], "measurement_batches": []}
    token = next(shlex.split(line.split("=", 1)[1])[0] for line in Path(ready["private_worker_environment_path"]).read_text().splitlines() if line.removeprefix("export ").startswith("EMISSION_LENS_WORKER_TOKEN="))
    opener = build_opener(NoRedirect())

    def get(path, authenticated=False):
        try:
            with opener.open(Request(base + path, headers={"Authorization": "Bearer " + token} if authenticated else {}), timeout=5) as response:
                assert response.headers.get("Cache-Control") == "no-store"
                return response.status, json.load(response)
        except HTTPError as error:
            return error.code, None

    def snapshot():
        data = Path(ready["authoritative_store_path"]).read_bytes()
        return data, json.loads(data)

    races = 0
    for attempt in range(3):
        directory = args.output / f"generation-{attempt}"
        directory.mkdir(mode=0o700)
        data, store = snapshot()
        save(directory / "snapshot.json", data)
        workers = {e["batch"]["batch_id"]: e for e in store["batches"]}
        measurements = {e["source"]["batch_id"]: e for e in store.get("measurement_batches", [])}
        assert all(workers[e["batch"]["batch_id"]] == e for e in baseline["batches"])
        assert all(measurements[e["source"]["batch_id"]] == e for e in baseline.get("measurement_batches", []))
        original_ids = {e["source"]["batch_id"] for e in baseline.get("measurement_batches", [])}
        assert all(e["source"]["run"]["run_id"] in runs or e["source"]["batch_id"] in original_ids for e in measurements.values())
        entries = [e for e in measurements.values() if e["source"]["run"]["run_id"] in runs and not e["source"]["retract"]]
        assert {e["source"]["run"]["run_id"] for e in entries} == set(runs)
        try:
            responses = []
            for entry in entries:
                reference = entry["derived"]["evidence_ref"]
                assert get("/api/measurements/evidence?reference=" + reference)[0] == 401
                status, value = get("/api/measurements/evidence?reference=" + reference, True)
                if status == 404:
                    _, after = snapshot()
                    replacement = next(e for e in after["measurement_batches"] if e["source"]["batch_id"] == entry["source"]["batch_id"])
                    assert replacement["derived"]["evidence_ref"] != reference
                    raise GenerationChanged()
                assert status == 200 and value["current"] is True
                assert value["source"] == entry["source"] and value["calculation"] == entry["derived"]["calculation"] and value["approved_input"] == entry["derived"]["input"]
                assert value["dependency_key"] == entry["derived"]["dependency_key"] and value["registry_digest"] == entry["derived"]["registry_digest"]
                responses.append(value)
            queries, views, labels = [], [], []
            for camera in THRESHOLDS:
                for mode in ("replay", "live", "synthetic"):
                    status, view = get("/api/measurements?" + urlencode({"camera": camera, "mode": mode, "reduce": 20}))
                    assert status == 200
                    views.append(view); labels.append({"camera": camera, "mode": mode, "scope": "reporting_hour"})
                    queries.append({"cameraId": camera, "mode": mode, "now": view["to"]})
                    if mode == "replay":
                        for minute in sorted({e["source"]["minute"] for e in entries if e["source"]["camera_id"] == camera}):
                            end = (instant(minute) + timedelta(minutes=1)).isoformat()
                            if instant(end) > instant(view["to"]):
                                continue
                            status, selected = get("/api/measurements?" + urlencode({"camera": camera, "mode": mode, "reduce": 20, "from": minute, "to": end}))
                            assert status == 200 and selected["scope"] == "explicit_window"
                            views.append(selected); labels.append({"camera": camera, "mode": mode, "scope": "explicit_window", "minute": minute})
                            queries.append({"cameraId": camera, "mode": mode, "from": minute, "to": end, "now": view["to"]})
            reload_manifest = directory / "reload-manifest.json"
            save(reload_manifest, {"references": [e["derived"]["evidence_ref"] for e in entries], "queries": queries})
            environment = {k: v for k, v in os.environ.items() if "TOKEN" not in k and "SECRET" not in k}
            environment.update(EMISSION_LENS_STORE_PATH=str((directory / "snapshot.json").resolve()), EMISSION_LENS_REGISTRY_PATH=str((args.output / "registry.json").resolve()))
            loaded = json.loads(subprocess.check_output([ready.get("node_executable", "node"), "--import", "tsx", "--input-type=module", "-e", RELOAD, str(reload_manifest.resolve())], cwd=source_root, env=environment, text=True))
            if loaded["evidence"] != responses or loaded["views"] != views:
                _, after = snapshot()
                old_refs = {e["source"]["batch_id"]: e["derived"]["evidence_ref"] for e in measurements.values()}
                assert any(old_refs.get(e["source"]["batch_id"]) != e["derived"]["evidence_ref"] for e in after["measurement_batches"])
                raise GenerationChanged()
            save(directory / "http-evidence.json", responses)
            save(directory / "public-views.json", {"labels": labels, "views": views})
            save(directory / "fresh-process.json", loaded)
            break
        except GenerationChanged:
            races += 1
    else:
        raise RuntimeError("Three concurrent replacements prevented a generation-bound read; no acceptance claimed.")

    summaries = {camera: {"completed_candidates": 0, "positive_stop_count": 0, "zero_stop_count": 0, "unknown_stop_count": 0, "max_stopped_time_s": None, "minutes": []} for camera in THRESHOLDS}
    identities = set()
    for entry, evidence, scenario in zip(entries, responses, loaded["scenarios"]):
        source = entry["source"]; run = runs[source["run"]["run_id"]]; camera = run["camera"]
        assert source["mode"] == "replay" and source["camera_id"] == camera
        assert source["run"]["model_version"] == run["runtime"]["run"]["model_version"]
        assert source["calibration_version"] == run["policy"]["calibration_version"] and source["mapping_version"] == run["policy"]["mapping_version"]
        ref = source["observation_ref"]; assert ref is not None
        linked = workers[ref["batch_id"]]["batch"]
        assert linked["revision"] == ref["revision"] and linked["run"]["run_id"] == source["run"]["run_id"] and linked["run"]["mode"] == "replay"
        assert any(row["camera_id"] == camera and row["mode"] == "replay" and row["run_id"] == source["run"]["run_id"] and instant(row["minute"]) == instant(source["minute"]) for row in linked["traffic"])
        approved = evidence["approved_input"]
        assert approved is not None and approved["class_mapping"] is not None and scenario is not None
        calibration = next(c for c in registry["calibrations"] if c["camera_id"] == camera and c["version"] == source["calibration_version"])
        assert calibration["approval"]["status"] == "approved" and "replay" in calibration["approval"]["modes"]
        distances = {m["movement_id"]: m["distance_m"] for m in calibration["movements"]}
        anchors = {s["session_id"]: instant(s["anchor_utc"]) for s in source["timing"]["sessions"]}
        assert len(approved["traversals"]) == len(source["traversals"])
        summary = summaries[camera]
        for raw, traversal in zip(source["traversals"], approved["traversals"]):
            identity = (source["run"]["run_id"], raw["session_id"], raw["traversal_id"])
            assert identity not in identities
            identities.add(identity)
            assert traversal["session_id"] == raw["session_id"] and traversal["traversal_id"] == raw["traversal_id"]
            assert instant(traversal["completed_at"]) == instant(raw["completed_at"])
            assert 0 <= raw["entry_media_s"] < raw["exit_media_s"]
            assert math.isclose(raw["exit_media_s"] - raw["entry_media_s"], raw["traversal_time_s"], rel_tol=1e-12, abs_tol=1e-6)
            assert abs((instant(raw["completed_at"]) - anchors[raw["session_id"]]).total_seconds() - raw["exit_media_s"]) <= 0.000002
            assert instant(source["minute"]) <= instant(raw["completed_at"]) < instant(source["minute"]) + timedelta(minutes=1)
            assert instant(calibration["valid_from"]) <= instant(raw["completed_at"])
            assert calibration["valid_to"] is None or instant(raw["completed_at"]) < instant(calibration["valid_to"])
            assert traversal["distance_m"] == distances[raw["movement_id"]]
            assert traversal["traversal_time_s"] == raw["traversal_time_s"] and traversal["stopped_time_s"] == raw["stopped_time_s"]
            value = raw["stopped_time_s"]
            assert value is None or 0 <= value <= raw["traversal_time_s"]
            summary["completed_candidates"] += 1
            summary["unknown_stop_count"] += value is None
            summary["zero_stop_count"] += value == 0
            summary["positive_stop_count"] += value is not None and value > 0
            if value is not None:
                summary["max_stopped_time_s"] = max(summary["max_stopped_time_s"] or 0, value)
        assert scenario["assumptions"]["class_mapping"] == approved["class_mapping"] and scenario["assumptions"]["meteorology"] == approved["meteorology"]
        assert scenario["assumptions"]["electric_fleet_share_applied"] is False
        assert all(row["range_low_g"] is None and row["range_high_g"] is None for calculation in (evidence["calculation"], scenario["scenario"]) for row in calculation["rows"])
        pollutants = {}
        for pollutant in ("co2", "nox"):
            result = oracle.compare(approved, pollutant)
            near(result["baseline_g"], next(r["estimate_g"] for r in evidence["calculation"]["rows"] if r["pollutant"] == pollutant))
            near(result["scenario_g"], next(r["estimate_g"] for r in scenario["scenario"]["rows"] if r["pollutant"] == pollutant))
            near(result["change_g"], scenario["change_g_by_pollutant"][pollutant])
            pollutants[pollutant] = result
        summary["minutes"].append({"minute": source["minute"], "completed_candidates": len(source["traversals"]), "pollutants": pollutants})
    public_text = json.dumps(views)
    assert '"session_id"' not in public_text and '"traversal_id"' not in public_text and token not in public_text
    assert all(str(item["source_recording_path"]) not in public_text for item in manifest["runs"])
    new_refs = {e["derived"]["evidence_ref"] for e in entries}
    for label, view in zip(labels, views):
        if label["mode"] != "replay":
            assert not new_refs.intersection(view["evidence_refs"])
        elif label["scope"] == "explicit_window":
            assert "not the reporting hour" in " ".join(view["limitations"])
            matching = [m for m in summaries[label["camera"]]["minutes"] if instant(m["minute"]) == instant(label["minute"])]
            assert len(matching) == 1
            for pollutant in ("co2", "nox"):
                for key in ("baseline_g", "scenario_g", "change_g"):
                    near(matching[0]["pollutants"][pollutant][key], view["scenario"]["pollutants"][pollutant][key])
    for camera, summary in summaries.items():
        runtime = next(r["runtime"] for r in runs.values() if r["camera"] == camera)
        assert summary["completed_candidates"] == per_camera(runtime["completed_traversals"], camera)["completed_traversals"]
        scoped = [v for label, v in zip(labels, views) if label["camera"] == camera and label["scope"] == "explicit_window"]
        summary["complete_minute_queries"] = len(scoped)
        summary["numeric_complete_minute_scenarios"] = sum(v["scenario"]["available"] for v in scoped)
        summary["scenario_increase_minutes"] = sum(any(p["change_g"] is not None and p["change_g"] > 0 for p in m["pollutants"].values()) for m in summary["minutes"])
        whole = next(v for label, v in zip(labels, views) if label["camera"] == camera and label["mode"] == "replay" and label["scope"] == "reporting_hour")
        incomplete = any(m["pollutants"]["co2"]["scenario_g"] is None for m in summary["minutes"])
        if incomplete:
            assert all(p["scenario_g"] is None for p in whole["scenario"]["pollutants"].values())
        if any(m["pollutants"]["co2"]["baseline_g"] is None for m in summary["minutes"]):
            assert all(p["baseline_g"] is None for p in whole["scenario"]["pollutants"].values())
        summary["whole_window_scenario_available"] = whole["scenario"]["available"]
        summary["incomplete_whole_window_preserved"] = not incomplete or not whole["scenario"]["available"]
    exercises = {camera: {"actual_completed_candidates": summary["completed_candidates"] > 0,
                          "positive_stopped_observed": summary["positive_stop_count"] > 0,
                          "numeric_complete_minute_scenario": summary["numeric_complete_minute_scenarios"] > 0,
                          "source_execution_linkage": provenance[camera]["source_execution_receipt_linked"]} for camera, summary in summaries.items()}
    for camera in THRESHOLDS:
        if provenance[camera]["source_window_s"] is not None:
            exercises[camera]["explicit_source_endpoints_covered"] = provenance[camera]["requested_source_endpoints_covered_within_1s"]
    complete = all(all(values.values()) for values in exercises.values())
    result = {"state": "PASS_actual_stop_replays" if complete else "PARTIAL_actual_replays_verified_with_unexercised_conditions", "checked_at": datetime.now(timezone.utc).isoformat(),
              "registry_sha256": digest(registry_data), "snapshot_sha256": digest(data), "current_authenticated_reads": len(responses), "generation_races_reacquired": races,
              "fresh_process_private_and_public_equal": True, "original_CARB_baseline_and20_oracle": True, "mode_and_public_identity_boundary": True,
              "provenance": provenance, "cameras": summaries, "exercises": exercises,
              "methodological_correction": "A 20% shorter-stop scenario may increase estimated emissions across nonlinear RUNEX bins. Signed results are preserved; scenario<=baseline is not an acceptance invariant.",
              "limitations": ["Configured300s is wall duration, not processed source duration; actual first/last PTS, session spans, drops and issue counters are retained. Native intra-session gaps, continuous/loss-free coverage and field accuracy remain unverified.", "Image stopped time does not identify an engine-running state.", "No ordinary-idle process, extra EV discount, statistical interval or claimed real-world savings is added."]}
    save(args.output / "result.json", result)
    print(json.dumps({"state": result["state"], "result_path": str(args.output / "result.json"), "current_authenticated_reads": len(responses), "exercises": exercises}, indent=2))


if __name__ == "__main__":
    main()
