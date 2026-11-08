import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

from worker.publish import PreviewHttpSender, PublishError


class PreviewTransportTests(unittest.TestCase):
    def serve(self, responses, byte_delay=0):
        received = []

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def do_POST(self):
                received.append((self.client_address[1], self.path,
                                 self.headers.get("Authorization"),
                                 self.rfile.read(int(self.headers["Content-Length"]))))
                status, body, close = responses.pop(0)
                self.send_response(status)
                self.send_header("Content-Length", str(len(body)))
                if status == 302:
                    self.send_header("Location", "/must-not-follow")
                if close:
                    self.send_header("Connection", "close")
                self.end_headers()
                try:
                    if byte_delay:
                        for byte in body:
                            self.wfile.write(bytes([byte]))
                            self.wfile.flush()
                            time.sleep(byte_delay)
                    else:
                        self.wfile.write(body)
                except OSError:
                    pass

            def log_message(self, *_):
                pass

        class Server(ThreadingHTTPServer):
            def handle_error(self, request, client_address):
                # A tested client-side bound deliberately closes unread bytes.
                pass

        server = Server(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(thread.join)
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        sender = PreviewHttpSender(f"http://127.0.0.1:{server.server_port}/api/frames?mode=live", "private-test-value")
        self.addCleanup(sender.close)
        return sender, received

    def test_actual_connection_reused_and_server_close_reconnects(self):
        sender, received = self.serve([(202, b"{}", False), (202, b"{}", True), (202, b"{}", False)])
        self.assertTrue(sender(b"one"))
        self.assertTrue(sender(b"two"))
        self.assertTrue(sender(b"three"))
        self.assertEqual(received[0][0], received[1][0])
        self.assertNotEqual(received[1][0], received[2][0])
        self.assertEqual([row[1:] for row in received], [
            ("/api/frames?mode=live", "Bearer private-test-value", body)
            for body in (b"one", b"two", b"three")
        ])

    def test_retryable_denied_and_redirect_statuses_do_not_follow(self):
        sender, received = self.serve([(503, b"{}", False), (401, b"{}", False), (302, b"{}", False), (202, b"{}", False)])
        self.assertFalse(sender(b"one"))
        for body in (b"two", b"three"):
            with self.assertRaises(PublishError) as caught:
                sender(body)
            self.assertNotIn("private-test-value", str(caught.exception))
        self.assertTrue(sender(b"four"))
        self.assertEqual(len(received), 4)
        self.assertTrue(all(row[1] == "/api/frames?mode=live" for row in received))

    def test_oversized_response_closes_connection_and_next_frame_recovers(self):
        sender, received = self.serve([(202, b"x" * (PreviewHttpSender.MAX_RESPONSE_BYTES + 1), False), (202, b"{}", False)])
        self.assertFalse(sender(b"one"))
        self.assertIsNone(sender._connection)
        self.assertTrue(sender(b"two"))
        self.assertNotEqual(received[0][0], received[1][0])

    def test_connection_error_is_closed_before_next_frame(self):
        sender, received = self.serve([(202, b"{}", False)])
        with patch("worker.publish.http.client.HTTPConnection.request", side_effect=OSError("connection lost")):
            self.assertFalse(sender(b"one"))
        self.assertIsNone(sender._connection)
        self.assertTrue(sender(b"two"))
        self.assertEqual(len(received), 1)

    def test_same_endpoint_validation_as_durable_sender(self):
        for endpoint in ("https://password@example.com/api/frames", "http://example.com/api/frames", "file:///tmp/frame"):
            with self.subTest(endpoint=endpoint), self.assertRaises(ValueError):
                PreviewHttpSender(endpoint, "private-test-value")

    def test_trickling_response_has_one_wall_clock_deadline(self):
        sender, _ = self.serve([(202, b"x" * 100, False)], byte_delay=.03)
        sender._timeout_s = .12
        started = time.monotonic()
        self.assertFalse(sender(b"one"))
        self.assertLess(time.monotonic() - started, .4)
        self.assertIsNone(sender._connection)
