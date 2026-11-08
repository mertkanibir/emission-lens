import json
import threading
import time
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from worker.main import PreviewPublisher


class Image:
    def __init__(self, value): self.value = value
    def copy(self): return Image(self.value)


class BackgroundPreviewTests(unittest.TestCase):
    def test_blocked_encoder_cannot_block_processing_and_pending_frames_stay_bounded(self):
        entered, release, done = threading.Event(), threading.Event(), threading.Event()
        sent = []
        owner = threading.get_ident()
        now = datetime.now(timezone.utc)
        def encoder(frame, vehicles, *_):
            self.assertNotEqual(threading.get_ident(), owner)
            if frame.sequence == 1:
                entered.set()
                release.wait(2)
            return {"sequence": frame.sequence, "pixel": frame.image.value, "vehicles": len(vehicles)}
        def sender(body):
            sent.append(json.loads(body))
            if len(sent) == 2: done.set()
            return True
        p = PreviewPublisher(sender, .2, encoder)
        try:
            frame = SimpleNamespace(camera_id="222", sequence=1, image=Image(1))
            vehicles = ["car"]
            started = time.monotonic()
            p.submit(frame, vehicles, "run", "live", now, 0)
            self.assertLess(time.monotonic() - started, .1)
            self.assertTrue(entered.wait(1))
            frame.image.value = 99
            vehicles.append("truck")
            frame.sequence, frame.image = 2, Image(2)
            p.submit(frame, vehicles, "run", "live", now, .2)
            frame.sequence, frame.image = 3, Image(3)
            p.submit(frame, vehicles, "run", "live", now, .4)
            self.assertEqual(len(p._pending), 1)
            release.set()
            self.assertTrue(done.wait(2))
        finally:
            release.set()
            p.close()
        self.assertEqual(sent, [{"sequence": 1, "pixel": 1, "vehicles": 1}, {"sequence": 3, "pixel": 3, "vehicles": 2}])
