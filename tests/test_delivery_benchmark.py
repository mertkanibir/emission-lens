"""Check benchmark evidence integrity without asserting a machine speed threshold."""

import unittest

from evaluation.delivery_benchmark import compare


class DeliveryBenchmarkTests(unittest.TestCase):
    def test_comparison_requires_identical_fifo_bytes_and_drained_evidence(self):
        result = compare(repeats=1, iterations=4, publish_every=2, work_s=0, delay_s=0)
        baseline, background = result["trials"]
        self.assertEqual(baseline["ordered_payloads_sha256"], background["ordered_payloads_sha256"])
        for row in result["trials"]:
            self.assertEqual(row["delivered_batches"], 2)
            self.assertEqual(row["attempts"], 2)
            self.assertEqual(row["pending_batches"], 0)
            self.assertTrue(row["identical_ordered_bytes"])
            self.assertGreater(row["processing_loop_wall_s"], 0)
            self.assertGreaterEqual(row["end_to_end_wall_s"], row["processing_loop_wall_s"])
