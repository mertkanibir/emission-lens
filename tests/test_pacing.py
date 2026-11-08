import unittest
from worker.pacing import LiveMediaPacer


class PacingTests(unittest.TestCase):
    def test_burst_frames_follow_media_deadlines_without_retiming(self):
        p = LiveMediaPacer(4)
        self.assertEqual(p.delay("222", 1, 10, 100), 4)
        self.assertAlmostEqual(p.delay("222", 1, 10.2, 100.01), 4.19)
        self.assertAlmostEqual(p.delay("222", 1, 10.4, 104.2), .2)

    def test_camera_and_reconnect_clocks_are_independent(self):
        p = LiveMediaPacer(4)
        p.delay("222", 1, 100, 10)
        self.assertEqual(p.delay("223", 1, 0, 20), 4)
        self.assertEqual(p.delay("222", 2, 0, 30), 4)
        self.assertAlmostEqual(p.delay("223", 1, .2, 20.1), 4.1)

    def test_late_processing_catches_up_without_negative_wait_or_fake_frames(self):
        p = LiveMediaPacer(4)
        p.delay("222", 1, 0, 0)
        self.assertEqual(p.delay("222", 1, .2, 12), 0)
        with self.assertRaisesRegex(ValueError, "advancing"):
            p.delay("222", 1, .2, 13)
        with self.assertRaises(ValueError):
            p.delay("222", 1, float("nan"), 13)
        with self.assertRaises(ValueError):
            LiveMediaPacer(11)


if __name__ == "__main__":
    unittest.main()
