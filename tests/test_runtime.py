import unittest
import threading
import time
import json
import base64
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch

from worker.main import CameraProgress, DeviceModel, PreviewPublisher, encode_preview, envelope, preview_url


NOW = datetime(2026, 11, 7, 23, 0, tzinfo=timezone.utc)


def frame(camera="222", session=1, media=0.2, received=NOW):
    return SimpleNamespace(camera_id=camera, session=session, sequence=1, media_time_s=media, received_at=received)


class RuntimeTests(unittest.TestCase):
    def test_camera_state_is_independent_and_reconnect_media_restarts(self):
        first, second = CameraProgress("222"), CameraProgress("223")
        car = SimpleNamespace(label="car")
        first.observe(frame(), [car, car], 0.01, NOW, 1)
        first.observe(frame(session=2, media=0.1), [car], 0.02, NOW, 2)
        self.assertEqual((first.frames, second.frames), (2, 0))
        self.assertEqual(first.observations["car"], 3)
        self.assertEqual(first.sessions, {1, 2})
        with self.assertRaisesRegex(ValueError, "different camera"):
            second.observe(frame(), [], 0.01, NOW, 3)

    def test_duplicate_media_does_not_refresh_progress(self):
        progress = CameraProgress("222")
        progress.observe(frame(), [], 0.01, NOW, 1)
        with self.assertRaisesRegex(ValueError, "advancing"):
            progress.observe(frame(), [], 0.01, NOW + timedelta(seconds=5), 6)
        self.assertEqual(progress.last_processed_at, NOW)
        self.assertEqual(progress.frames, 1)

    def test_status_ages_processing_and_receipt_not_just_reader(self):
        progress = CameraProgress("222")
        reader = SimpleNamespace(state="live")
        self.assertEqual(progress.status(reader, "live", NOW, 0)["state"], "offline")
        progress.observe(frame(), [], 0.01, NOW, 1)
        self.assertEqual(progress.status(reader, "live", NOW, 1)["state"], "live")
        self.assertEqual(progress.status(reader, "live", NOW + timedelta(seconds=21), 22)["state"], "degraded")
        self.assertEqual(progress.status(reader, "live", NOW + timedelta(seconds=61), 62)["state"], "offline")
        self.assertEqual(progress.status(reader, "live", NOW, 1, ended=True)["state"], "offline")

    def test_processing_old_buffered_frame_cannot_make_source_live(self):
        progress = CameraProgress("222")
        progress.observe(frame(received=NOW - timedelta(seconds=61)), [], 0.01, NOW, 1)
        self.assertEqual(progress.status(SimpleNamespace(state="live"), "live", NOW, 1)["state"], "offline")

    def test_capture_time_latency_and_unconfigured_metrics_stay_null(self):
        progress = CameraProgress("222")
        progress.observe(frame(), [SimpleNamespace(label="truck")], 0.01, NOW, 1)
        status = progress.status(SimpleNamespace(state="live"), "replay", NOW, 1)
        self.assertIsNone(status["last_source_timestamp"])
        self.assertIsNone(status["processing_delay_ms"])
        batch = envelope({"run_id": "run", "mode": "replay"}, [status], [])
        self.assertEqual({batch["run"]["mode"], status["mode"]}, {"replay"})
        self.assertEqual(batch["traffic"], [])
        self.assertEqual(batch["emissions"], [])

    def test_device_adapter_does_not_replace_trackers_or_save_imagery(self):
        calls = []
        model = SimpleNamespace(names={2: "car"}, track=lambda image, **kwargs: calls.append((image, kwargs)) or [])
        adapter = DeviceModel(model, "0")
        adapter.track("image", persist=True, imgsz=640)
        self.assertEqual(calls[0][1], {"persist": True, "imgsz": 640, "device": "0", "save": False})

    def test_heartbeat_is_last_processed_frame_not_publish_clock(self):
        progress = CameraProgress("222")
        progress.observe(frame(), [], 0.01, NOW, 1)
        status = progress.status(SimpleNamespace(state="live"), "live", NOW + timedelta(seconds=15), 16)
        self.assertEqual(status["heartbeat_at"], NOW.isoformat())

    def test_preview_uses_matching_frame_overlay_and_bounded_jpeg(self):
        calls = []
        source = SimpleNamespace(shape=(720, 1280, 3))
        canvas = SimpleNamespace(shape=(720, 1280, 3))
        resized = SimpleNamespace(shape=(540, 960, 3))
        def draw(image, vehicles, banner):
            self.assertIs(image, source)
            self.assertEqual(vehicles, ["matching vehicle"])
            self.assertIn("REPLAY camera 222 session 1", banner)
            self.assertIn("RECEIVED", banner)
            return canvas
        fake_cv2 = SimpleNamespace(
            INTER_AREA=3, IMWRITE_JPEG_QUALITY=1,
            resize=lambda image, size, **kwargs: calls.append((image, size)) or resized,
            imencode=lambda extension, image, settings: calls.append((extension, image, settings)) or (True, SimpleNamespace(tobytes=lambda: b"jpeg")),
        )
        current = frame()
        current.image = source
        with patch.dict("sys.modules", {"cv2": fake_cv2, "worker.live_view": SimpleNamespace(draw=draw)}):
            payload = encode_preview(current, ["matching vehicle"], "run-1", "replay", NOW)
        self.assertEqual(calls[0], (canvas, (960, 540)))
        self.assertEqual(calls[1], (".jpg", resized, [1, 65]))
        self.assertEqual(base64.b64decode(payload.pop("jpeg_base64")), b"jpeg")
        self.assertEqual(payload, {"camera_id": "222", "mode": "replay", "run_id": "run-1", "session": 1, "sequence": 1, "received_at": NOW.isoformat(), "processed_at": NOW.isoformat()})

    def test_preview_http_does_not_block_processing_and_is_throttled(self):
        entering, release, delivered = threading.Event(), threading.Event(), threading.Event()
        encoded = []
        def encoder(current, *_):
            encoded.append(current.sequence)
            return {"camera_id": current.camera_id, "sequence": current.sequence}
        def sender(body):
            entering.set()
            release.wait(1)
            self.assertEqual(json.loads(body), {"camera_id": "222", "sequence": 1})
            delivered.set()
            return True
        previews = PreviewPublisher(sender, 3, encoder)
        try:
            current = frame()
            previews.submit(current, [], "run", "live", NOW, 0)
            self.assertTrue(entering.wait(1))
            current.sequence = 2
            previews.submit(current, [], "run", "live", NOW, 1)
            self.assertEqual(encoded, [1])
            self.assertFalse(delivered.is_set())
            release.set()
            self.assertTrue(delivered.wait(1))
        finally:
            release.set()
            previews.close()
        self.assertEqual(previews.diagnostic(), {"sent_by_camera": {"222": 1}, "failure_count_by_camera": {}})

    def test_preview_delivery_failures_are_best_effort_without_outbox(self):
        def sender(_):
            raise RuntimeError("Do not expose private endpoint details")
        previews = PreviewPublisher(sender, 3, encoder=lambda *_: {"camera_id": "222"})
        try:
            previews.submit(frame(), [], "run", "live", NOW, 0)
            deadline = time.monotonic() + 1
            while not previews.diagnostic()["failure_count_by_camera"] and time.monotonic() < deadline:
                time.sleep(0.01)
        finally:
            previews.close()
        self.assertEqual(previews.diagnostic()["failure_count_by_camera"], {"222": 1})

    def test_preview_endpoint_drops_ingest_query_parameters(self):
        self.assertEqual(preview_url("https://example.test/api/worker?private=value"), "https://example.test/api/frames")
        with self.assertRaises(ValueError):
            preview_url("https://example.test/custom-ingest")


if __name__ == "__main__":
    unittest.main()
