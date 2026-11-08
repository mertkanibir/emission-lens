"""Configured traffic observations; tests use synthetic trajectories, never footage."""

import copy
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

from worker.metrics import CameraMetrics, MetricsConfig


def config(**changes):
    value = {
        "camera_id": "222", "version": "test-image-geometry-v1", "enabled": True,
        "image_geometry_status": "reviewed", "road_region": [[0, 0], [1, 0], [1, 1], [0, 1]],
        "excluded_regions": [],
        "gates": [{"id": "count", "start": [0.2, 0.5], "end": [0.8, 0.5], "direction": "both"}],
        "min_track_hits": 3, "hysteresis": 0.01, "max_gap_s": 1.0,
    }
    value.update(changes)
    return MetricsConfig.from_dict(value)


def frame(media, session=1, camera="222"):
    return SimpleNamespace(camera_id=camera, session=session, media_time_s=media,
                           image=SimpleNamespace(shape=(100, 100, 3)))


def vehicle(x, y, identity=1, label="car"):
    return SimpleNamespace(track_id=identity, label=label,
                           detection=SimpleNamespace(x1=x * 100 - 1, x2=x * 100 + 1,
                                                     y1=y * 100 - 2, y2=y * 100))


def cross(metrics, session=1, camera="222", identity=1, x=0.5, label="car", start=0.0):
    updates = []
    for index, y in enumerate((0.4, 0.45, 0.6)):
        updates.append(metrics.update(frame(start + index * 0.2, session, camera), [vehicle(x, y, identity, label)]))
    return updates[-1]


