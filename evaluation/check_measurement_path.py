"""Independent HTTP acceptance check using only private, synthetic fixtures.

Run after the frontend production build. Starts its own loopback server and
temporary registry/store, checks the actual routes, then removes its resources.
No real camera approval, model work, source footage or hosted database is used.
"""
from __future__ import annotations

import argparse
import copy
import csv
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path
import re
import secrets
import signal
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]


def registry() -> dict:
    approval = {
        "status": "approved", "reviewed_by": "Mert",
        "reviewed_at": "2026-11-07T19:00:00Z",
        "evidence_refs": ["synthetic-http-acceptance-only"], "modes": ["synthetic"],
    }
    return {
        "registry_version": "1.0", "revision": "synthetic-http-acceptance-v1",
        "calibrations": [{
            "camera_id": "222", "version": "synthetic-calibration-v1",
            "approval": copy.deepcopy(approval), "valid_from": "2026-01-01T00:00:00Z", "valid_to": None,
            "calibration": {
                "camera_id": "222", "version": "synthetic-calibration-v1", "validation_status": "valid",
                "gates": {"entry": {"start": [0, 0], "end": [1, 0]}, "exit": {"start": [0, 1], "end": [1, 1]}},
                "reference_measurements": {"synthetic_only": True, "evidence": "synthetic-http-acceptance-only"},
                "transform": [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
            },
            "movements": [{"movement_id": "synthetic-entry-exit", "entry_gate_id": "entry", "exit_gate_id": "exit", "distance_m": 100, "distance_units": "m", "evidence_refs": ["synthetic-http-acceptance-only"]}],
        }],
        "mappings": [{
            "version": "synthetic-mapping-v1", "approval": copy.deepcopy(approval),
            "region": "Los Angeles (SC)", "calendar_year": 2026,
            "mapping": {"version": "synthetic-mapping-v1", "evidence": "Synthetic HTTP test assumes LDA only; never a live mapping.", "classes": {"car": [{"emfac_class": "LDA", "vmt_share": 1}]}},
        }],
    }


def fixture() -> dict:
    # The application's labeled synthetic view intentionally has a fixed demo
    # clock. Stay inside that same window; never masquerade as a live source.
    source = (ROOT / "contracts/src/fixtures.ts").read_text()
    match = re.search(r'SYNTHETIC_AS_OF\s*=\s*"([^"]+)"', source)
    if not match:
        raise RuntimeError("The documented synthetic demo clock is missing.")
    as_of = datetime.fromisoformat(match.group(1).replace("Z", "+00:00"))
    minute = as_of.replace(second=0, microsecond=0) - timedelta(minutes=1)
    if not timedelta(minutes=-5) <= datetime.now(timezone.utc) - minute <= timedelta(hours=24):
        raise RuntimeError("The fixed synthetic demo clock is outside ingestion retention. Refresh the application's synthetic fixture clock before repeating this acceptance run.")

    def utc(value: datetime) -> str:
        return value.isoformat().replace("+00:00", "Z")

    return {
        "measurement_version": "1.0", "batch_id": str(uuid.uuid4()), "revision": 0,
        "run": {"run_id": "synthetic-http-acceptance", "model_version": "synthetic-trajectory-only", "device": None, "started_at": utc(minute - timedelta(minutes=4)), "ended_at": None, "mode": "synthetic"},
        "camera_id": "222", "mode": "synthetic", "minute": utc(minute),
        "calibration_version": "synthetic-calibration-v1", "mapping_version": "synthetic-mapping-v1",
        "units": {"distance": "m", "time": "s"},
        "timing": {"basis": "estimated_hls_media_utc", "clock_method": "hls-min-anchor-v1", "sessions": [{"session_id": "private-fixture-session", "anchor_utc": utc(minute)}]},
        "meteorology": {"temperature_f": 70, "relative_humidity_pct": 60}, "observation_ref": None,
        "observations": [{"vehicle_class": "car", "count": 2, "stopped_vehicle_seconds": 7, "queue_count": 1, "coverage": None}],
        "traversals": [{"session_id": "private-fixture-session", "traversal_id": "private-fixture-traversal", "movement_id": "synthetic-entry-exit", "completed_at": utc(minute + timedelta(seconds=30)), "entry_media_s": 10, "exit_media_s": 30, "traversal_time_s": 20, "stopped_time_s": 5, "vehicle_class": "car"}],
        "retract": False,
    }


def original_factor(pollutant: str) -> float:
    # Independent units/rate check against the retained original CSV, not the
    # implementation's lookup helper or a repeated expected-value expression.
    with (ROOT / "emissions/data/la-2026/carb-source.csv").open() as stream:
        for row in csv.DictReader(stream):
            if (row["vehicle_class"] == "LDA" and row["process"] == "RUNEX"
                    and row["pollutant"].lower() == pollutant and row["temperature"] == "70"
                    and row["relative_humidity"] == "60" and row["speed_time"] == "15"):
                return float(row["emission_rate"]) * 100 / 1609.344
    raise AssertionError("Missing original acceptance factor.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=0)
    args = parser.parse_args()
    if args.port:
        port = args.port
    else:
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
    checks = []
    with tempfile.TemporaryDirectory(prefix="emission-lens-http-acceptance-") as directory:
        temporary = Path(directory)
        registry_path = temporary / "registry.json"
        registry_path.write_text(json.dumps(registry()))
        token = secrets.token_urlsafe(32)
        env = {**os.environ, "NODE_ENV": "production", "NEXT_TELEMETRY_DISABLED": "1",
               "EMISSION_LENS_STORE_PATH": str(temporary / "store.json"),
               "EMISSION_LENS_REGISTRY_PATH": str(registry_path), "EMISSION_LENS_WORKER_TOKEN": token}
        log = (temporary / "server-output.txt").open("w")
        base = f"http://127.0.0.1:{port}"

        def start_server():
            return subprocess.Popen(["npm", "run", "start", "-w", "@emission-lens/frontend", "--", "--hostname", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=env, stdout=log, stderr=log, start_new_session=True)

        def stop_server(process):
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait(timeout=5)

        def await_ready(process):
            for _ in range(100):
                if process.poll() is not None:
                    raise RuntimeError("Owned acceptance server exited before readiness.")
                try:
                    with urllib.request.urlopen(base + "/api/cameras?mode=live", timeout=1) as response:
                        if response.status == 200:
                            return
                except (urllib.error.URLError, TimeoutError):
                    time.sleep(0.1)
            raise RuntimeError("Owned acceptance server did not become ready.")

        server = start_server()

        def request(path, data=None, authenticated=False):
            headers = {"Content-Type": "application/json"}
            if authenticated:
                headers["Authorization"] = f"Bearer {token}"
            req = urllib.request.Request(base + path, data=None if data is None else json.dumps(data).encode(), headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=15) as response:
                    return response.status, json.load(response)
            except urllib.error.HTTPError as error:
                return error.code, json.loads(error.read())

        try:
            await_ready(server)
            value = fixture()
            status, _ = request("/api/measurements", value)
            assert status == 401, f"Unauthenticated ingestion returned {status}."
            checks.append("unauthenticated writes denied")
            status, _ = request("/api/measurements", value, True)
            assert status in {200, 202}, f"Synthetic ingestion returned {status}."
            status, receipt = request("/api/measurements", value, True)
            assert status == 200 and receipt.get("duplicate") is True, "Exact retry was not idempotent."
            checks.append("durable ingestion and exact retry")
            stop_server(server)
            server = start_server()
            await_ready(server)
            checks.append("independent application restart reloads the same durable store")
            query = "/api/measurements?camera=222&mode=synthetic&reduce=20"
            status, public = request(query)
            assert status == 200 and len(public["minutes"]) == 1, "Stored minute is missing."
            minute = public["minutes"][0]
            assert minute["traffic"][0]["count"] == 2
            assert minute["traffic"][0]["stopped_vehicle_seconds"] == 7
            for pollutant in ["co2", "nox"]:
                actual = next(row for row in minute["emissions"] if row["pollutant"] == pollutant)
                assert actual["quality_state"] == "ok" and math.isclose(actual["estimate_g"], original_factor(pollutant), rel_tol=1e-10), f"{pollutant} original-source identity failed."
                comparison = public["scenario"]["pollutants"][pollutant]
                assert comparison["baseline_g"] is not None and comparison["scenario_g"] is not None
                assert math.isclose(comparison["change_g"], comparison["scenario_g"] - comparison["baseline_g"], abs_tol=1e-10)
            checks.append("original CARB rates, separate observation cohort, per-pollutant scenario")
            serialized = json.dumps(public)
            for forbidden in ["private-fixture-session", "private-fixture-traversal", str(registry_path), token]:
                assert forbidden not in serialized, "Private information entered the public summary."
            reference = public["evidence_refs"][0]
            status, _ = request("/api/measurements/evidence?reference=" + urllib.parse.quote(reference))
            assert status == 401, "Private evidence route did not require authentication."
            status, _ = request("/api/measurements/evidence?reference=" + urllib.parse.quote(reference), authenticated=True)
            assert status == 200, "Authenticated retained evidence is missing."
            checks.append("public-safe summaries and authenticated evidence")
            class ExportInputs(HTMLParser):
                def __init__(self):
                    super().__init__(convert_charrefs=True)
                    self.values = {}

                def handle_starttag(self, tag, attributes):
                    attrs = dict(attributes)
                    if tag == "input" and attrs.get("name") in {"text", "filename"}:
                        self.values[attrs["name"]] = attrs.get("value", "")

            with urllib.request.urlopen(base + "/brief?camera=222&mode=synthetic&reduce=20", timeout=15) as response:
                html = response.read().decode()
            form = ExportInputs()
            form.feed(html)
            assert form.values.get("text") and form.values.get("filename"), "Authoritative brief form is missing."
            for forbidden in ["private-fixture-session", "private-fixture-traversal", str(registry_path), token]:
                assert forbidden not in form.values["text"], "Private information entered a brief."
            export = urllib.request.Request(base + "/api/brief", data=urllib.parse.urlencode(form.values).encode(), headers={"Content-Type": "application/x-www-form-urlencoded"})
            with urllib.request.urlopen(export, timeout=15) as response:
                downloaded = response.read().decode()
                assert "attachment" in response.headers.get("Content-Disposition", "")
            assert downloaded == form.values["text"].replace("\r\n", "\n"), "Export differs from the authoritative displayed draft."
            checks.append("authoritative brief renders and exports exactly without private identifiers")
            invalid = copy.deepcopy(value)
            invalid["traversals"][0]["distance_m"] = 999999
            status, _ = request("/api/measurements", invalid, True)
            assert status == 400, "Worker-supplied physical distance was not rejected."
            checks.append("producer cannot override server-approved distance")
            pending = registry()
            pending["revision"] = "synthetic-http-revoked-v2"
            pending["calibrations"][0]["approval"]["status"] = "rejected"
            registry_path.write_text(json.dumps(pending))
            status, revoked = request(query)
            assert status == 200
            assert all(row["estimate_g"] is None for item in revoked["minutes"] for row in item["emissions"]), "Registry revocation left stale supported grams visible."
            assert revoked["minutes"][0]["traffic"][0]["count"] == 2, "Revoking calibration erased independent image counts."
            checks.append("registry revocation suppresses physical estimates and preserves counts")
            retract = copy.deepcopy(value)
            retract.update(revision=1, observations=[], traversals=[], retract=True)
            status, _ = request("/api/measurements", retract, True)
            assert status in {200, 202}, "Explicit retraction failed."
            status, empty = request(query)
            assert status == 200 and empty["minutes"] == [], "Retraction retained a stale measurement minute."
            checks.append("atomic retraction removes dependent results")
            print(json.dumps({"mode": "synthetic", "result": "passed", "checks": checks,
                              "limits": "Private test fixtures only; no real camera approval, model accuracy, field emissions or hosted database is established."}, indent=2))
        finally:
            stop_server(server)
            log.close()


if __name__ == "__main__":
    main()
