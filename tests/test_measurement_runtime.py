"""Synthetic runtime-adapter checks; no detector, source stream or real approval."""

import copy
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from worker.metrics import MetricsConfig
from worker.publish import (
    Outbox,
    PublishError,
    TraversalBridge,
    measurement_url,
    recover_measurement_outbox,
)
from worker.measurement import MeasurementBridge

NOW = datetime(2026, 11, 7, 20, 4, tzinfo=timezone.utc)


def settings():
    metrics = MetricsConfig.from_dict(
        {
            "camera_id": "222",
            "version": "synthetic-view",
            "enabled": True,
            "image_geometry_status": "reviewed",
            "road_region": [[0, 0], [1, 0], [1, 1], [0, 1]],
            "excluded_regions": [],
            "gates": [
                {
                    "id": "entry",
                    "start": [0.3, 1],
                    "end": [0.3, 0],
                    "direction": "positive",
                },
                {
                    "id": "exit",
                    "start": [0.7, 1],
                    "end": [0.7, 0],
                    "direction": "positive",
                },
            ],
        }
    )
    raw = {
        "bridge_version": "1.0",
        "enabled": True,
        "camera_id": "222",
        "context_version": "synthetic-context",
        "view_version": "synthetic-view",
        "calibration_version": "synthetic-calibration",
        "mapping_version": "synthetic-mapping",
        "meteorology": {"temperature_f": 70, "relative_humidity_pct": 60},
        "policy": {
            "max_gap_s": 2,
            "max_traversal_s": 120,
            "hysteresis": 0.01,
            "min_track_hits": 2,
        },
        "stop_observation": None,
        "movements": [
            {
                "movement_id": "entry-to-exit",
                "version": "synthetic-movement",
                "entry_gate_id": "entry",
                "exit_gate_id": "exit",
                "entry_direction": "positive",
                "exit_direction": "positive",
                "accepted": True,
                "calibration_version": "synthetic-calibration",
                "calibration_status": "valid",
                "calibration_evidence": "synthetic-only-not-field-evidence",
                "distance_m": 10,
                "distance_source": "synthetic-only",
            }
        ],
    }
    run = {
        "run_id": "synthetic-runtime-test",
        "model_version": "synthetic-no-model",
        "device": "test-only",
        "started_at": NOW.isoformat(),
        "ended_at": None,
        "mode": "synthetic",
    }
    return raw, metrics, run


def frame(media, received=None, session=1, camera="222"):
    return SimpleNamespace(
        camera_id=camera,
        session=session,
        media_time_s=media,
        received_at=received or NOW + timedelta(seconds=media),
        image=SimpleNamespace(shape=(100, 100, 3)),
    )


def vehicle(x, identity=123456789):
    return SimpleNamespace(
        track_id=identity,
        label="car",
        detection=SimpleNamespace(x1=x * 100 - 1, y1=40, x2=x * 100 + 1, y2=50),
    )


def complete(bridge):
    for time, x in enumerate([0.2, 0.4, 0.5, 0.5, 0.8, 0.9]):
        bridge.observe(frame(time), [vehicle(x)])


