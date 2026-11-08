"""Native queue tests plus fault-injected platform boundaries; no media/GPU."""

import ctypes
import errno
import json
import os
from pathlib import Path
import stat
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch
import uuid

from worker.publish import (
    Outbox,
    _queue_measurement_plan,
    _windows_replace,
    _write_measurement_checkpoint,
)


def batch(revision=0, batch_id=None):
    return {
        "batch_id": batch_id or str(uuid.uuid4()),
        "revision": revision,
        "observations": [],
    }


class QueuePortabilityTests(unittest.TestCase):
    def test_windows_style_directory_denial_does_not_disable_file_flush_or_closed_replacement(
        self,
    ):
        real_open, real_fsync, real_replace, real_mkstemp = (
            os.open,
            os.fsync,
            os.replace,
            tempfile.mkstemp,
        )
        descriptor = None
        synced = []
        replacements = []

        def directory_denied(path, flags, *args, **kwargs):
            if Path(path).is_dir():
                raise PermissionError(
                    errno.EACCES, "Windows CRT does not open directories"
                )
            return real_open(path, flags, *args, **kwargs)

        def temporary(*args, **kwargs):
            nonlocal descriptor
            descriptor, path = real_mkstemp(*args, **kwargs)
            return descriptor, path

        def sync(fd):
            self.assertTrue(stat.S_ISREG(os.fstat(fd).st_mode))
            synced.append(fd)
            real_fsync(fd)

        def replace_closed(source, target):
            with self.assertRaises(OSError) as closed:
                os.fstat(descriptor)
            self.assertEqual(closed.exception.errno, errno.EBADF)
            # The source already contains a complete JSON document before publication.
            json.loads(Path(source).read_bytes())
            replacements.append(Path(target).name)
            real_replace(source, target)

        with tempfile.TemporaryDirectory() as folder:
            box = Outbox(Path(folder), lambda _: False)
            with patch("worker.publish._WINDOWS", True), patch(
                "worker.publish.os.open", side_effect=directory_denied
            ), patch("worker.publish.os.fsync", side_effect=sync), patch(
                "worker.publish.tempfile.mkstemp", side_effect=temporary
            ), patch(
                "worker.publish._windows_replace", side_effect=replace_closed
            ):
                box.enqueue(batch())
                checkpoint = Path(folder) / "bridge.checkpoint"
                _write_measurement_checkpoint(checkpoint, {"state": "pending"})
                _write_measurement_checkpoint(checkpoint, {"state": "committed"})
                self.assertEqual(
                    json.loads(checkpoint.read_bytes()), {"state": "committed"}
                )
                self.assertEqual(len(box.pending()), 1)
            self.assertEqual(len(synced), 3)
            self.assertEqual(len(replacements), 3)
            self.assertEqual(list(Path(folder).glob(".batch-*")), [])
            self.assertEqual(list(Path(folder).glob(".measurement-state-*")), [])

    def test_posix_directory_permission_failure_is_not_silenced(self):
        real_open = os.open

        def directory_denied(path, flags, *args, **kwargs):
            if Path(path).is_dir():
                raise PermissionError(errno.EACCES, "denied directory sync")
            return real_open(path, flags, *args, **kwargs)

        with tempfile.TemporaryDirectory() as folder:
            box = Outbox(Path(folder), Mock(return_value=True))
            payload = batch()
            with patch("worker.publish._WINDOWS", False), patch(
                "worker.publish.os.open", side_effect=directory_denied
            ):
                with self.assertRaises(PermissionError):
                    box.enqueue(payload)
            # A complete rename can precede a failed directory flush. Preserve it
            # for the exact retry; never acknowledge a possibly unflushed write.
            self.assertEqual(json.loads(box.pending()[0].read_bytes()), payload)
            box.sender.assert_not_called()

    def test_windows_file_fsync_permission_failure_preserves_the_existing_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            box = Outbox(Path(folder), Mock(return_value=True))
            box.enqueue(batch())
            path = box.pending()[0]
            original = path.read_bytes()
            with patch("worker.publish._WINDOWS", True), patch(
                "worker.publish.os.fsync",
                side_effect=PermissionError(errno.EACCES, "denied file flush"),
            ), patch("worker.publish._windows_replace") as replacement:
                with self.assertRaises(PermissionError):
                    box.enqueue(batch())
                replacement.assert_not_called()
            self.assertEqual(box.pending(), [path])
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(list(Path(folder).glob(".batch-*")), [])
            box.sender.assert_not_called()

    def test_denied_checkpoint_replacement_keeps_old_state_and_never_enqueues_plan(
        self,
    ):
        with tempfile.TemporaryDirectory() as folder:
            checkpoint = Path(folder) / "bridge.checkpoint"
            _write_measurement_checkpoint(checkpoint, {"state": "old"})
            original = checkpoint.read_bytes()
            box = Outbox(Path(folder), Mock(return_value=True))
            bridge = Mock()
            bridge.pending.return_value = SimpleNamespace(
                plan_id="pending-plan", batches=(batch(),)
            )
            bridge.checkpoint.return_value = {"state": "new"}
            with patch("worker.publish._WINDOWS", True), patch(
                "worker.publish._windows_replace",
                side_effect=PermissionError(errno.EACCES, "sharing violation"),
            ):
                with self.assertRaises(PermissionError):
                    _queue_measurement_plan(bridge, box, checkpoint)
            self.assertEqual(checkpoint.read_bytes(), original)
            self.assertEqual(box.pending(), [])
            self.assertEqual(list(Path(folder).glob(".measurement-state-*")), [])
            bridge.commit.assert_not_called()
            box.sender.assert_not_called()

    def test_denied_ack_move_keeps_exact_first_revision_and_stops_fifo(self):
        with tempfile.TemporaryDirectory() as folder:
            sent = []
            box = Outbox(Path(folder), lambda body: sent.append(body) or True)
            first = batch()
            second = batch(1, first["batch_id"])
            box.enqueue(first)
            box.enqueue(second)
            paths = box.pending()
            original = [path.read_bytes() for path in paths]
            with patch("worker.publish._WINDOWS", True), patch(
                "worker.publish._windows_replace",
                side_effect=PermissionError(errno.EACCES, "sharing violation"),
            ):
                with self.assertRaises(PermissionError):
                    box.flush()
            self.assertEqual(sent, original[:1])
            self.assertEqual([path.read_bytes() for path in box.pending()], original)
            self.assertEqual(box.delivered, 0)

    def test_ack_cleanup_failure_retains_a_non_http_marker_and_restart_never_resends_it(
        self,
    ):
        real_replace, real_unlink = os.replace, Path.unlink

        def denied_marker(path, *args, **kwargs):
            if path.suffix == ".acked":
                raise PermissionError(errno.EACCES, "marker cleanup denied")
            return real_unlink(path, *args, **kwargs)

        with tempfile.TemporaryDirectory() as folder:
            sent = []
            sender = lambda body: sent.append(json.loads(body)) or True
            box = Outbox(Path(folder), sender)
            first = batch()
            second = batch(1, first["batch_id"])
            box.enqueue(first)
            box.enqueue(second)
            with patch("worker.publish._WINDOWS", True), patch(
                "worker.publish._windows_replace", side_effect=real_replace
            ):
                with patch(
                    "worker.publish.Path.unlink",
                    autospec=True,
                    side_effect=denied_marker,
                ):
                    with self.assertRaises(PermissionError):
                        box.flush()
                self.assertEqual(sent, [first])
                self.assertEqual(len(list(Path(folder).glob("*.acked"))), 1)
                self.assertEqual(
                    [json.loads(p.read_bytes()) for p in box.pending()], [second]
                )
                # A still-denied marker blocks later sends after reinstantiation.
                with patch(
                    "worker.publish.Path.unlink",
                    autospec=True,
                    side_effect=denied_marker,
                ):
                    with self.assertRaises(PermissionError):
                        Outbox(Path(folder), sender).flush()
                self.assertEqual(sent, [first])
                restarted = Outbox(Path(folder), sender)
                self.assertEqual(restarted.flush(), 1)
                self.assertEqual(sent, [first, second])
                self.assertEqual(restarted.pending(), [])
                self.assertEqual(list(Path(folder).glob("*.acked")), [])

    def test_native_windows_failure_is_reported_without_fallback_copy_or_unlink(self):
        move = Mock(return_value=0)
        loader = Mock(return_value=SimpleNamespace(MoveFileExW=move))
        error = PermissionError(errno.EACCES, "native move denied")
        with patch.object(ctypes, "WinDLL", loader, create=True), patch.object(
            ctypes, "get_last_error", return_value=5, create=True
        ), patch.object(ctypes, "WinError", return_value=error, create=True):
            with self.assertRaises(PermissionError):
                _windows_replace("source-α", "target-β")
        loader.assert_called_once_with("kernel32", use_last_error=True)
        move.assert_called_once_with("source-α", "target-β", 0x1 | 0x8)


if __name__ == "__main__":
    unittest.main()