class CrossingTests(unittest.TestCase):
    def test_repeated_detections_do_not_inflate_crossings(self):
        metrics = CameraMetrics(config())
        for index in range(20):
            result = metrics.update(frame(index * 0.2), [vehicle(0.5, 0.4)])
        self.assertEqual(result.counts_by_class["car"], 0)
        result = metrics.update(frame(4), [vehicle(0.5, 0.6)])
        self.assertEqual(result.counts_by_class["car"], 1)
        self.assertEqual(len(result.crossings), 1)

    def test_gate_direction_is_deduplicated_per_track_and_session(self):
        metrics = CameraMetrics(config())
        result = cross(metrics)
        self.assertEqual(result.crossings[0].direction, "positive")
        result = metrics.update(frame(0.6), [vehicle(0.5, 0.4)])
        self.assertEqual(result.crossings[0].direction, "negative")
        result = metrics.update(frame(0.8), [vehicle(0.5, 0.6)])
        self.assertEqual(result.crossings, ())
        self.assertEqual(result.counts_by_class["car"], 2)
        result = cross(metrics, session=2)
        self.assertEqual(result.counts_by_class["car"], 1)

    def test_same_track_identity_is_independent_between_cameras(self):
        first, second = CameraMetrics(config()), CameraMetrics(config(camera_id="223"))
        self.assertEqual(cross(first).counts_by_class["car"], 1)
        self.assertEqual(cross(second, camera="223").counts_by_class["car"], 1)
        with self.assertRaisesRegex(ValueError, "another camera"):
            first.update(frame(0.6, camera="223"), [vehicle(0.5, 0.6)])

    def test_crossing_beyond_a_gate_endpoint_is_not_counted(self):
        self.assertEqual(cross(CameraMetrics(config()), x=0.9).counts_by_class["car"], 0)
        self.assertEqual(cross(CameraMetrics(config()), x=0.1).counts_by_class["car"], 0)

    def test_hysteresis_suppresses_near_gate_jitter(self):
        metrics = CameraMetrics(config())
        for index, y in enumerate((0.4, 0.499, 0.501, 0.499, 0.505)):
            result = metrics.update(frame(index * 0.2), [vehicle(0.5, y)])
            self.assertEqual(result.crossings, ())
        result = metrics.update(frame(1), [vehicle(0.5, 0.53)])
        self.assertEqual(result.counts_by_class["car"], 1)

    def test_touching_the_gate_and_returning_does_not_count(self):
        metrics = CameraMetrics(config())
        for index, y in enumerate((0.4, 0.5, 0.4)):
            result = metrics.update(frame(index * 0.2), [vehicle(0.5, y)])
        self.assertEqual(result.counts_by_class["car"], 0)

    def test_touch_then_travel_along_gate_and_depart_beyond_endpoint_does_not_count(self):
        metrics = CameraMetrics(config())
        for index, (x, y) in enumerate(((0.5, 0.4), (0.5, 0.5), (0.9, 0.5), (0.9, 0.6))):
            result = metrics.update(frame(index * 0.2), [vehicle(x, y)])
        self.assertEqual(result.counts_by_class["car"], 0)

    def test_a_short_track_crossing_is_not_deferred_into_a_later_false_count(self):
        metrics = CameraMetrics(config(min_track_hits=4))
        for index, y in enumerate((0.4, 0.6, 0.65, 0.7, 0.75)):
            result = metrics.update(frame(index * 0.2), [vehicle(0.5, y)])
        self.assertEqual(result.counts_by_class["car"], 0)

    def test_only_requested_direction_is_counted(self):
        gates = [{"id": "count", "start": [0.2, 0.5], "end": [0.8, 0.5], "direction": "negative"}]
        metrics = CameraMetrics(config(gates=gates))
        self.assertEqual(cross(metrics).counts_by_class["car"], 0)
        result = metrics.update(frame(0.6), [vehicle(0.5, 0.4)])
        self.assertEqual(result.counts_by_class["car"], 1)
        self.assertEqual(result.crossings[0].direction, "negative")

    def test_crossing_uses_the_settled_class_at_the_event(self):
        metrics = CameraMetrics(config())
        metrics.update(frame(0), [vehicle(0.5, 0.4, label="car")])
        metrics.update(frame(0.2), [vehicle(0.5, 0.45, label="car")])
        result = metrics.update(frame(0.4), [vehicle(0.5, 0.6, label="pickup")])
        self.assertEqual(result.crossings[0].vehicle_class, "pickup")
        self.assertEqual(result.counts_by_class["pickup"], 1)
        self.assertEqual(result.counts_by_class["car"], 0)

    def test_a_large_source_gap_does_not_bridge_a_crossing(self):
        metrics = CameraMetrics(config())
        metrics.update(frame(0), [vehicle(0.5, 0.4)])
        metrics.update(frame(0.2), [vehicle(0.5, 0.45)])
        result = metrics.update(frame(3), [vehicle(0.5, 0.6)])
        self.assertTrue(result.discontinuity)
        self.assertEqual(result.counts_by_class["car"], 0)

    def test_gap_does_not_forget_an_already_counted_direction(self):
        metrics = CameraMetrics(config())
        cross(metrics)
        self.assertEqual(cross(metrics, start=10).counts_by_class["car"], 1)

    def test_road_roi_and_parking_exclusions_remove_observations(self):
        roi = [[0.1, 0.1], [0.85, 0.1], [0.85, 0.9], [0.1, 0.9]]
        self.assertEqual(cross(CameraMetrics(config(road_region=roi)), x=0.9).counts_by_class["car"], 0)
        excluded = [[[0.45, 0.35], [0.55, 0.35], [0.55, 0.65], [0.45, 0.65]]]
        self.assertEqual(cross(CameraMetrics(config(excluded_regions=excluded))).counts_by_class["car"], 0)

    def test_crossing_point_inside_exclusion_is_not_bridged(self):
        excluded = [[[0.45, 0.48], [0.55, 0.48], [0.55, 0.52], [0.45, 0.52]]]
        self.assertEqual(cross(CameraMetrics(config(excluded_regions=excluded))).counts_by_class["car"], 0)

    def test_roi_exit_and_reentry_do_not_bridge_motion(self):
        roi = [[0.1, 0.1], [0.85, 0.1], [0.85, 0.9], [0.1, 0.9]]
        metrics = CameraMetrics(config(road_region=roi))
        metrics.update(frame(0), [vehicle(0.5, 0.4)])
        metrics.update(frame(0.2), [vehicle(0.95, 0.45)])
        self.assertEqual(metrics.update(frame(0.4), [vehicle(0.5, 0.6)]).counts_by_class["car"], 0)

    def test_old_sessions_and_duplicate_tracks_are_rejected(self):
        metrics = CameraMetrics(config())
        metrics.update(frame(0, session=2), [])
        with self.assertRaisesRegex(ValueError, "old reader session"):
            metrics.update(frame(1, session=1), [])
        with self.assertRaisesRegex(ValueError, "only once"):
            metrics.update(frame(1, session=2), [vehicle(0.5, 0.5), vehicle(0.5, 0.5)])

    def test_non_vehicle_and_invalid_boxes_are_not_counted(self):
        metrics = CameraMetrics(config())
        result = metrics.update(frame(0), [vehicle(0.5, 0.5, label="person"), vehicle(float("nan"), 0.5, identity=2)])
        self.assertEqual(result.skipped_detections, 2)
        self.assertEqual(sum(result.counts_by_class.values()), 0)


