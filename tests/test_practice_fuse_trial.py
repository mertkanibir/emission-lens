"""Scope guards for the private evaluation-only tracker configuration."""

import copy
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

import yaml

from evaluation.practice_fuse_trial import predictor_arguments, validate_configs


class PrivateTrackerConfigTests(unittest.TestCase):
    def test_actual_predictor_metadata_has_no_persist_cfg_field(self):
        args = SimpleNamespace(imgsz=640, conf=.1, classes=[2,3,5,7], tracker="bytetrack.yaml", mode="track", batch=1)
        result = predictor_arguments(args)
        self.assertEqual(result["mode"], "track")
        self.assertNotIn("persist", result)

    def validate(self, change):
        original = {"tracker_type": "bytetrack", "track_high_thresh": .25, "track_low_thresh": .1,
                    "new_track_thresh": .25, "track_buffer": 30, "match_thresh": .8, "fuse_score": True}
        candidate = {**copy.deepcopy(original), **change}
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder) / "default.yaml", Path(folder) / "candidate.yaml"
            a.write_text(yaml.safe_dump(original))
            b.write_text(yaml.safe_dump(candidate))
            return validate_configs(a, b)

    def test_only_fuse_score_boolean_change_is_permitted(self):
        original, candidate = self.validate({"fuse_score": False})
        self.assertEqual({k for k in original if original[k] != candidate[k]}, {"fuse_score"})

    def test_other_threshold_or_field_changes_are_rejected(self):
        for change in ({"fuse_score": False, "track_high_thresh": .2},
                       {"fuse_score": False, "track_buffer": 60},
                       {"fuse_score": False, "new_field": True}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.validate(change)

    def test_unchanged_or_nonboolean_candidate_is_rejected(self):
        for change in ({}, {"fuse_score": "false"}, {"fuse_score": 0}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                self.validate(change)


if __name__ == "__main__":
    unittest.main()
