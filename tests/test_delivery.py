"""Controlled delivery concurrency; no source media, inference or approvals."""

import json
from pathlib import Path
import tempfile
import threading
import unittest
import uuid

from worker.delivery import BackgroundDelivery
from worker.publish import Outbox, PublishError


def batch(revision=0, batch_id=None):
    return {"batch_id": batch_id or str(uuid.uuid4()), "revision": revision, "traffic": []}


class DeliveryTests(unittest.TestCase):
    def test_new_measurement_after_core_empty_check_waits_for_next_core_drain(self):
        # Force the scheduling boundary: pending() observed no core evidence,
        # then the producer committed new core + dependent measurement bytes.
        posted = []
        with tempfile.TemporaryDirectory() as folder:
            core = Outbox(Path(folder) / "core", lambda body: posted.append(("core", body)) or True)
            measurement = Outbox(Path(folder) / "measurements", lambda body: posted.append(("measurement", body)) or True)
            delivery = object.__new__(BackgroundDelivery)
            delivery.core, delivery.measurements = core, {"222": measurement}
            delivery._lock, delivery._halt, delivery._deadline = threading.Lock(), False, None
            original_pending, original_flush = core.pending, core.flush
            injected = []
            def raced_empty_check():
                observed = original_pending()
                if not injected:
                    injected.append(True)
                    core.pending = original_pending
                    core.enqueue(batch())
                    measurement.enqueue(batch())
                return observed
            core.flush = lambda **_: 0
            core.pending = raced_empty_check
            self.assertEqual(delivery._pass(), 0)
            self.assertEqual(posted, [])
            core.flush = original_flush
            self.assertEqual(delivery._pass(), 2)
            self.assertEqual([kind for kind, _ in posted], ["core", "measurement"])

    def test_slow_core_http_does_not_block_producer_and_measurements_follow_observations(self):
        entered, release = threading.Event(), threading.Event()
        delivered = []
        with tempfile.TemporaryDirectory() as folder:
            def send_core(body):
                entered.set()
                release.wait(2)
                delivered.append(("core", json.loads(body)))
                return True
            core = Outbox(Path(folder) / "core", send_core)
            measurement = Outbox(Path(folder) / "measurements", lambda body: delivered.append(("measurement", json.loads(body))) or True)
            first, second, dependent = batch(), batch(), batch()
            core.enqueue(first)
            measurement.enqueue(dependent)
            delivery = BackgroundDelivery(core, {"222": measurement}, retry_interval_s=.01)
            try:
                delivery.notify()
                self.assertTrue(entered.wait(1))
                core.enqueue(second)
                delivery.notify()
                self.assertEqual(delivered, [])
                self.assertEqual(len(core.pending()), 2)
            finally:
                release.set()
                self.assertTrue(delivery.close(2))
            self.assertEqual(delivered, [("core", first), ("core", second), ("measurement", dependent)])
            self.assertEqual(delivery.diagnostic()["failure_type"], None)

    def test_retry_preserves_fifo_bytes_and_does_not_release_dependent_evidence(self):
        failed, recover = threading.Event(), threading.Event()
        attempts, dependent = [], []
        with tempfile.TemporaryDirectory() as folder:
            def sender(body):
                attempts.append(body)
                failed.set()
                return recover.is_set()
            core = Outbox(Path(folder) / "core", sender)
            measurement = Outbox(Path(folder) / "measurements", lambda body: dependent.append(body) or True)
            payload = batch()
            core.enqueue(payload)
            expected = core.pending()[0].read_bytes()
            measurement.enqueue(batch())
            delivery = BackgroundDelivery(core, {"222": measurement}, retry_interval_s=.01)
            try:
                self.assertTrue(failed.wait(1))
                self.assertEqual(dependent, [])
                self.assertEqual(core.pending()[0].read_bytes(), expected)
                recover.set()
                delivery.notify()
            finally:
                recover.set()
                self.assertTrue(delivery.close(2))
            self.assertGreaterEqual(len(attempts), 2)
            self.assertTrue(all(body == expected for body in attempts))
            self.assertEqual(len(dependent), 1)

    def test_failed_measurement_publication_remains_unsent_until_recovered(self):
        posted = []
        with tempfile.TemporaryDirectory() as folder:
            core = Outbox(Path(folder) / "core", lambda _: True)
            measurement = Outbox(Path(folder) / "measurements", lambda body: posted.append(body) or True)
            with self.assertRaises(OSError):
                with measurement.publication():
                    measurement.enqueue(batch())
                    raise OSError("controlled checkpoint failure")
            delivery = BackgroundDelivery(core, {"222": measurement}, retry_interval_s=.01)
            delivery.notify()
            delivery.close(.05)  # A blocked retained plan consumes the grace bound.
            self.assertTrue(delivery.close(1))
            self.assertEqual(posted, [])
            self.assertEqual(len(measurement.pending()), 1)
            with measurement.publication():
                pass
            resumed = BackgroundDelivery(core, {"222": measurement}, retry_interval_s=.01)
            self.assertTrue(resumed.close(1))
            self.assertEqual(len(posted), 1)

    def test_fatal_rejection_is_private_and_retains_exact_body(self):
        rejected = threading.Event()
        with tempfile.TemporaryDirectory() as folder:
            def reject(_):
                rejected.set()
                raise PublishError("private endpoint secret must not escape")
            core = Outbox(Path(folder), reject)
            core.enqueue(batch())
            before = core.pending()[0].read_bytes()
            delivery = BackgroundDelivery(core, retry_interval_s=.01)
            self.assertTrue(rejected.wait(1))
            self.assertTrue(delivery.close(1))
            with self.assertRaises(PublishError) as caught:
                delivery.raise_if_failed()
            self.assertNotIn("secret", str(caught.exception))
            self.assertEqual(core.pending()[0].read_bytes(), before)
            self.assertEqual(delivery.diagnostic()["failure_type"], "PublishError")

    def test_close_bound_retains_inflight_then_prevents_any_later_request(self):
        entered, release = threading.Event(), threading.Event()
        posted = []
        with tempfile.TemporaryDirectory() as folder:
            def sender(body):
                posted.append(body)
                entered.set()
                release.wait(2)
                return True
            core = Outbox(Path(folder), sender)
            core.enqueue(batch())
            core.enqueue(batch())
            delivery = BackgroundDelivery(core, retry_interval_s=.01)
            self.assertTrue(entered.wait(1))
            try:
                self.assertFalse(delivery.close(.02))
                self.assertEqual(len(core.pending()), 2)
            finally:
                release.set()
                self.assertTrue(delivery.close(1))
            self.assertEqual(len(posted), 1)
            self.assertEqual(len(core.pending()), 1)


if __name__ == "__main__":
    unittest.main()
