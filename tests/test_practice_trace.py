"""Synthetic read-only observer checks; no footage/model imports or source edits."""

import copy
from types import SimpleNamespace
import unittest

from evaluation.trace_228_practice import eligibility, gate_explanation, metrics_snapshot, sampler_record, tracker_states
from worker.metrics import CameraMetrics, MetricsConfig


def config(**changes):
    raw = {"camera_id": "228", "version": "synthetic-observer", "enabled": True,
           "image_geometry_status": "reviewed", "road_region": [[0, 0], [1, 0], [1, 1], [0, 1]],
           "excluded_regions": [], "gates": [{"id": "count-1", "start": [0.1, 0.5], "end": [0.9, 0.5], "direction": "both"}]}
    return MetricsConfig.from_dict({**raw, **changes})


def frame(t):
    return SimpleNamespace(camera_id="228", session=1, media_time_s=t, image=SimpleNamespace(shape=(100, 100, 3)))


def vehicle(y, identity=1, x=0.5):
    return SimpleNamespace(track_id=identity, label="car", detection=SimpleNamespace(x1=x*100-1, x2=x*100+1, y1=y*100-2, y2=y*100))


class PracticeObserverTests(unittest.TestCase):
    def test_installed_byte_track_xyxy_field_is_observed_without_mutation(self):
        track = SimpleNamespace(track_id=1, xyxy=[1, 2, 3, 4], score=.8, state=1,
                                is_activated=True, frame_id=3, start_frame=1)
        model = SimpleNamespace(predictor=SimpleNamespace(trackers=[SimpleNamespace(
            tracked_stracks=[track], lost_stracks=[], removed_stracks=[])]))
        before = copy.deepcopy(model)
        observed = tracker_states(model)
        self.assertEqual(observed['tracked_stracks'][0]['bbox'], [1., 2., 3., 4.])
        self.assertEqual(model, before)

    def test_snapshot_does_not_retain_mutable_metric_references(self):
        metrics = CameraMetrics(config())
        metrics.update(frame(0), [vehicle(.4)])
        before = metrics_snapshot(metrics)
        metrics.update(frame(.1), [vehicle(.45)])
        self.assertEqual(before[1]["hits"], 1)
        self.assertEqual(before[1]["point"], [.5, .4])
        self.assertEqual(before[1]["gates"]["count-1"]["stable_side"], -1)

    def test_observation_is_read_only_and_predicates_agree_with_actual_emission(self):
        metrics = CameraMetrics(config())
        metrics.update(frame(0), [vehicle(.4)])
        metrics.update(frame(.1), [vehicle(.45)])
        before = metrics_snapshot(metrics)
        saved = copy.deepcopy(metrics.__dict__)
        detail = gate_explanation(metrics.config, metrics.config.gates[0], vehicle(.6), 100, 100, .2, before[1], set())
        self.assertEqual(metrics.__dict__, saved)
        self.assertTrue(detail["predicted_emit"])
        self.assertEqual(detail["reason"], "would_emit")
        self.assertEqual(len(metrics.update(frame(.2), [vehicle(.6)]).crossings), 1)

    def test_hysteresis_pending_is_visible_without_emitting(self):
        metrics = CameraMetrics(config())
        metrics.update(frame(0), [vehicle(.4)])
        metrics.update(frame(.1), [vehicle(.45)])
        before = metrics_snapshot(metrics)
        detail = gate_explanation(metrics.config, metrics.config.gates[0], vehicle(.505), 100, 100, .2, before[1], set())
        self.assertEqual(detail["pending_before_confirmation_reconstructed"], 1)
        self.assertFalse(detail["predicted_emit"])
        result = metrics.update(frame(.2), [vehicle(.505)])
        self.assertEqual(result.crossings, ())
        self.assertEqual(metrics_snapshot(metrics)[1]["gates"]["count-1"]["pending_direction"], 1)

    def test_roi_exit_and_reentry_reset_hits_with_same_upstream_track_id(self):
        metrics = CameraMetrics(config(road_region=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]]))
        metrics.update(frame(0), [vehicle(.4)])
        before = metrics_snapshot(metrics)
        detail = gate_explanation(metrics.config, metrics.config.gates[0], vehicle(.95), 100, 100, .1, before[1], set())
        self.assertFalse(detail["inside_road_polygon"])
        self.assertEqual(detail["reason"], "eligibility_rejected")
        metrics.update(frame(.1), [vehicle(.95)])
        self.assertNotIn(1, metrics_snapshot(metrics))
        metrics.update(frame(.2), [vehicle(.6)])
        self.assertEqual(metrics_snapshot(metrics)[1]["hits"], 1)

    def test_exclusion_membership_is_distinct_from_road_membership(self):
        cfg = config(excluded_regions=[[[.4,.6],[.6,.6],[.6,.8],[.4,.8]]])
        detail = eligibility(cfg, (49, 68, 51, 70), "car", 100, 100)
        self.assertTrue(detail["inside_road_polygon"])
        self.assertEqual(detail["excluded_region_indices"], [0])
        self.assertFalse(detail["eligible"])

    def test_expired_prior_and_gap_reset_do_not_explain_as_missed_crossing(self):
        metrics = CameraMetrics(config())
        metrics.update(frame(0), [vehicle(.4)])
        before = metrics_snapshot(metrics)
        for time, reset in ((2, False), (.1, True)):
            detail = gate_explanation(metrics.config, metrics.config.gates[0], vehicle(.6), 100, 100, time, before[1], set(), reset)
            self.assertFalse(detail["predicted_emit"])
            self.assertIsNone(detail["effective_prior"])

    def test_dedup_reason_keeps_actual_same_direction_identity_scope(self):
        metrics = CameraMetrics(config())
        for t, y in ((0,.4),(.1,.45),(.2,.6),(.3,.4)):
            metrics.update(frame(t), [vehicle(y)])
        detail = gate_explanation(metrics.config, metrics.config.gates[0], vehicle(.6), 100, 100, .4,
                                  metrics_snapshot(metrics)[1], set(metrics._counted))
        self.assertTrue(detail["dedup_key_already_present"])
        self.assertEqual(detail["reason"], "deduplicated")
        self.assertFalse(detail["predicted_emit"])
        self.assertEqual(metrics.update(frame(.4), [vehicle(.6)]).crossings, ())

    def test_sampler_record_preserves_signed_delta_and_does_not_round_near_due(self):
        data = sampler_record(83.0, 83.0 + 1e-12, 83.0 + 1e-12, False)
        self.assertFalse(data["kept"])
        self.assertLess(data["media_minus_next_due_s"], 0)
        self.assertGreater(data["media_minus_next_due_s"], -1e-9)
        self.assertTrue(data["detail_window"])
        self.assertFalse(sampler_record(110, 110, 110.1, True)["detail_window"])


if __name__ == "__main__":
    unittest.main()
