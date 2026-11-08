"""Terminal run metadata must not overtake immutable open-run measurements."""

import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import uuid

from worker.delivery import BackgroundDelivery, finish_delivery
from worker.publish import Outbox, PublishError


def payload(ended_at=None):
    return {"batch_id": str(uuid.uuid4()), "revision": 0,
            "run": {"run_id": "shutdown-test", "ended_at": ended_at}}


class ShutdownDeliveryTests(unittest.TestCase):
    def test_open_measurements_drain_before_terminal_core_closes_run(self):
        closed = False
        accepted = []
        entered, release = threading.Event(), threading.Event()

        def core_sender(body):
            nonlocal closed
            value = json.loads(body)
            if not accepted:
                entered.set()
                release.wait(2)
            closed = value["run"]["ended_at"] is not None
            accepted.append(("core", value["run"]["ended_at"]))
            return True

        def measurement_sender(body):
            ended_at = json.loads(body)["run"]["ended_at"]
            if closed and ended_at is None:
                raise PublishError("An ended run cannot reopen or change end time.")
            accepted.append(("measurement", ended_at))
            return True

        with tempfile.TemporaryDirectory() as folder:
            core = Outbox(Path(folder) / "core", core_sender)
            measurements = Outbox(Path(folder) / "measurements", measurement_sender)
            core.enqueue(payload())
            measurements.enqueue(payload())
            delivery = BackgroundDelivery(core, {"222": measurements}, retry_interval_s=.01)
            self.assertTrue(entered.wait(1))
            terminal_called, finished = threading.Event(), threading.Event()
            errors = []

            def terminal(replacement):
                terminal_called.set()
                core.enqueue(payload("2026-11-08T14:50:00Z"))
                measurements.enqueue(payload("2026-11-08T14:50:00Z"))
                replacement.notify()

            def finish():
                try:
                    finish_delivery(delivery, terminal, timeout_s=2)
                except Exception as error:
                    errors.append(error)
                finally:
                    finished.set()

            waiter = threading.Thread(target=finish)
            waiter.start()
            self.assertFalse(terminal_called.wait(.03))
            release.set()
            waiter.join(3)
            self.assertTrue(finished.is_set())
            self.assertEqual(errors, [])
            self.assertEqual(accepted, [("core", None), ("measurement", None),
                                        ("core", "2026-11-08T14:50:00Z"),
                                        ("measurement", "2026-11-08T14:50:00Z")])
            self.assertEqual(core.pending(), [])
            self.assertEqual(measurements.pending(), [])
            # The same fake backend rejects the old core-first shutdown order.
            with self.assertRaisesRegex(PublishError, "cannot reopen"):
                measurement_sender(json.dumps(payload()).encode())

    def test_failed_open_measurement_retains_exact_body_without_terminal_publication(self):
        called = []
        with tempfile.TemporaryDirectory() as folder:
            core = Outbox(Path(folder) / "core", lambda _: True)
            def reject(_):
                raise PublishError("controlled rejection")
            measurements = Outbox(Path(folder) / "measurements", reject)
            measurements.enqueue(payload())
            expected = measurements.pending()[0].read_bytes()
            delivery = BackgroundDelivery(core, {"222": measurements}, retry_interval_s=.01)
            with self.assertRaises(PublishError):
                finish_delivery(delivery, lambda _: called.append(True), timeout_s=1)
            self.assertEqual(called, [])
            self.assertEqual(measurements.pending()[0].read_bytes(), expected)
            self.assertTrue(delivery.close(1))

    def test_deadline_withholds_terminal_and_prevents_later_http_leases(self):
        entered, release = threading.Event(), threading.Event()
        posted, terminal = [], []
        with tempfile.TemporaryDirectory() as folder:
            def sender(body):
                posted.append(body)
                entered.set()
                release.wait(2)
                return True
            core = Outbox(Path(folder) / "core", sender)
            core.enqueue(payload())
            core.enqueue(payload())
            original = [path.read_bytes() for path in core.pending()]
            delivery = BackgroundDelivery(core, retry_interval_s=.01)
            self.assertTrue(entered.wait(1))
            started = time.monotonic()
            try:
                with self.assertRaises(PublishError):
                    finish_delivery(delivery, lambda _: terminal.append(True), timeout_s=.03)
                self.assertLess(time.monotonic() - started, .3)
                self.assertEqual(terminal, [])
                self.assertEqual([path.read_bytes() for path in core.pending()], original)
            finally:
                release.set()
                self.assertTrue(delivery.close(1))
            self.assertEqual(posted, original[:1])
            self.assertEqual([path.read_bytes() for path in core.pending()], original[1:])

    def test_terminal_phase_uses_the_same_deadline(self):
        posted = []
        with tempfile.TemporaryDirectory() as folder:
            core = Outbox(Path(folder) / "core", lambda body: posted.append(body) or True)
            delivery = BackgroundDelivery(core, retry_interval_s=.01)
            def slow_terminal(replacement):
                time.sleep(.06)
                core.enqueue(payload("2026-11-08T14:50:00Z"))
                replacement.notify()
            with self.assertRaises(PublishError):
                finish_delivery(delivery, slow_terminal, timeout_s=.03)
            self.assertEqual(posted, [])
            self.assertEqual(len(core.pending()), 1)


if __name__ == "__main__":
    unittest.main()