class StoppedTests(unittest.TestCase):
    def config(self):
        return config(stopped_threshold_per_s=0.01, stopped_min_duration_s=3,
                      queue_region=[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]])

    def test_stopped_time_requires_explicit_threshold_and_queue_region(self):
        result = CameraMetrics(config()).update(frame(0), [vehicle(0.5, 0.4)])
        self.assertIsNone(result.queue_count)
        self.assertIsNone(result.stopped_seconds_delta_by_class)

    def test_qualification_time_is_conservative_and_uses_media_time(self):
        metrics = CameraMetrics(self.config())
        for second in range(3):
            result = metrics.update(frame(second), [vehicle(0.5, 0.4)])
            self.assertIsNone(result.queue_count)
            self.assertEqual(result.stopped_seconds_delta_by_class, {})
        result = metrics.update(frame(3), [vehicle(0.5, 0.4)])
        self.assertEqual(result.queue_count, 1)
        self.assertEqual(result.stopped_seconds_delta_by_class, {})
        result = metrics.update(frame(4), [vehicle(0.5, 0.4)])
        self.assertEqual(result.stopped_seconds_delta_by_class, {"car": 1})
        # A repeated source frame does not accrue wall-clock stopped time.
        result = metrics.update(frame(4), [vehicle(0.5, 0.4)])
        self.assertEqual(result.stopped_seconds_delta_by_class, {})
        self.assertTrue(result.discontinuity)

    def test_movement_or_gap_resets_stopped_evidence(self):
        metrics = CameraMetrics(self.config())
        for second in range(5):
            metrics.update(frame(second), [vehicle(0.5, 0.4)])
        moving = metrics.update(frame(5), [vehicle(0.5, 0.45)])
        self.assertEqual(moving.queue_count, 0)
        self.assertEqual(moving.stopped_seconds_delta_by_class, {})
        gap = metrics.update(frame(10), [vehicle(0.5, 0.45)])
        self.assertIsNone(gap.queue_count)
        self.assertEqual(gap.stopped_seconds_delta_by_class, {})

    def test_brief_queue_occlusion_is_unavailable_not_empty(self):
        metrics = CameraMetrics(self.config())
        for second in range(4):
            result = metrics.update(frame(second), [vehicle(0.5, 0.4)])
        self.assertEqual(result.queue_count, 1)
        result = metrics.update(frame(3.2), [])
        self.assertIsNone(result.queue_count)
        self.assertEqual(result.stopped_seconds_delta_by_class, {})

    def test_empty_queue_needs_continuous_advancing_observation_before_supported_zero(self):
        metrics = CameraMetrics(self.config())
        for second in range(3):
            self.assertIsNone(metrics.update(frame(second), []).queue_count)
        self.assertEqual(metrics.update(frame(3), []).queue_count, 0)
        self.assertIsNone(metrics.update(frame(3), []).queue_count)
        self.assertIsNone(metrics.update(frame(10), []).queue_count)
        self.assertIsNone(metrics.update(frame(0, session=2), []).queue_count)

    def test_expired_occlusion_does_not_turn_into_zero_and_reappearance_requalifies(self):
        metrics = CameraMetrics(self.config())
        for second in range(4):
            result = metrics.update(frame(second), [vehicle(0.5, 0.4)])
        self.assertEqual(result.queue_count, 1)
        for second in range(4, 9):
            self.assertIsNone(metrics.update(frame(second), []).queue_count)
        self.assertIsNone(metrics.update(frame(9), [vehicle(0.5, 0.4)]).queue_count)
        for second in range(10, 12):
            self.assertIsNone(metrics.update(frame(second), [vehicle(0.5, 0.4)]).queue_count)
        self.assertEqual(metrics.update(frame(12), [vehicle(0.5, 0.4)]).queue_count, 1)
        # A valid observed identity outside the ROI resolves its absence there.
        self.assertEqual(metrics.update(frame(13), [vehicle(0.95, 0.4)]).queue_count, 0)

    def test_invalid_box_and_gap_with_lost_queue_vehicle_remain_unavailable(self):
        metrics = CameraMetrics(self.config())
        for second in range(4):
            metrics.update(frame(second), [vehicle(0.5, 0.4)])
        self.assertIsNone(metrics.update(frame(4), [vehicle(float("nan"), 0.4)]).queue_count)
        for second in range(5, 9):
            self.assertIsNone(metrics.update(frame(second), []).queue_count)
        other = CameraMetrics(self.config())
        for second in range(4):
            other.update(frame(second), [vehicle(0.5, 0.4)])
        self.assertIsNone(other.update(frame(10), []).queue_count)
        for second in range(11, 15):
            self.assertIsNone(other.update(frame(second), []).queue_count)

    def _queue_with_lost_identity_and_qualified_visible_vehicle(self):
        metrics = CameraMetrics(self.config())
        for second in range(4):
            result = metrics.update(frame(second), [vehicle(0.4, 0.4)])
        self.assertEqual(result.queue_count, 1)
        # The original identity disappears. A different visible vehicle needs
        # its own complete stopped qualification, not the old vehicle's time.
        for second in range(4, 7):
            self.assertIsNone(metrics.update(frame(second), [vehicle(0.7, 0.4, identity=2)]).queue_count)
        result = metrics.update(frame(7), [vehicle(0.7, 0.4, identity=2)])
        self.assertEqual(result.queue_count, 1)
        return metrics

    def test_visible_queue_lower_bound_does_not_erase_missing_identity_or_invent_zero(self):
        metrics = self._queue_with_lost_identity_and_qualified_visible_vehicle()
        self.assertEqual(metrics.update(frame(8), [vehicle(0.7, 0.4, identity=2)]).queue_count, 1)
        # Observing the new vehicle outside resolves only that vehicle. The
        # original missing vehicle still prevents an empty-queue assertion.
        self.assertIsNone(metrics.update(frame(9), [vehicle(0.95, 0.4, identity=2)]).queue_count)
        for second in range(10, 31):
            self.assertIsNone(metrics.update(frame(second), []).queue_count)
        # A valid observation of the original identity outside the ROI is
        # evidence of departure; elapsed time alone was never enough.
        self.assertEqual(metrics.update(frame(31), [vehicle(0.95, 0.4)]).queue_count, 0)

    def test_positive_visible_queue_does_not_bypass_current_observation_blockers(self):
        cases = {
            "repeated source frame": (7, [vehicle(0.7, 0.4, identity=2)]),
            "source gap": (12, [vehicle(0.7, 0.4, identity=2)]),
            "invalid detection": (8, [vehicle(0.7, 0.4, identity=2), vehicle(float("nan"), 0.4, identity=3)]),
            "unqualified current vehicle": (8, [vehicle(0.7, 0.4, identity=2), vehicle(0.5, 0.4, identity=3)]),
        }
        for reason, (second, vehicles) in cases.items():
            with self.subTest(reason=reason):
                metrics = self._queue_with_lost_identity_and_qualified_visible_vehicle()
                self.assertIsNone(metrics.update(frame(second), vehicles).queue_count)

    def test_visible_queue_lower_bound_preserves_camera_and_session_isolation(self):
        first = self._queue_with_lost_identity_and_qualified_visible_vehicle()
        second = CameraMetrics(config(camera_id="223", stopped_threshold_per_s=0.01,
                                     stopped_min_duration_s=3,
                                     queue_region=[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]]))
        for instant in range(4):
            result = second.update(frame(instant, camera="223"), [vehicle(0.5, 0.4)])
        self.assertEqual(result.queue_count, 1)
        self.assertIsNone(first.update(frame(8), [vehicle(0.95, 0.4, identity=2)]).queue_count)
        self.assertEqual(second.update(frame(4, camera="223"), [vehicle(0.5, 0.4)]).queue_count, 1)
        for instant in range(3):
            self.assertIsNone(first.update(frame(instant, session=2), [vehicle(0.5, 0.4)]).queue_count)
        self.assertEqual(first.update(frame(3, session=2), [vehicle(0.5, 0.4)]).queue_count, 1)


