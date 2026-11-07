"""Scalar benchmark diagnostic checks; no model, camera or GPU required."""

import argparse
from datetime import datetime, timezone
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from evaluation.benchmark import CameraSample, percentile, positive_finite, run


class BenchmarkTests(unittest.TestCase):
    def frame(self, session, media):
        return SimpleNamespace(session=session, media_time_s=media,
                               received_at=datetime.fromtimestamp(100, timezone.utc))

    def test_sessions_do_not_create_a_false_cross_session_media_span(self):
        sample = CameraSample()
        for session, media in [(1, 100), (1, 102), (2, 0), (2, 3)]:
            sample.add(self.frame(session, media), [], 5, 100.1)
        result = sample.summary(10)
        self.assertEqual(result["processed_media_span_s"], 5)
        self.assertEqual(result["processed_wall_fps"], 0.4)
        self.assertEqual([row["frames"] for row in result["sessions"]], [2, 2])

    def test_repeated_tracked_boxes_are_only_observations(self):
        first, second = CameraSample(), CameraSample()
        vehicle = SimpleNamespace(label="car", track_id=1)
        first.add(self.frame(1, 0), [vehicle], 4, 100.5)
        first.add(self.frame(1, 1), [vehicle], 8, 100.5)
        second.add(self.frame(1, 0), [], 2, 100.1)
        result = first.summary(1)
        self.assertEqual(result["tracked_box_observations_by_class"], {"car": 2})
        self.assertEqual(second.summary(1)["tracked_box_observations_by_class"], {})
        self.assertNotIn("unique_vehicles", result)
        self.assertNotIn("count", result)
        self.assertEqual(result["median_receipt_to_processing_ms"], 500)

    def test_missing_frames_have_null_timings_instead_of_zero_latency(self):
        result = CameraSample().summary(10)
        self.assertEqual(result["frames_processed"], 0)
        self.assertIsNone(result["median_tracking_wall_ms"])
        self.assertIsNone(result["p95_tracking_wall_ms"])
        self.assertIsNone(result["median_receipt_to_processing_ms"])

    def test_nonadvancing_frames_and_gaps_are_explicit(self):
        sample = CameraSample()
        for media in (1, 1, 3):
            sample.add(self.frame(1, media), [], 5, 100)
        self.assertEqual(sample.summary(1)["nonadvancing_frames"], 1)
        self.assertEqual(sample.summary(1)["sessions"][0]["maximum_media_gap_s"], 2)

    def test_percentile_handles_single_and_empty_samples(self):
        self.assertIsNone(percentile([], 0.95))
        self.assertEqual(percentile([7], 0.95), 7)
        self.assertAlmostEqual(percentile([1, 9], 0.95), 8.6)

    def test_cli_rejects_non_finite_and_non_positive_limits(self):
        for value in ("nan", "inf", "-inf", "0", "-2"):
            with self.subTest(value=value), self.assertRaises(argparse.ArgumentTypeError):
                positive_finite(value)
        self.assertEqual(positive_finite("5"), 5)


class BenchmarkRuntimeTests(unittest.TestCase):
    def fake_runtime(self, missing_camera=None):
        cameras = [SimpleNamespace(id=str(i), stream_url=f"https://example.test/{i}") for i in (220, 222, 223, 228)]
        models, trackers, readers = [], [], []

        class Model:
            def __init__(self):
                self.overrides = {}
                backend = SimpleNamespace(parameters=lambda: iter([SimpleNamespace(device="cuda:0")]))
                self.predictor = SimpleNamespace(model=SimpleNamespace(model=backend))
                models.append(self)

            def to(self, device):
                self.device = device

        class Reader:
            def __init__(self, camera, target_fps):
                self.camera = camera
                self.frames = SimpleNamespace(get=self.get)
                self.sequence = 0
                self.alive = False
                readers.append(self)

            def get(self, timeout_s):
                if self.camera.id == missing_camera:
                    return None
                self.sequence += 1
                return SimpleNamespace(session=1, media_time_s=self.sequence / 5,
                                       received_at=datetime.now(timezone.utc))

            def start(self):
                self.alive = True

            def stop(self):
                self.alive = False

            def join(self, timeout):
                pass

            def is_alive(self):
                return self.alive

            def status(self):
                return SimpleNamespace(state="live", session=1, frames_kept=self.sequence, frames_dropped=0)

        class Tracker:
            def __init__(self, model, image_size):
                self.model = model
                trackers.append(self)

            def update(self, frame):
                return [SimpleNamespace(label="car")]

        cuda = SimpleNamespace(is_available=lambda: True, set_device=lambda _: None,
                               reset_peak_memory_stats=lambda _: None, synchronize=lambda _: None,
                               max_memory_allocated=lambda _: 1024**2, get_device_name=lambda _: "Test GPU")
        modules = {
            "torch": SimpleNamespace(cuda=cuda, set_num_threads=lambda _: None, version=SimpleNamespace(cuda="test")),
            "worker.config": SimpleNamespace(load_cameras=lambda: cameras),
            "worker.detect": SimpleNamespace(load_model=lambda _: Model()),
            "worker.stream": SimpleNamespace(StreamReader=Reader),
            "worker.track": SimpleNamespace(CameraTracker=Tracker),
        }
        return modules, models, trackers, readers

    def test_runtime_measures_every_camera_with_independent_trackers_and_stops_readers(self):
        modules, models, trackers, readers = self.fake_runtime()
        with tempfile.TemporaryDirectory() as directory:
            weights = Path(directory) / "test.pt"
            weights.write_bytes(b"test model")
            args = SimpleNamespace(camera=None, threads=1, device=0, weights=str(weights),
                                   image_size=640, fps=5, seconds=0.02, startup_timeout=0.1)
            with patch.dict("sys.modules", modules), patch("evaluation.benchmark.version", return_value="test"):
                result = run(args)
        self.assertTrue(result["success"])
        self.assertEqual(len(models), 4)
        self.assertEqual(len({id(tracker.model) for tracker in trackers}), 4)
        self.assertTrue(all(not reader.alive for reader in readers))
        self.assertTrue(all(row["frames_processed"] >= 2 for row in result["cameras"].values()))
        self.assertEqual(set(result["warmup_frames_excluded_per_camera"].values()), {1})
        self.assertEqual(result["peak_torch_allocated_mib"], 1)

    def test_missing_camera_is_a_failed_benchmark_with_diagnostics_and_cleanup(self):
        modules, _, _, readers = self.fake_runtime(missing_camera="223")
        with tempfile.TemporaryDirectory() as directory:
            weights = Path(directory) / "test.pt"
            weights.write_bytes(b"test model")
            args = SimpleNamespace(camera=None, threads=1, device=0, weights=str(weights),
                                   image_size=640, fps=5, seconds=0.02, startup_timeout=0.01)
            with patch.dict("sys.modules", modules), patch("evaluation.benchmark.version", return_value="test"):
                result = run(args)
        self.assertFalse(result["success"])
        self.assertIn("223", result["failure"])
        self.assertEqual(result["cameras"]["223"]["frames_processed"], 0)
        self.assertTrue(all(not reader.alive for reader in readers))


if __name__ == "__main__":
    unittest.main()
