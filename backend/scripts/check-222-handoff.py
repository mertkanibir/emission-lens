"""Exercise a private pending or supplied-owner-approved 222 profile without touching an active server.

Default controlled trajectories test the actual publisher/handlers. An explicit
local clip/weights pair enables a bounded CPU replay through worker.main. No GPU
allocation, source acquisition or fixture approval is used. Each check creates
its own ephemeral loopback token rather than using existing service credentials.
"""

from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from types import SimpleNamespace
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from worker.aggregate import MinuteAggregator
from worker.metrics import CameraMetrics, MetricsConfig
from worker.publish import HttpSender, Outbox, TraversalBridge


def file_sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(part)
    return digest.hexdigest()


def private_write(path, value):
    body = (json.dumps(value, indent=2, allow_nan=False) + "\n").encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as output:
        output.write(body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--replay-file", type=Path)
    parser.add_argument("--weights", type=Path)
    parser.add_argument("--seconds", type=float, default=30)
    args = parser.parse_args()
    profile = args.profile.resolve()
    if not 0 < args.seconds <= 120:
        parser.error("Bounded replay duration must be within (0,120] seconds.")
    if bool(args.replay_file) != bool(args.weights):
        parser.error(
            "Actual replay needs both an existing local clip and existing local weights."
        )
    if args.replay_file and (
        not args.replay_file.is_file() or not args.weights.is_file()
    ):
        parser.error("Actual replay never downloads missing media or weights.")
    media_provenance = None
    if args.replay_file:
        weight_hash = file_sha256(args.weights)
        if (
            weight_hash
            != "0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1"
        ):
            parser.error(
                "Use the already verified pretrained YOLO11n weights for this bounded handoff."
            )
        media_provenance = {
            "clip_sha256": file_sha256(args.replay_file),
            "weights_sha256": weight_hash,
            "device": "cpu",
            "image_size": 640,
            "sample_fps": 15,
        }
    registry = json.loads((profile / "registry.json").read_bytes())
    raw = json.loads((profile / "traversals.json").read_bytes())
    if raw["stop_observation"] is not None:
        raise RuntimeError("This handoff retains null stopped evidence.")
    calibration = next(
        c
        for c in registry["calibrations"]
        if c["camera_id"] == "222" and c["version"] == raw["calibration_version"]
    )
    approved = calibration["approval"]["status"] == "approved"
    if approved:
        mapping = next(
            m for m in registry["mappings"] if m["version"] == raw["mapping_version"]
        )
        if mapping["approval"]["status"] != "approved":
            raise RuntimeError("Requested mapping is not source-approved.")
    elif (
        calibration["approval"]["status"] != "pending"
        or registry["mappings"]
        or raw["mapping_version"] is not None
    ):
        raise RuntimeError(
            "Negative coverage requires a separate pending-only null-mapping profile."
        )
    directory = (
        profile
        / ("replay" if args.replay_file else "controlled")
        / datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    )
    directory.mkdir(parents=True, mode=0o700)
    token = secrets.token_urlsafe(40)
    environment = {
        **os.environ,
        "EMISSION_LENS_REGISTRY_PATH": str(profile / "registry.json"),
        "EMISSION_LENS_STORE_PATH": str(directory / "store.json"),
        "EMISSION_LENS_WORKER_TOKEN": token,
        "EMISSION_LENS_HANDOFF_DROP_ACK": "1",
    }
    server = None
    log = os.fdopen(
        os.open(directory / "server.log", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600),
        "w",
    )

    def start():
        process = subprocess.Popen(
            ["node", "--import", "tsx", "backend/scripts/222-handoff-server.ts"],
            cwd=ROOT,
            env=environment,
            stdout=subprocess.PIPE,
            stderr=log,
            text=True,
        )
        ready = process.stdout.readline()
        if not ready:
            raise RuntimeError("Isolated handoff server failed before readiness.")
        return process, "http://127.0.0.1:" + str(json.loads(ready)["port"])

    def stop(process):
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        if process is not None and process.stdout:
            process.stdout.close()

    try:
        server, base = start()

        def request(path, payload=None, authenticated=False):
            body = (
                None
                if payload is None
                else json.dumps(
                    payload, separators=(",", ":"), allow_nan=False
                ).encode()
            )
            headers = {"Content-Type": "application/json"}
            if authenticated:
                headers["Authorization"] = "Bearer " + token
            try:
                with urlopen(
                    Request(base + path, data=body, headers=headers), timeout=10
                ) as response:
                    return response.status, json.load(response)
            except HTTPError as error:
                return error.code, json.load(error)

        exact = []
        if args.replay_file:
            worker_env = {
                **environment,
                "EMISSION_LENS_INGEST_URL": base + "/api/worker",
                "EMISSION_LENS_MEASUREMENT_URL": base + "/api/measurements",
            }
            command = [
                sys.executable,
                "-m",
                "worker.main",
                "--camera",
                "222",
                "--replay-file",
                str(args.replay_file.resolve()),
                "--weights",
                str(args.weights.resolve()),
                "--device",
                "cpu",
                "--image-size",
                "640",
                "--fps",
                "15",
                "--seconds",
                str(args.seconds),
                "--measurement-config",
                str(profile / "geometry.json"),
                "--count-gate-id",
                "count-1",
                "--traversal-config",
                str(profile / "traversals.json"),
                "--outbox",
                str(directory / "outbox"),
                "--output",
                str(directory / "runtime.json"),
                "--require-delivery",
            ]
            with os.fdopen(
                os.open(
                    directory / "worker.log",
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL,
                    0o600,
                ),
                "w",
            ) as worker_log:
                subprocess.run(
                    command,
                    cwd=ROOT,
                    env=worker_env,
                    stdout=worker_log,
                    stderr=worker_log,
                    check=True,
                    timeout=args.seconds + 90,
                )
            (directory / "runtime.json").chmod(0o600)
        else:
            # Controlled bottom-centre points through the actual candidate gates.
            # This phase is software evidence only, never an actual video replay.
            anchor = datetime.now(timezone.utc).replace(
                second=0, microsecond=0
            ) - timedelta(minutes=2)
            run = {
                "run_id": "controlled-pending-222-" + secrets.token_hex(8),
                "model_version": "controlled-trajectory-only|t:hls-min-anchor-v1",
                "device": "controlled-no-inference",
                "started_at": anchor.isoformat(),
                "ended_at": None,
                "mode": "replay",
            }
            metrics_config = MetricsConfig.from_dict(
                json.loads((profile / "geometry.json").read_bytes())
            )
            metrics = CameraMetrics(metrics_config)
            aggregate = MinuteAggregator(
                metrics_config, run["run_id"], "replay", "count-1", frozenset({"car"})
            )
            box = Outbox(
                directory / "worker-outbox", HttpSender(base + "/api/worker", token)
            )
            measurements = Outbox(
                directory / "measurement-outbox",
                HttpSender(base + "/api/measurements", token),
            )
            bridge = TraversalBridge.from_config(
                raw, metrics_config, run, measurements.directory / "bridge.checkpoint"
            )
            for index, y in enumerate([0.78, 0.69, 0.62, 0.52, 0.43, 0.30, 0.25]):
                media = index * 0.2
                frame = SimpleNamespace(
                    camera_id="222",
                    session=1,
                    sequence=index + 1,
                    media_time_s=media,
                    received_at=anchor + timedelta(seconds=media),
                    image=SimpleNamespace(shape=(720, 1280, 3)),
                )
                vehicles = [
                    SimpleNamespace(
                        track_id=121212,
                        label="car",
                        detection=SimpleNamespace(
                            x1=0.64 * 1280,
                            y1=(y - 0.04) * 720,
                            x2=0.66 * 1280,
                            y2=y * 720,
                        ),
                    )
                ]
                aggregate.observe(frame, metrics.update(frame, vehicles))
                bridge.observe(frame, vehicles)
            batches = aggregate.batches(run)
            for batch in batches:
                box.enqueue(batch)
            box.flush(limit=256)
            bridge.publish(run, batches, measurements)
            exact = [json.loads(path.read_bytes()) for path in measurements.pending()]
            for _ in range(3):
                measurements.flush(limit=256)
                if not measurements.pending():
                    break
            if box.pending() or measurements.pending():
                raise RuntimeError("Controlled delivery did not drain.")
        status, view = request("/api/measurements?camera=222&mode=replay")
        assert (
            status == 200
            and view["minutes"]
            and view["registry"]["physical_calibration_approved"] == approved
        )
        assert all(
            row["range_low_g"] is None and row["range_high_g"] is None
            for minute in view["minutes"]
            for row in minute["emissions"]
        )
        reasons = [reason for minute in view["minutes"] for reason in minute["reasons"]]
        if not approved:
            assert all(
                row["distance_m"] is None and row["queue_length_m"] is None
                for minute in view["minutes"]
                for row in minute["traffic"]
            )
            assert all(
                row["estimate_g"] is None
                for minute in view["minutes"]
                for row in minute["emissions"]
            )
            assert any("No server-approved calibration" in reason for reason in reasons)
            assert any(
                "No server-approved class mapping" in reason for reason in reasons
            )
        status, summary = request("/api/222-read?mode=replay")
        assert status == 200
        if not approved:
            assert summary["scenario"]["baseline"]["average_speed_m_s"] is None
        assert (
            summary["scenario"]["pollutants"]["co2"]["scenario_g"] is None
            and summary["scenario"]["pollutants"]["nox"]["scenario_g"] is None
        )
        assert request("/api/222-read?mode=live")[1]["traffic"]["rows"] == []
        public = json.dumps([view, summary])
        assert (
            '"session_id"' not in public
            and '"traversal_id"' not in public
            and str(profile) not in public
        )
        reference = view["evidence_refs"][0]
        assert request("/api/measurements/evidence?reference=" + reference)[0] == 401
        evidence = request(
            "/api/measurements/evidence?reference=" + reference, authenticated=True
        )[1]
        assert (evidence["approved_input"] is not None) == approved and evidence[
            "current"
        ]
        assert all(
            row["stopped_time_s"] is None for row in evidence["source"]["traversals"]
        )
        # Controlled inputs retain their exact wire envelopes; the actual replay
        # separately proves a lost-acknowledgement retry by its real outbox.
        for payload in exact:
            status, receipt = request("/api/measurements", payload, authenticated=True)
            assert status == 200 and receipt["duplicate"]
        if approved and not args.replay_file:
            assert view["scenario"]["completed_cohort"]["baseline"]["distance_m"] == 20
            assert all(
                value is not None and value > 0
                for value in summary["emissions"]["estimate_g_by_pollutant"].values()
            )
            unchanged = request("/api/measurements?camera=222&mode=replay&reduce=0")[1][
                "scenario"
            ]["pollutants"]
            assert all(
                row["baseline_g"] == row["scenario_g"] for row in unchanged.values()
            )
        assert request("/api/measurements/refresh", {}, authenticated=True)[0] == 200
        counters = request("/api/handoff-counters")[1]
        assert counters["dropped_acknowledgements"] == 1 and counters["duplicates"] >= 1
        before = {
            key: view[key]
            for key in ["minutes", "registry", "scenario", "evidence_refs"]
        }
        stop(server)
        server = None
        server, base = start()
        after = request("/api/measurements?camera=222&mode=replay")[1]
        assert {key: after[key] for key in before} == before
        completed = view["scenario"]["completed_cohort"]["count"]
        if not args.replay_file:
            assert (
                completed == 1
                and summary["traffic"]["totals"]["count"] == 1
                and view["scenario"]["completed_cohort"]["baseline"]["traversal_time_s"]
                > 0
            )
        result = {
            "check": "222_registry_handoff",
            "mode": "replay",
            "input_kind": (
                "actual_local_video_runtime"
                if args.replay_file
                else "controlled_trajectory_only_not_video"
            ),
            "registry_approval": calibration["approval"],
            "media_provenance": media_provenance,
            "class_mapping": raw["mapping_version"],
            "stopped_time_support": None,
            "completed_candidate_traversals": completed,
            "crossing_count": summary["traffic"]["totals"]["count"],
            "supported_candidate_duration_s": view["scenario"]["completed_cohort"][
                "baseline"
            ]["traversal_time_s"],
            "physical_outputs_all_null": all(
                row["estimate_g"] is None
                for minute in view["minutes"]
                for row in minute["emissions"]
            ),
            "baseline_estimated_g_by_pollutant": summary["emissions"][
                "estimate_g_by_pollutant"
            ],
            "positive_shorter_stop_scenario_unavailable": True,
            "unavailable_reasons": sorted(set(reasons)),
            "public_identity_boundary": True,
            "private_evidence_authentication": True,
            "live_rows": 0,
            "durable_reload_equal": True,
            "exact_controlled_retries": len(exact),
            "lost_acknowledgement_retry": counters,
            "registry_sha256": hashlib.sha256(
                (profile / "registry.json").read_bytes()
            ).hexdigest(),
            "limitations": [
                "Any supplied Carter approval is retained; this run creates no additional scientific approval.",
                "The fixed 20 m path and fleet mixture are modeling assumptions. Gate-pair candidates can include longer curved turns; manual traversal coverage remains unvalidated.",
                "Playback anchors are estimated media UTC, not original capture UTC.",
                "Actual replay counts/traversals are unvalidated candidate evidence, not new accuracy results.",
            ],
        }
        private_write(directory / "result.json", result)
        print(json.dumps({"directory": str(directory), "result": result}, indent=2))
    finally:
        stop(server)
        log.close()


if __name__ == "__main__":
    main()
