"""Media-clock arithmetic is independent of a model, GPU, or camera feed."""

from datetime import datetime, timedelta, timezone
import unittest

from worker.timing import SessionMediaClock, media_microseconds


NOW = datetime(2026, 11, 7, 23, 31, 10, tzinfo=timezone.utc)


class MediaClockTests(unittest.TestCase):
    def test_startup_backlog_rebases_earlier_frames_by_thirty_seconds(self):
        clock = SessionMediaClock()
        clock.observe(0, NOW)
        self.assertEqual(clock.at(0), NOW)
        for seconds in (10, 20, 30):
            clock.observe(media_microseconds(seconds), NOW)
        self.assertEqual(clock.anchor, NOW - timedelta(seconds=30))
        self.assertEqual(clock.at(0), NOW - timedelta(seconds=30))
        self.assertEqual(clock.at(30_000_000), NOW)

    def test_late_chunks_do_not_move_anchor_forward(self):
        clock = SessionMediaClock()
        clock.observe(0, NOW)
        clock.observe(10_000_000, NOW + timedelta(seconds=20))
        self.assertEqual(clock.at(10_000_000), NOW + timedelta(seconds=10))
        self.assertEqual(clock.anchor, NOW)

    def test_independent_session_clock_does_not_reuse_prior_anchor(self):
        first, second = SessionMediaClock(), SessionMediaClock()
        first.observe(30_000_000, NOW)
        second.observe(0, NOW + timedelta(seconds=60))
        self.assertEqual(second.at(0), NOW + timedelta(seconds=60))
        self.assertEqual(first.anchor, NOW - timedelta(seconds=30))

    def test_normalizes_timezone_and_uses_datetime_microsecond_precision(self):
        clock = SessionMediaClock()
        clock.observe(0, NOW.astimezone(timezone(timedelta(hours=-5))))
        self.assertEqual(clock.anchor.tzinfo, timezone.utc)
        self.assertEqual(media_microseconds(59.9999994), 59_999_999)
        self.assertEqual(media_microseconds(59.9999996), 60_000_000)

    def test_rejects_invalid_media_unanchored_reads_and_naive_receipts(self):
        clock = SessionMediaClock()
        for seconds in (True, -1, float("nan"), float("inf"), "0"):
            with self.subTest(seconds=seconds), self.assertRaises(ValueError):
                media_microseconds(seconds)
        with self.assertRaises(ValueError):
            clock.at(0)
        with self.assertRaises(ValueError):
            clock.observe(0, NOW.replace(tzinfo=None))
        with self.assertRaises(ValueError):
            clock.observe(10**18, NOW)
        self.assertIsNone(clock.anchor)


if __name__ == "__main__":
    unittest.main()
