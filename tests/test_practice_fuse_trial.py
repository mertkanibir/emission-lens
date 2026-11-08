"""Scope guards for the private evaluation-only tracker configuration."""

import copy
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

import yaml

from evaluation.practice_fuse_trial import configurations_for_plan, predictor_arguments, validate_configs


class PrivateTrackerConfigTests(unittest.TestCase):
    def test_native_recipe_runs_only_1280_with_original_yaml(self):
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder)/"a.yaml", Path(folder)/"b.yaml"
            a.write_text('fuse_score: true\ntrack_high_thresh: 0.25\n')
            b.write_bytes(a.read_bytes())
            kind, size, runs = configurations_for_plan({'experiment_type':'native_resolution','image_size':1280}, a, b)
            self.assertEqual((kind,size),('native_resolution',1280))
            self.assertEqual(len(runs),1)
            self.assertIsNone(runs[0][2])
            self.assertIs(runs[0][1]['fuse_score'],True)
            for plan in ({'experiment_type':'native_resolution','image_size':640},
                         {'experiment_type':'native_resolution','image_size':960}):
                with self.subTest(plan=plan), self.assertRaises(ValueError):
                    configurations_for_plan(plan,a,b)
            b.write_text('fuse_score: false\ntrack_high_thresh: 0.25\n')
            with self.assertRaises(ValueError):
                configurations_for_plan({'experiment_type':'native_resolution','image_size':1280},a,b)

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