class ConfigTests(unittest.TestCase):
    def raw(self):
        return json.loads((Path(__file__).resolve().parents[1] / "config/cameras/measurement.example.json").read_text())

    def test_checked_in_example_is_disabled_and_unvalidated(self):
        value = self.raw()
        self.assertFalse(value["enabled"])
        self.assertEqual(value["image_geometry_status"], "unvalidated")
        result = CameraMetrics(MetricsConfig.from_dict(value)).update(frame(0), [vehicle(0.5, 0.5)])
        self.assertIsNone(result.counts_by_class)
        self.assertIsNone(result.queue_count)
        self.assertFalse(result.enabled)

    def test_invalid_numeric_geometry_and_unreviewed_activation_are_rejected(self):
        mutations = [
            lambda r: r.update(enabled=True),
            lambda r: r["gates"][0].update(end=r["gates"][0]["start"]),
            lambda r: r["road_region"][0].__setitem__(0, float("nan")),
            lambda r: r["road_region"][0].__setitem__(1, 1.01),
            lambda r: r.update(min_track_hits=1),
            lambda r: r.update(max_gap_s=float("inf")),
            lambda r: r.update(hysteresis=0),
            lambda r: r.update(stopped_threshold_per_s=-1),
            lambda r: r.update(queue_region=r["road_region"]),
            lambda r: r.update(road_region=[[0, 0], [1, 1], [1, 0], [0, 1]]),
            lambda r: r["gates"].append(copy.deepcopy(r["gates"][0])),
            lambda r: r.update(unknown_setting=True),
        ]
        for index, mutation in enumerate(mutations):
            value = self.raw()
            mutation(value)
            with self.subTest(index=index), self.assertRaises(ValueError):
                MetricsConfig.from_dict(value)


if __name__ == "__main__":
    unittest.main()
