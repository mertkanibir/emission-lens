"""Independent-oracle and literal-policy guards for the read-only replay driver."""
import csv
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("stop_replay_check", ROOT / "backend/scripts/check-stop-replays.py")
CHECK = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CHECK)


class StopReplayAcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.path = ROOT / "emissions/data/la-2026/carb-source.csv"
        cls.oracle = CHECK.CarbOracle(cls.path)

    def approved(self, stopped=180):
        return {
            "meteorology": {"temperature_f": 70, "relative_humidity_pct": 60},
            "class_mapping": {"classes": {"car": [{"emfac_class": "LDA", "vmt_share": 1}]}},
            "traversals": [{"vehicle_class": "car", "distance_m": 1609.344, "traversal_time_s": 360, "stopped_time_s": stopped}],
        }

    def test_original_csv_mile_arithmetic(self):
        with self.path.open() as stream:
            rows = list(csv.DictReader(stream))
        for pollutant in ("co2", "nox"):
            rate = next(float(r["emission_rate"]) for r in rows if r["process"] == "RUNEX" and r["vehicle_class"] == "LDA" and r["pollutant"].lower() == pollutant and r["speed_time"] == "10" and r["temperature"] == "70" and r["relative_humidity"] == "60")
            CHECK.near(rate, self.oracle.compare(self.approved(), pollutant)["baseline_g"])

    def test_supported_zero_and_unknown_stopped_are_distinct(self):
        zero = self.oracle.compare(self.approved(0), "co2")
        self.assertGreater(zero["baseline_g"], 0)
        self.assertEqual(zero["baseline_g"], zero["scenario_g"])
        self.assertEqual(zero["change_g"], 0)
        unknown = self.oracle.compare(self.approved(None), "co2")
        self.assertGreater(unknown["baseline_g"], 0)
        self.assertIsNone(unknown["scenario_g"])
        self.assertIsNone(unknown["change_g"])

    def test_unmapped_member_withholds_entire_cohort_and_empty_is_not_zero(self):
        value = self.approved()
        value["traversals"].append({**value["traversals"][0], "vehicle_class": "unknown"})
        self.assertEqual(self.oracle.compare(value, "co2"), {"baseline_g": None, "scenario_g": None, "change_g": None})
        value["traversals"] = []
        self.assertIsNone(self.oracle.compare(value, "co2")["baseline_g"])
        self.assertIsNone(CHECK.strict_sum([]))
        self.assertIsNone(CHECK.strict_sum([1, None]))
        self.assertEqual(CHECK.strict_sum([0, 0]), 0)

    def test_20percent_factor_bin_increase_remains_positive(self):
        value = self.approved(60)
        value["traversals"][0]["traversal_time_s"] = 60
        result = self.oracle.compare(value, "co2")
        self.assertGreater(result["change_g"], 0)
        self.assertGreater(result["scenario_g"], result["baseline_g"])

    def test_exact_policy_literals_and_camera_context_are_required(self):
        for camera, threshold in CHECK.THRESHOLDS.items():
            value = {"camera_id": camera, "context_version": camera + "-context+stop-v1", "stop_observation": {"image_displacement_per_s": threshold, "method_version": f"{camera}-image-stop-v1-{threshold}"}}
            CHECK.validate_policy(camera, value)
            value["stop_observation"]["image_displacement_per_s"] += 0.00000001
            with self.assertRaises(AssertionError):
                CHECK.validate_policy(camera, value)
        with self.assertRaises(AssertionError):
            CHECK.near(None, 0)
        with self.assertRaises(RuntimeError):
            CHECK.NoRedirect().redirect_request(None, None, None, None, None, None)

    def test_single_and_multi_camera_diagnostic_shapes(self):
        diagnostic = {"completed_traversals": 3}
        self.assertEqual(CHECK.per_camera(diagnostic, "222"), diagnostic)
        self.assertEqual(CHECK.per_camera({"by_camera": {"223": diagnostic}}, "223"), diagnostic)

    def test_supported_all_zero_stops_satisfy_the_actual_checklist(self):
        summary = {"completed_candidates": 2, "positive_stop_count": 0, "unknown_stop_count": 0,
                   "selected_gate_crossings": 7, "numeric_complete_minute_scenarios": 1}
        provenance = {"source_execution_receipt_linked": True, "source_window_s": None}
        self.assertTrue(all(CHECK.acceptance_exercises(summary, provenance).values()))
        summary["unknown_stop_count"] = 1
        self.assertFalse(CHECK.acceptance_exercises(summary, provenance)["all_completed_stops_numeric"])

    def test_queue_reporting_does_not_turn_unknown_or_class_ambiguity_into_zero(self):
        self.assertEqual(CHECK.queue_observation([{"queue_count": None}]), {"state": "unavailable", "value": None})
        self.assertEqual(CHECK.queue_observation([{"queue_count": 0}, {"queue_count": None}]), {"state": "zero", "value": 0})
        self.assertEqual(CHECK.queue_observation([{"queue_count": 3}]), {"state": "positive", "value": 3})
        self.assertEqual(CHECK.queue_observation([{"queue_count": 3}, {"queue_count": 3}]), {"state": "ambiguous", "value": None})


if __name__ == "__main__":
    unittest.main()
