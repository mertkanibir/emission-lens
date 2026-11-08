import json
import tempfile
import threading
import unittest
import uuid
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from worker.publish import HttpSender, Outbox, PublishError


def batch():
    return {"contract_version": "1.1", "batch_id": str(uuid.uuid4()), "revision": 0, "run": {"run_id": str(uuid.uuid4()), "mode": "live"}, "statuses": [], "traffic": [], "emissions": []}


class PublishTests(unittest.TestCase):
    def test_transient_failure_and_restart_retry_identical_batch(self):
        with tempfile.TemporaryDirectory() as folder:
            attempts = []
            def offline(body):
                attempts.append(body)
                return False
            first = Outbox(Path(folder), offline)
            payload = batch()
            first.enqueue(payload)
            self.assertEqual(first.flush(), 0)
            self.assertEqual(len(first.pending()), 1)
            delivered = []
            second = Outbox(Path(folder), lambda body: delivered.append(body) or True)
            self.assertEqual(second.flush(), 1)
            self.assertEqual(delivered, attempts)
            self.assertEqual(json.loads(delivered[0])["batch_id"], payload["batch_id"])
            self.assertEqual(second.pending(), [])

    def test_outbox_fails_closed_at_capacity(self):
        with tempfile.TemporaryDirectory() as folder:
            outbox = Outbox(Path(folder), lambda _: False, max_batches=1)
            first = batch()
            outbox.enqueue(first)
            with self.assertRaisesRegex(PublishError, "full"):
                outbox.enqueue(batch())
            self.assertEqual(len(outbox.pending()), 1)
            self.assertEqual(json.loads(outbox.pending()[0].read_text()), first)

    def test_fifo_does_not_send_newer_batch_after_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            attempts = []
            outbox = Outbox(Path(folder), lambda body: attempts.append(json.loads(body)) or False)
            first, second = batch(), batch()
            outbox.enqueue(first)
            outbox.enqueue(second)
            outbox.flush()
            self.assertEqual(attempts, [first])

    def test_same_queued_id_is_idempotent_but_changed_content_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            outbox = Outbox(Path(folder), lambda _: True)
            payload = batch()
            outbox.enqueue(payload)
            outbox.enqueue(payload)
            self.assertEqual(len(outbox.pending()), 1)
            payload["traffic"] = [{"changed": True}]
            with self.assertRaisesRegex(PublishError, "different content"):
                outbox.enqueue(payload)

    def test_retraction_stays_before_replacement_after_restart_and_clock_step_back(self):
        with tempfile.TemporaryDirectory() as folder:
            retract = batch()
            replacement = {**retract, "revision": 1, "traffic": [{"count": 1}]}
            with patch("time.time_ns", return_value=2000):
                Outbox(Path(folder), lambda _: False).enqueue(retract)
            delivered = []
            restarted = Outbox(Path(folder), lambda body: delivered.append(json.loads(body)) or True)
            with patch("time.time_ns", return_value=1000):
                restarted.enqueue(replacement)
            self.assertEqual(restarted.flush(), 2)
            self.assertEqual(delivered, [retract, replacement])

    def test_multiple_cumulative_revisions_retry_in_order_without_mutation(self):
        with tempfile.TemporaryDirectory() as folder:
            delivered = []
            outbox = Outbox(Path(folder), lambda body: delivered.append(json.loads(body)) or True)
            first = batch()
            second = {**first, "revision": 1, "traffic": [{"count": 2}]}
            outbox.enqueue(first)
            outbox.enqueue(second)
            outbox.enqueue(second)
            self.assertEqual(len(outbox.pending()), 2)
            self.assertEqual(outbox.flush(), 2)
            self.assertEqual(delivered, [first, second])

    def test_nonfinite_content_is_rejected_before_disk(self):
        with tempfile.TemporaryDirectory() as folder:
            outbox = Outbox(Path(folder), lambda _: True)
            payload = batch()
            payload["revision"] = float("nan")
            with self.assertRaises(ValueError):
                outbox.enqueue(payload)
            self.assertEqual(outbox.pending(), [])

    def test_http_sender_auth_and_retry_statuses(self):
        received = []
        responses = [503, 401, 201]
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                received.append((self.headers.get("Authorization"), self.rfile.read(int(self.headers["Content-Length"]))))
                self.send_response(responses.pop(0))
                self.end_headers()
            def log_message(self, *_):
                pass
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            sender = HttpSender(f"http://127.0.0.1:{server.server_port}/api/worker", "private-test-value")
            self.assertFalse(sender(b"{}"))
            with self.assertRaises(PublishError) as caught:
                sender(b"{}")
            self.assertNotIn("private-test-value", str(caught.exception))
            self.assertTrue(sender(b"{}"))
            self.assertEqual(received, [("Bearer private-test-value", b"{}")] * 3)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_endpoint_userinfo_is_never_accepted(self):
        with self.assertRaises(ValueError):
            HttpSender("https://password@example.com/api/worker", "private-test-value")

    def test_slow_sender_does_not_block_durable_enqueue_or_duplicate_inflight_body(self):
        entered, release, queued = threading.Event(), threading.Event(), threading.Event()
        bodies, errors = [], []
        with tempfile.TemporaryDirectory() as folder:
            def sender(body):
                bodies.append(body)
                entered.set()
                release.wait(2)
                return True
            box = Outbox(Path(folder), sender)
            first, second = batch(), batch()
            box.enqueue(first)
            original = box.pending()[0].read_bytes()
            delivery = threading.Thread(target=box.flush)
            delivery.start()
            self.assertTrue(entered.wait(1))
            def produce():
                try:
                    box.enqueue(first)  # Exact in-flight retry remains one file.
                    box.enqueue(second)
                    queued.set()
                except Exception as error:
                    errors.append(error)
            producer = threading.Thread(target=produce)
            producer.start()
            try:
                self.assertTrue(queued.wait(1), "HTTP held the enqueue mutex")
                self.assertEqual(len(box.pending()), 2)
                self.assertEqual(box.pending()[0].read_bytes(), original)
            finally:
                release.set()
                producer.join(2)
                delivery.join(2)
            self.assertEqual(errors, [])
            box.flush()
            self.assertEqual([json.loads(body) for body in bodies], [first, second])

    def test_concurrent_flushes_serialize_the_same_fifo_without_duplicate_posts(self):
        with tempfile.TemporaryDirectory() as folder:
            posted = []
            box = Outbox(Path(folder), lambda body: posted.append(json.loads(body)) or True)
            payloads = [batch() for _ in range(12)]
            for payload in payloads:
                box.enqueue(payload)
            threads = [threading.Thread(target=box.flush) for _ in range(3)]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join(2)
                self.assertFalse(thread.is_alive())
            self.assertEqual(posted, payloads)
            self.assertEqual(box.delivered, len(payloads))

    def test_failed_publication_blocks_partial_plan_until_successful_recovery(self):
        with tempfile.TemporaryDirectory() as folder:
            posted = []
            box = Outbox(Path(folder), lambda body: posted.append(json.loads(body)) or True)
            payload = batch()
            with self.assertRaises(OSError):
                with box.publication():
                    box.enqueue(payload)
                    raise OSError("checkpoint commit failed")
            original = box.pending()[0].read_bytes()
            self.assertEqual(box.flush(), 0)
            self.assertEqual(posted, [])
            self.assertEqual(box.pending()[0].read_bytes(), original)
            with box.publication():
                box.enqueue(payload)
            self.assertEqual(box.flush(), 1)
            self.assertEqual(posted, [payload])


if __name__ == "__main__":
    unittest.main()