class RuntimeMeasurementTests(unittest.TestCase):
    def test_default_is_disabled_and_enabled_settings_require_reviewed_matching_geometry(
        self,
    ):
        self.assertIsNone(
            TraversalBridge.from_config(
                {"bridge_version": "1.0", "enabled": False}, None, {}
            )
        )
        with self.assertRaises(ValueError):
            TraversalBridge.from_config(
                {"bridge_version": "1.0", "enabled": 0}, None, {}
            )
        raw, metrics, run = settings()
        with self.assertRaises(ValueError):
            TraversalBridge.from_config(raw, None, run)
        for mutate in [
            lambda x: x.update(view_version="wrong"),
            lambda x: x["movements"][0].update(entry_direction="negative"),
            lambda x: x.update(stop_observation={}),
        ]:
            bad = copy.deepcopy(raw)
            mutate(bad)
            with self.assertRaises(ValueError):
                TraversalBridge.from_config(bad, metrics, run)

    def test_runtime_completed_event_queues_exact_v1_without_producer_distance_or_raw_tracker_id(
        self,
    ):
        raw, metrics, run = settings()
        with tempfile.TemporaryDirectory() as folder:
            outbox = Outbox(Path(folder), lambda _: False)
            bridge = TraversalBridge.from_config(
                raw, metrics, run, Path(folder) / "bridge.checkpoint"
            )
            complete(bridge)
            self.assertEqual(bridge.publish(run, outbox=outbox), 1)
            self.assertEqual(
                outbox.attempts, 0
            )  # Caller may flush only after durable commit.
            checkpoint = json.loads((Path(folder) / "bridge.checkpoint").read_text())
            self.assertIsNone(MeasurementBridge.restore(checkpoint).pending())
            body = outbox.pending()[0].read_text()
            payload = json.loads(body)
            self.assertEqual(payload["measurement_version"], "1.0")
            self.assertEqual(payload["timing"]["basis"], "estimated_hls_media_utc")
            self.assertEqual(len(payload["traversals"]), 1)
            self.assertIsNone(payload["traversals"][0]["stopped_time_s"])
            for private in [
                "123456789",
                "distance_m",
                "calibration_status",
                "raw_frame",
                "track_id",
                "provenance",
            ]:
                self.assertNotIn(private, body)
            self.assertEqual(bridge.publish(run, outbox=outbox), 0)
            self.assertEqual(len(outbox.pending()), 1)
            # POSIX mode bits do not describe Windows ACLs.
            if os.name == "posix":
                self.assertEqual(
                    (Path(folder) / "bridge.checkpoint").stat().st_mode & 0o777, 0o600
                )

    def test_linked_stop_intervals_require_explicit_policy_and_do_not_use_general_stopped_totals(
        self,
    ):
        raw, metrics, run = settings()
        raw["stop_observation"] = {
            "method_version": "synthetic-image-stop-v1",
            "image_displacement_per_s": 0.01,
            "review_evidence_refs": ["synthetic-motion-review-only"],
        }
        bridge = TraversalBridge.from_config(raw, metrics, run)
        complete(bridge)
        bridge.publish(run)
        state = bridge._bridge.checkpoint()["state"]
        traversal = next(iter(state["published"].values()))["traversals"][0]
        self.assertEqual(traversal["stopped_time_s"], 1)
        self.assertGreater(traversal["traversal_time_s"], traversal["stopped_time_s"])

    def test_anchor_correction_queues_old_retraction_before_new_minute_and_retains_observation_reference(
        self,
    ):
        raw, metrics, run = settings()
        with tempfile.TemporaryDirectory() as folder:
            outbox = Outbox(Path(folder), lambda _: False)
            bridge = TraversalBridge.from_config(
                raw, metrics, run, Path(folder) / "bridge.checkpoint"
            )
            complete(bridge)
            legacy = {
                "batch_id": "00000000-0000-4000-8000-000000000001",
                "revision": 0,
                "traffic": [{"minute": NOW.isoformat()}],
            }
            bridge.publish(run, [legacy], outbox)
            bridge.observe(
                frame(6, received=NOW - timedelta(seconds=4)), [vehicle(0.9)]
            )
            # A retract and replacement of the same legacy minute is one final reference update.
            legacy_retraction = {**legacy, "revision": 1, "traffic": []}
            legacy_update = {**legacy, "revision": 2}
            bridge.publish(run, [legacy_retraction, legacy_update], outbox)
            payloads = [json.loads(p.read_text()) for p in outbox.pending()]
            self.assertTrue(payloads[1]["retract"])
            self.assertEqual(payloads[2]["minute"], "2026-11-07T20:03:00.000000Z")
            self.assertEqual(sum(len(p["traversals"]) for p in payloads[2:]), 1)
            old = payloads[-1]
            self.assertEqual(
                old["observation_ref"], {"batch_id": legacy["batch_id"], "revision": 2}
            )
            self.assertEqual(old["traversals"], [])

    def test_partial_plan_enqueue_recovers_durably_before_any_sender_runs(self):
        raw, metrics, run = settings()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bridge.checkpoint"
            delivered = []
            first = Outbox(
                Path(folder),
                lambda body: delivered.append(json.loads(body)) or True,
                max_batches=1,
            )
            bridge = TraversalBridge.from_config(raw, metrics, run, path)
            complete(bridge)
            bridge.publish(run, outbox=first)
            first.flush()
            bridge.observe(
                frame(6, received=NOW - timedelta(seconds=4)), [vehicle(0.9)]
            )
            with self.assertRaises(PublishError):
                bridge.publish(run, outbox=first)
            pending = MeasurementBridge.restore(json.loads(path.read_text())).pending()
            self.assertIsNotNone(pending)
            self.assertEqual(len(first.pending()), 1)
            self.assertEqual(len(delivered), 1)
            recovered = Outbox(
                Path(folder), lambda body: delivered.append(json.loads(body)) or True
            )
            recover_measurement_outbox(recovered)
            self.assertEqual(recovered.pending(), [])
            self.assertIsNone(
                MeasurementBridge.restore(json.loads(path.read_text())).pending()
            )
            self.assertTrue(delivered[1]["retract"])
            self.assertFalse(delivered[2]["retract"])

    def test_retry_failure_preserves_checkpoint_and_queued_bytes_for_another_restart(
        self,
    ):
        raw, metrics, run = settings()
        with tempfile.TemporaryDirectory() as folder:
            outbox = Outbox(Path(folder), lambda _: False)
            bridge = TraversalBridge.from_config(
                raw, metrics, run, Path(folder) / "bridge.checkpoint"
            )
            complete(bridge)
            bridge.publish(run, outbox=outbox)
            before = outbox.pending()[0].read_bytes()
            with self.assertRaises(PublishError):
                recover_measurement_outbox(outbox)
            self.assertEqual(outbox.pending()[0].read_bytes(), before)
            (Path(folder) / "bridge.checkpoint").write_text("corrupt")
            attempts = outbox.attempts
            with self.assertRaises(PublishError):
                recover_measurement_outbox(outbox)
            self.assertEqual(outbox.attempts, attempts)

    def test_lost_track_and_reconnect_do_not_complete_a_cross_session_vehicle(self):
        raw, metrics, run = settings()
        bridge = TraversalBridge.from_config(raw, metrics, run)
        bridge.observe(frame(0), [vehicle(0.2)])
        bridge.observe(frame(1), [vehicle(0.4)])
        bridge.observe(frame(2), [])
        bridge.observe(frame(3), [vehicle(0.8)])
        bridge.observe(frame(0, session=2), [vehicle(0.9)])
        bridge.publish(run)
        self.assertEqual(bridge.diagnostic()["completed_traversals"], 0)
        with self.assertRaises(ValueError):
            bridge.observe(frame(1, camera="223"), [])

    def test_more_than_32_independent_sessions_in_different_minutes_are_retained(self):
        raw, metrics, run = settings()
        bridge = TraversalBridge.from_config(raw, metrics, run)
        for session in range(1, 35):
            for media, x in enumerate([0.2, 0.4, 0.5, 0.5, 0.8, 0.9]):
                bridge.observe(frame(media, received=NOW + timedelta(minutes=session, seconds=media), session=session), [vehicle(x)])
            bridge.publish(run)
        self.assertEqual(bridge.diagnostic()["session_count"], 34)
        self.assertEqual(bridge.diagnostic()["completed_traversals"], 34)
        self.assertEqual(len(bridge._bridge.checkpoint()["state"]["events"]), 34)
        self.assertEqual(len(bridge._bridge.checkpoint()["state"]["published"]), 34)

    def test_33_sessions_in_one_minute_still_fail_the_contract_bound_without_losing_evidence(self):
        raw, metrics, run = settings()
        bridge = TraversalBridge.from_config(raw, metrics, run)
        for session in range(1, 34):
            for media, x in enumerate([0.2, 0.4, 0.5, 0.5, 0.8, 0.9]):
                bridge.observe(frame(media, session=session), [vehicle(x)])
            if session <= 32:
                bridge.publish(run)
        before = bridge._bridge.checkpoint()
        with self.assertRaisesRegex(ValueError, "32"):
            bridge.publish(run)
        self.assertEqual(bridge._bridge.checkpoint(), before)
        self.assertEqual(len(bridge._new_events), 1)
        self.assertEqual(bridge.diagnostic()["completed_traversals"], 33)

    def test_repeated_config_cli_matches_cameras_and_rejects_ambiguous_or_duplicate_selection(self):
        from dataclasses import asdict
        from worker.main import load_measurement_configs, load_traversal_configs, parser

        raw, metrics, _ = settings()
        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            paths = []
            for camera in ("222", "223"):
                geometry = asdict(metrics)
                geometry["camera_id"] = camera
                path = directory / (camera + ".json")
                path.write_text(json.dumps(geometry))
                paths.append(path)
            base = ["--output", str(directory / "report.json")]
            options = ["--measurement-config", str(paths[1]), "--measurement-config", str(paths[0])]
            args = parser().parse_args(base + options + ["--count-gate-id", "222=entry", "--count-gate-id", "223=exit"])
            configs = load_measurement_configs(args, {"222", "223"})
            self.assertEqual(configs["222"]["count_gate_id"], "entry")
            self.assertEqual(configs["223"]["count_gate_id"], "exit")
            for invalid in [
                options + ["--count-gate-id", "entry"],
                options + ["--count-gate-id", "222=entry", "--count-gate-id", "222=exit"],
                options + ["--count-gate-id", "228=entry"],
                options + ["--measurement-config", str(paths[0])],
                ["--count-gate-id", "entry"],
            ]:
                with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                    load_measurement_configs(parser().parse_args(base + invalid), {"222", "223"})
            traversal = directory / "traversal.json"
            traversal.write_text(json.dumps({**raw, "camera_id": "228"}))
            args.traversal_config = [traversal]
            with self.assertRaises(ValueError):
                load_traversal_configs(args, configs)
            traversal.write_text(json.dumps({"bridge_version": "1.0", "enabled": 0}))
            with self.assertRaises(ValueError):
                load_traversal_configs(args, configs)

    def test_changing_camera_outbox_layout_cannot_hide_retained_checkpoint_or_retry(self):
        from worker.main import measurement_directories

        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "measurements"
            root.mkdir()
            legacy = root / "bridge.checkpoint"
            legacy.write_text("retained-private-checkpoint")
            before = legacy.read_bytes()
            self.assertEqual(measurement_directories(Path(folder), ["222"], False), {"222": root})
            with self.assertRaisesRegex(ValueError, "retains evidence"):
                measurement_directories(Path(folder), ["222", "223"], True)
            self.assertEqual(legacy.read_bytes(), before)
            legacy.unlink()
            camera = root / "223"
            camera.mkdir()
            retry = camera / "retained.json"
            retry.write_text("immutable-retry")
            for cameras, multiple in [(["222"], True), (["222"], False), ([], False)]:
                with self.subTest(cameras=cameras, multiple=multiple), self.assertRaisesRegex(ValueError, "retains evidence"):
                    measurement_directories(Path(folder), cameras, multiple)
            self.assertEqual(retry.read_text(), "immutable-retry")
            self.assertEqual(measurement_directories(Path(folder), ["222", "223"], True)["223"], camera)

    def test_main_two_independent_measurements_keep_other_cameras_unavailable(self):
        import contextlib
        import io
        import threading
        from dataclasses import asdict
        from worker.main import parser, run as run_worker

        raw, metrics, _ = settings()
        stopped, payloads = threading.Event(), []
        cameras = ("222", "223", "220", "228")
        points = [0.1, 0.2, 0.4, 0.5, 0.8, 0.9, 0.9, 0.9]
        sources = {}
        for camera in cameras:
            sources[camera] = []
            for sequence in range(len(points)):
                reconnect = camera == "222" and sequence >= 6
                current = frame(sequence - 6 if reconnect else sequence, received=NOW + timedelta(seconds=sequence), session=2 if reconnect else 1, camera=camera)
                current.sequence = sequence
                sources[camera].append(current)

        class Queue:
            def __init__(self, camera):
                self.camera = camera

            def get(self, timeout_s):
                current = sources[self.camera].pop(0) if sources[self.camera] else None
                if not any(sources.values()):
                    stopped.set()
                return current

        class Reader:
            def __init__(self, camera, **_kwargs):
                self.frames = Queue(camera.id)

            def start(self):
                pass

            def stop(self):
                pass

            def join(self, _timeout):
                pass

            def status(self):
                return SimpleNamespace(state="live", frames_kept=len(points), frames_dropped=0)

        class Device:
            type = "cpu"

            def __str__(self):
                return "cpu"

        model = SimpleNamespace(names={0: "car"}, predictor=SimpleNamespace(model=SimpleNamespace(model=SimpleNamespace(parameters=lambda: iter([SimpleNamespace(device=Device())])))))

        class Tracker:
            def __init__(self, **_kwargs):
                pass

            def update(self, current):
                return [vehicle(0.9 if current.session == 2 else points[current.sequence])]

        fake_torch = SimpleNamespace(set_num_threads=lambda _: None, cuda=SimpleNamespace(is_available=lambda: False), version=SimpleNamespace(cuda=None))

        def sender(url, _token, **_kwargs):
            return lambda body: payloads.append((url, json.loads(body))) or True

        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            weights = directory / "weights"
            weights.write_bytes(b"synthetic placeholder; never loaded")
            options = ["--seconds", "2", "--device", "cpu", "--weights", str(weights), "--output", str(directory / "report.json"), "--outbox", str(directory / "outbox"), "--require-delivery"]
            for camera in ("222", "223"):
                geometry = directory / (camera + "-image.json")
                geometry.write_text(json.dumps({**asdict(metrics), "camera_id": camera,
                    "queue_region": [[0.05, 0.05], [0.95, 0.05], [0.95, 0.95], [0.05, 0.95]],
                    "stopped_threshold_per_s": 0.01, "stopped_min_duration_s": 1}))
                traversal = directory / (camera + "-traversals.json")
                traversal.write_text(json.dumps({**raw, "camera_id": camera}))
                options += ["--measurement-config", str(geometry), "--count-gate-id", camera + "=entry", "--traversal-config", str(traversal)]
            modules = {"cv2": SimpleNamespace(), "torch": fake_torch, "worker.detect": SimpleNamespace(load_model=lambda _: model), "worker.track": SimpleNamespace(CameraTracker=Tracker), "worker.stream": SimpleNamespace(StreamReader=Reader)}
            environment = {"EMISSION_LENS_INGEST_URL": "http://localhost/api/worker", "EMISSION_LENS_MEASUREMENT_URL": "http://localhost/api/measurements", "EMISSION_LENS_WORKER_TOKEN": "controlled-test-token-no-service-access"}
            with patch.dict("sys.modules", modules), patch.dict("os.environ", environment), patch("worker.config.load_cameras", return_value=[SimpleNamespace(id=camera) for camera in cameras]), patch("worker.main.HttpSender", side_effect=sender), patch("importlib.metadata.version", return_value="controlled-test"), contextlib.redirect_stdout(io.StringIO()):
                report = run_worker(parser().parse_args(options), stopped)
            self.assertEqual(set(report["measurements"]["by_camera"]), {"222", "223"})
            for camera in ("222", "223"):
                self.assertEqual(report["completed_traversals"]["by_camera"][camera]["completed_traversals"], 1)
                self.assertEqual(report["measurements"]["by_camera"][camera]["selected_gate_crossings_by_class"], {"car": 1})
                self.assertTrue((directory / "outbox" / "measurements" / camera / "bridge.checkpoint").is_file())
                self.assertEqual(report["measurement_delivery"]["by_camera"][camera]["pending_batches"], 0)
                self.assertEqual(len(report["measurements"]["by_camera"][camera]["canonical_config_sha256"]), 64)
                self.assertEqual(len(report["measurements"]["by_camera"][camera]["selected_gate_sha256"]), 64)
            self.assertEqual(report["completed_traversals"]["by_camera"]["222"]["session_count"], 2)
            self.assertEqual(report["completed_traversals"]["by_camera"]["223"]["session_count"], 1)
            observations = [payload for url, payload in payloads if url.endswith("/worker") and payload["traffic"]]
            measurements = [payload for url, payload in payloads if url.endswith("/measurements")]
            self.assertEqual({row["camera_id"] for payload in observations for row in payload["traffic"]}, {"222", "223"})
            self.assertEqual({payload["camera_id"] for payload in measurements}, {"222", "223"})
            latest_rows = {payload["traffic"][0]["camera_id"]: payload["traffic"] for payload in observations}
            self.assertTrue(all(row["queue_count"] is None for row in latest_rows["222"]))
            self.assertEqual([row["queue_count"] for row in latest_rows["223"]], [1])
            refs = {(payload["batch_id"], payload["revision"]): payload for payload in observations}
            for payload in measurements:
                self.assertEqual(payload["mode"], "live")
                if payload["observation_ref"]:
                    linked = refs[(payload["observation_ref"]["batch_id"], payload["observation_ref"]["revision"])]
                    self.assertEqual({row["camera_id"] for row in linked["traffic"]}, {payload["camera_id"]})
            self.assertNotIn("123456789", json.dumps(measurements))

    def test_main_runtime_wires_the_opt_in_bridge_to_its_separate_sender(self):
        import contextlib
        import io
        import threading
        from dataclasses import asdict
        from worker.main import parser, run as run_worker

        raw, metrics, _ = settings()
        stopped = threading.Event()
        payloads = []
        points = [0.2, 0.4, 0.5, 0.5, 0.8, 0.9]
        source = []
        for sequence in range(len(points)):
            current = frame(sequence)
            current.sequence = sequence
            source.append(current)

        class Queue:
            def get(self, timeout_s):
                current = source.pop(0) if source else None
                if not source:
                    stopped.set()
                return current

        class Reader:
            def __init__(self, *_args, **_kwargs):
                self.frames = Queue()

            def start(self):
                pass

            def stop(self):
                pass

            def join(self, _timeout):
                pass

            def status(self):
                return SimpleNamespace(state="live", frames_kept=6, frames_dropped=0)

        class Device:
            type = "cpu"

            def __str__(self):
                return "cpu"

        backend = SimpleNamespace(
            model=SimpleNamespace(
                parameters=lambda: iter([SimpleNamespace(device=Device())])
            )
        )
        model = SimpleNamespace(
            names={0: "car"}, predictor=SimpleNamespace(model=backend)
        )

        class Tracker:
            def __init__(self, **_kwargs):
                pass

            def update(self, current):
                return [vehicle(points[current.sequence])]

        fake_torch = SimpleNamespace(
            set_num_threads=lambda _: None,
            cuda=SimpleNamespace(is_available=lambda: False),
            version=SimpleNamespace(cuda=None),
        )

        def sender(url, _token, **_kwargs):
            return lambda body: payloads.append((url, json.loads(body))) or True

        with tempfile.TemporaryDirectory() as folder:
            directory = Path(folder)
            geometry = directory / "geometry.json"
            geometry.write_text(json.dumps(asdict(metrics)))
            traversal = directory / "traversal.json"
            traversal.write_text(json.dumps(raw))
            weights = directory / "test-weights"
            weights.write_bytes(b"synthetic placeholder; never loaded")
            args = parser().parse_args(
                [
                    "--camera",
                    "222",
                    "--device",
                    "cpu",
                    "--seconds",
                    "2",
                    "--weights",
                    str(weights),
                    "--output",
                    str(directory / "report.json"),
                    "--outbox",
                    str(directory / "outbox"),
                    "--measurement-config",
                    str(geometry),
                    "--count-gate-id",
                    "entry",
                    "--traversal-config",
                    str(traversal),
                    "--require-delivery",
                ]
            )
            modules = {
                "cv2": SimpleNamespace(),
                "torch": fake_torch,
                "worker.detect": SimpleNamespace(load_model=lambda _: model),
                "worker.track": SimpleNamespace(CameraTracker=Tracker),
                "worker.stream": SimpleNamespace(StreamReader=Reader),
            }
            environment = {
                "EMISSION_LENS_INGEST_URL": "http://localhost/api/worker",
                "EMISSION_LENS_MEASUREMENT_URL": "http://localhost/api/measurements",
                "EMISSION_LENS_WORKER_TOKEN": "controlled-test-token-no-service-access",
            }
            with patch.dict("sys.modules", modules), patch.dict(
                "os.environ", environment
            ), patch(
                "worker.config.load_cameras", return_value=[SimpleNamespace(id="222")]
            ), patch(
                "worker.main.HttpSender", side_effect=sender
            ), patch(
                "importlib.metadata.version", return_value="controlled-test"
            ), contextlib.redirect_stdout(
                io.StringIO()
            ):
                report = run_worker(args, stopped)
            self.assertEqual(report["cameras"]["222"]["processed_frames"], 6)
            self.assertEqual(report["completed_traversals"]["completed_traversals"], 1)
            self.assertEqual(report["measurement_delivery"]["pending_batches"], 0)
            self.assertEqual(report["delivery"]["pending_batches"], 0)
            self.assertIn("|v:", report["run"]["model_version"])
            worker = [payload for url, payload in payloads if url.endswith("/worker")]
            measurements = [
                payload for url, payload in payloads if url.endswith("/measurements")
            ]
            self.assertTrue(worker)
            self.assertTrue(measurements)
            self.assertTrue(
                all(payload["contract_version"] == "1.1" for payload in worker)
            )
            self.assertTrue(
                all(payload["measurement_version"] == "1.0" for payload in measurements)
            )
            self.assertEqual(len(measurements[-1]["traversals"]), 1)
            self.assertNotIn("123456789", json.dumps(measurements))

    def test_measurement_route_derivation_discards_private_query(self):
        self.assertEqual(
            measurement_url("https://example.test/api/worker?private=value"),
            "https://example.test/api/measurements",
        )
        with self.assertRaises(ValueError):
            measurement_url("https://example.test/custom")


if __name__ == "__main__":
    unittest.main()
