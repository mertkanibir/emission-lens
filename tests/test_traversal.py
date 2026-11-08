"""Synthetic mechanics only; these trajectories do not validate any camera."""

from dataclasses import FrozenInstanceError, replace
from datetime import datetime, timedelta, timezone
import json
import unittest

from worker.traversal import (
    MovementDefinition, TraversalClock, TraversalConfig, TraversalGate,
    TraversalObservation, TraversalProducer,
)


def movement(**changes):
    base = MovementDefinition(
        "through", "synthetic-movement-v1", "synthetic-view-v1",
        TraversalGate("entry", (0.2, 0.3), (0.8, 0.3), "positive"),
        TraversalGate("exit", (0.2, 0.7), (0.8, 0.7), "positive"),
        True, "synthetic-calibration-v1", "valid", "synthetic-acceptance-only",
        40.0, "synthetic-directed-path-only",
    )
    return replace(base, **changes)


def config(**changes):
    return replace(TraversalConfig(
        "222", "synthetic-run-v1", "synthetic", "synthetic-context-v1", "synthetic-view-v1",
        (movement(),), 1.5, 20.0, 0.01, 2,
    ), **changes)


def obs(y, identity=1, *, x=0.5, label="car", state="moving", method="synthetic-stop-v1"):
    return TraversalObservation(identity, (x, y), label, state, method if state != "unavailable" else None)


def update(producer, time, observations, session=1, **changes):
    args = dict(session=session, media_time_s=time, observations=observations,
                context_version=producer.config.context_version, view_version=producer.config.view_version)
    args.update(changes)
    return producer.update(**args)


def path(producer, ys=(0.1, 0.2, 0.4, 0.6, 0.8), *, start=0, session=1, **kwargs):
    results = [update(producer, start + n, [obs(y, **kwargs)], session) for n, y in enumerate(ys)]
    return [event for result in results for event in result.completed]


def clock(event, **changes):
    return replace(TraversalClock(event.session_id, datetime(2026, 11, 8, tzinfo=timezone.utc),
                                  "synthetic-clock-v1", "synthetic_anchor", "synthetic-clock-evidence"), **changes)


class TraversalMechanicsTests(unittest.TestCase):
    def test_ordered_entry_exit_uses_accepted_distance_and_total_elapsed_time(self):
        event, = path(TraversalProducer(config()))
        self.assertEqual(event.distance_m, 40)
        self.assertEqual(event.entered_media_time_s, 1.5)
        self.assertEqual(event.completed_media_time_s, 3.5)
        self.assertEqual(event.traversal_time_s, 2)
        self.assertEqual(event.stopped_time_s, 0)
        self.assertEqual(event.vehicle_class, "car")

    def test_same_frame_entry_and_exit_are_ordered_by_crossing_not_gate_iteration(self):
        event, = path(TraversalProducer(config()), (0.1, 0.9))
        self.assertEqual((event.entered_media_time_s, event.completed_media_time_s), (0.25, 0.75))
        self.assertEqual(event.traversal_time_s, 0.5)

    def test_negative_direction_and_reverse_gate_roles(self):
        m = movement(entry=TraversalGate("entry", (0.2, 0.7), (0.8, 0.7), "negative"),
                     exit=TraversalGate("exit", (0.2, 0.3), (0.8, 0.3), "negative"))
        event, = path(TraversalProducer(config(movements=(m,))), (0.9, 0.8, 0.6, 0.4, 0.2))
        self.assertEqual(event.traversal_time_s, 2)
        self.assertEqual(event.provenance.entry_crossing.direction, "negative")

    def test_wrong_direction_or_exit_first_cannot_complete(self):
        for m, ys in ((movement(), (0.9, 0.5, 0.1)),
                      (movement(), (0.5, 0.9, 0.1, 0.9)),
                      (movement(entry=replace(movement().entry, direction="negative")), (0.1, 0.5, 0.9))):
            with self.subTest(ys=ys, entry=m.entry):
                self.assertEqual(path(TraversalProducer(config(movements=(m,))), ys), [])

    def test_reversal_invalidates_open_attempt_and_reentry_cannot_rearm(self):
        self.assertEqual(path(TraversalProducer(config()), (0.1, 0.5, 0.1, 0.5, 0.9)), [])

    def test_repeated_loop_completes_at_most_once_per_track_movement_session(self):
        self.assertEqual(len(path(TraversalProducer(config()), (0.1, 0.9, 0.1, 0.9, 0.1, 0.9))), 1)

    def test_appearance_inside_segment_and_unfinished_tracks_produce_no_completion(self):
        self.assertEqual(path(TraversalProducer(config()), (0.5, 0.6, 0.9)), [])
        producer = TraversalProducer(config())
        self.assertEqual(path(producer, (0.1, 0.5)), [])
        self.assertEqual(update(producer, 0, [obs(0.9)], session=2).completed, ())

    def test_crossing_outside_either_finite_gate_is_rejected(self):
        for x in (0.1, 0.9):
            with self.subTest(x=x):
                self.assertEqual(path(TraversalProducer(config()), (0.1, 0.9), x=x), [])
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1)])
        update(producer, 1, [obs(0.5)])
        self.assertEqual(update(producer, 2, [obs(0.75, x=0.99)]).completed, ())

    def test_gate_endpoint_is_inclusive_but_touch_and_return_is_not_crossing(self):
        self.assertEqual(len(path(TraversalProducer(config()), (0.1, 0.9), x=0.2)), 1)
        self.assertEqual(path(TraversalProducer(config()), (0.1, 0.3, 0.1)), [])

    def test_touch_then_follow_gate_beyond_endpoint_cannot_arm_entry(self):
        producer = TraversalProducer(config())
        for t, x, y in ((0, 0.5, 0.1), (1, 0.5, 0.3), (2, 0.9, 0.3), (3, 0.9, 0.5), (4, 0.5, 0.9)):
            self.assertEqual(update(producer, t, [obs(y, x=x)]).completed, ())

    def test_hysteresis_uses_last_real_crossing_and_keeps_later_confirmation_separate(self):
        producer = TraversalProducer(config())
        events = path(producer, (0.1, 0.299, 0.301, 0.299, 0.301, 0.35, 0.699, 0.701, 0.8))
        event, = events
        self.assertEqual(event.entered_media_time_s, 3.5)
        self.assertEqual(event.entry_confirmed_media_time_s, 5)
        self.assertEqual(event.completed_media_time_s, 6.5)
        self.assertEqual(event.exit_confirmed_media_time_s, 8)
        self.assertEqual(event.traversal_time_s, 3)

    def test_minimum_hits_do_not_reconstruct_an_unqualified_earlier_crossing(self):
        self.assertEqual(path(TraversalProducer(config(min_track_hits=3)), (0.1, 0.5, 0.9)), [])
        self.assertEqual(len(path(TraversalProducer(config(min_track_hits=3)), (0.1, 0.299, 0.301, 0.5, 0.9))), 1)

    def test_maximum_traversal_duration_discards_unfinished_attempt(self):
        producer = TraversalProducer(config(max_traversal_s=2))
        events = path(producer, (0.1, 0.5, 0.5, 0.5, 0.9))
        self.assertEqual(events, [])

    def test_distance_is_not_sum_of_image_jitter(self):
        producer = TraversalProducer(config())
        observations = [(0.1, 0.5), (0.5, 0.5), (0.5, 0.6), (0.5, 0.4), (0.9, 0.5)]
        events = []
        for t, (y, x) in enumerate(observations):
            events.extend(update(producer, t, [obs(y, x=x)]).completed)
        self.assertEqual(events[0].distance_m, 40)

    def test_overlapping_movement_completions_are_ambiguous_not_extra_vehicles(self):
        producer = TraversalProducer(config(movements=(movement(), movement(movement_id="duplicate-path"))))
        update(producer, 0, [obs(0.1)])
        result = update(producer, 1, [obs(0.9)])
        self.assertEqual(result.completed, ())
        self.assertIn("ambiguous_movement_completion", result.issues)

    def test_one_selected_segment_per_identity_even_with_later_movement_exit(self):
        second = movement(movement_id="longer-path", exit=TraversalGate("later-exit", (0.2, 0.85), (0.8, 0.85), "positive"))
        producer = TraversalProducer(config(movements=(movement(), second)))
        events = path(producer, (0.1, 0.5, 0.8, 0.9))
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0].provenance.movement.movement_id, "through")


class ContinuityTests(unittest.TestCase):
    def test_disappearance_aborts_and_retires_numeric_identity(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1)])
        update(producer, 1, [obs(0.5)])
        self.assertIn("track_lost", update(producer, 2, []).issues)
        self.assertEqual(path(producer, (0.1, 0.5, 0.9), start=3), [])

    def test_duplicate_ids_quarantine_only_that_vehicle(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1), obs(0.1, 2)])
        result = update(producer, 1, [obs(0.5), obs(0.6), obs(0.5, 2)])
        self.assertIn("duplicate_track_id", result.issues)
        result = update(producer, 2, [obs(0.9), obs(0.9, 2)])
        self.assertEqual(len(result.completed), 1)
        self.assertEqual(result.completed[0].traversal_id,
                         path(TraversalProducer(config()), (0.1, 0.5, 0.9), identity=2)[0].traversal_id)

    def test_excessive_source_gap_cannot_bridge_old_track(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1)])
        update(producer, 1, [obs(0.5)])
        result = update(producer, 3, [obs(0.9)])
        self.assertTrue(result.discontinuity)
        self.assertIn("excessive_source_gap", result.issues)
        self.assertEqual(result.completed, ())
        self.assertEqual(path(producer, (0.1, 0.9), start=4), [])

    def test_gap_exactly_at_policy_limit_is_permitted(self):
        event, = path(TraversalProducer(config(max_gap_s=1)), (0.1, 0.5, 0.9))
        self.assertEqual(event.traversal_time_s, 1)

    def test_identical_frame_repeat_is_idempotent(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1)])
        self.assertTrue(update(producer, 0, [obs(0.1)]).duplicate)
        result = update(producer, 1, [obs(0.9)])
        self.assertEqual(len(result.completed), 1)
        repeated = update(producer, 1, [obs(0.9)])
        self.assertTrue(repeated.duplicate)
        self.assertEqual(repeated.completed, ())

    def test_conflicting_repeat_aborts_instead_of_changing_prior_position(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1)])
        update(producer, 1, [obs(0.5)])
        self.assertIn("conflicting_repeat", update(producer, 1, [obs(0.6)]).issues)
        self.assertEqual(update(producer, 2, [obs(0.9)]).completed, ())

    def test_backwards_time_aborts_existing_tracks(self):
        producer = TraversalProducer(config())
        update(producer, 1, [obs(0.1)])
        update(producer, 2, [obs(0.5)])
        self.assertIn("backwards_media_time", update(producer, 1.5, [obs(0.6)]).issues)
        self.assertEqual(update(producer, 3, [obs(0.9)]).completed, ())

    def test_reconnect_is_new_identity_and_cannot_finish_prior_entry(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1)])
        update(producer, 1, [obs(0.5)])
        result = update(producer, 0, [obs(0.9)], session=2)
        self.assertTrue(result.discontinuity)
        self.assertEqual(result.completed, ())
        first = path(TraversalProducer(config()), (0.1, 0.9), session=1)[0]
        second = path(TraversalProducer(config()), (0.1, 0.9), session=2)[0]
        self.assertNotEqual(first.session_id, second.session_id)
        self.assertNotEqual(first.traversal_id, second.traversal_id)

    def test_late_old_session_does_not_discard_current_session(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1)], session=2)
        result = update(producer, 100, [obs(0.9)], session=1, view_version="old-view")
        self.assertIn("stale_session", result.issues)
        self.assertEqual(len(update(producer, 1, [obs(0.9)], session=2).completed), 1)

    def test_context_or_view_change_latches_unavailable_even_after_session_reset(self):
        for change in ({"context_version": "new-calibration-context"}, {"view_version": "moved-camera"}):
            with self.subTest(change=change):
                producer = TraversalProducer(config())
                update(producer, 0, [obs(0.1)])
                update(producer, 1, [obs(0.5)])
                result = update(producer, 2, [obs(0.9)], **change)
                self.assertIn("context_or_view_changed", result.unavailable_reasons)
                self.assertEqual(path(producer, (0.1, 0.9), session=2), [])

    def test_camera_run_and_mode_identities_are_isolated(self):
        ids = set()
        for change in ({}, {"camera_id": "223"}, {"run_id": "another-run"}, {"mode": "replay"}):
            event, = path(TraversalProducer(config(**change)), (0.1, 0.9))
            ids.add((event.session_id, event.traversal_id))
        self.assertEqual(len(ids), 4)


class StoppedAndUnavailableTests(unittest.TestCase):
    def test_stops_belong_to_each_completed_vehicle_not_scene_total(self):
        producer = TraversalProducer(config())
        update(producer, 0, [obs(0.1), obs(0.1, 2)])
        update(producer, 1, [obs(0.5), obs(0.5, 2)])
        update(producer, 2, [obs(0.5, state="stopped"), obs(0.5, 2)])
        events = update(producer, 3, [obs(0.9), obs(0.9, 2)]).completed
        self.assertEqual(sorted(event.stopped_time_s for event in events), [0, 1])
        stopped = next(event for event in events if event.stopped_time_s == 1)
        self.assertEqual((stopped.stopped_intervals[0].start_media_time_s,
                          stopped.stopped_intervals[0].end_media_time_s), (1, 2))
        self.assertEqual(stopped.traversal_time_s, 2)

    def test_stopped_intervals_are_clipped_to_entry_exit(self):
        event, = path(TraversalProducer(config()), (0.1, 0.5, 0.9), state="stopped")
        self.assertEqual(event.stopped_time_s, event.traversal_time_s)
        self.assertEqual(len(event.stopped_intervals), 1)
        self.assertEqual((event.stopped_intervals[0].start_media_time_s,
                          event.stopped_intervals[0].end_media_time_s), (0.5, 1.5))

    def test_unavailable_stop_evidence_is_null_and_never_supported_zero(self):
        event, = path(TraversalProducer(config()), state="unavailable")
        self.assertIsNone(event.stopped_time_s)
        self.assertIsNone(event.to_completed_traversal(clock(event))["stopped_time_s"])
        self.assertEqual(event.stopped_intervals, ())

    def test_partial_or_mixed_method_stop_evidence_is_null_with_known_intervals_retained(self):
        for state, method in (("unavailable", "unused"), ("moving", "different-method")):
            with self.subTest(state=state):
                producer = TraversalProducer(config())
                update(producer, 0, [obs(0.1)])
                update(producer, 1, [obs(0.5, state="stopped")])
                update(producer, 2, [obs(0.5, state=state, method=method)])
                event, = update(producer, 3, [obs(0.9)]).completed
                self.assertIsNone(event.stopped_time_s)
                self.assertEqual(len(event.stopped_intervals), 1)
                self.assertIsNone(event.provenance.stop_method_version)

    def test_missing_or_unaccepted_physical_inputs_emit_reasons_without_completions(self):
        for change, reason in (({"accepted": False}, "movement_unaccepted"),
                               ({"calibration_status": "missing"}, "calibration_unavailable"),
                               ({"calibration_status": "invalid"}, "calibration_unavailable"),
                               ({"calibration_version": None}, "calibration_unavailable"),
                               ({"calibration_evidence": None}, "calibration_unavailable"),
                               ({"distance_m": None}, "distance_unavailable"),
                               ({"distance_source": None}, "distance_unavailable"),
                               ({"view_version": "another-view"}, "view_version_mismatch")):
            with self.subTest(change=change):
                producer = TraversalProducer(config(movements=(movement(**change),)))
                result = update(producer, 0, [obs(0.1)])
                self.assertIn("through:" + reason, result.unavailable_reasons)
                self.assertEqual(update(producer, 1, [obs(0.9)]).completed, ())
        result = update(TraversalProducer(config(movements=())), 0, [])
        self.assertEqual(result.unavailable_reasons, ("movement_missing",))

    def test_unknown_unrecognized_and_conflicting_classes_stay_unknown(self):
        for labels in (("unknown", "unknown"), ("car", "unknown"), ("unknown", "car"), ("car", "bus"), ("unrecognized", "car")):
            with self.subTest(labels=labels):
                producer = TraversalProducer(config())
                update(producer, 0, [obs(0.1, label=labels[0])])
                event, = update(producer, 1, [obs(0.9, label=labels[1])]).completed
                self.assertEqual(event.vehicle_class, "unknown")

    def test_unresolved_history_is_pruned_before_entry_and_after_completion(self):
        producer = TraversalProducer(config())
        for n in range(100):
            update(producer, n, [obs(0.1, state="moving" if n % 2 else "stopped")])
        self.assertEqual(producer._tracks[1].intervals, [])
        update(producer, 100, [obs(0.5)])
        update(producer, 101, [obs(0.9)])
        self.assertEqual(producer._tracks[1].intervals, [])


class ClockAndValidationTests(unittest.TestCase):
    def test_adapter_has_exact_consumer_fields_and_internal_provenance_is_json_serializable(self):
        event, = path(TraversalProducer(config()), (0.1, 0.9))
        core = event.to_completed_traversal(clock(event))
        self.assertEqual(set(core), {"session_id", "traversal_id", "completed_at", "vehicle_class", "distance_m", "traversal_time_s", "stopped_time_s"})
        self.assertEqual(core["completed_at"], "2026-11-08T00:00:00.750000Z")
        record = event.to_record(clock(event))
        encoded = json.dumps(record, allow_nan=False)
        self.assertNotIn('"track_id"', encoded)
        self.assertEqual(record["provenance"]["movement"]["distance_source"], "synthetic-directed-path-only")
        self.assertEqual(record["provenance"]["completion_timing_basis"]["attribution"], "interpolated_exit_crossing")

    def test_clock_revision_rebins_same_identity_without_recreating_completion(self):
        event, = path(TraversalProducer(config()), (0.1, 0.9))
        original = clock(event, anchor_utc=datetime(2026, 11, 8, 0, 0, 59, 500000, tzinfo=timezone.utc))
        revised = replace(original, anchor_utc=original.anchor_utc - timedelta(seconds=1))
        first, second = event.to_completed_traversal(original), event.to_completed_traversal(revised)
        self.assertEqual(first["completed_at"], "2026-11-08T00:01:00.250000Z")
        self.assertEqual(second["completed_at"], "2026-11-08T00:00:59.250000Z")
        self.assertEqual({k: v for k, v in first.items() if k != "completed_at"},
                         {k: v for k, v in second.items() if k != "completed_at"})

    def test_estimated_hls_basis_is_explicit_and_uses_crossing_not_confirmation(self):
        producer = TraversalProducer(config(mode="live"))
        event, = path(producer, (0.1, 0.5, 0.699, 0.701, 0.8))
        mapped = clock(event, basis="estimated_hls_media")
        record = event.to_record(mapped)
        self.assertEqual(record["completed_at"], "2026-11-08T00:00:02.500000Z")
        self.assertEqual(event.exit_confirmed_media_time_s, 4)
        self.assertEqual(record["provenance"]["completion_timing_basis"]["clock_basis"], "estimated_hls_media")

    def test_wrong_clock_session_mode_and_naive_anchor_are_rejected(self):
        event, = path(TraversalProducer(config()), (0.1, 0.9))
        with self.assertRaises(ValueError):
            event.to_record(None)
        for change in ({"session_id": "other-session"}, {"basis": "estimated_hls_media"}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                event.to_record(clock(event, **change))
        with self.assertRaises(ValueError):
            clock(event, anchor_utc=datetime(2026, 11, 8))
        event, = path(TraversalProducer(config(mode="live")), (0.1, 0.9))
        with self.assertRaises(ValueError):
            event.to_record(clock(event, basis="recording_anchor"))

    def test_clock_overflow_cannot_create_a_completed_utc_record(self):
        event, = path(TraversalProducer(config()), (0.1, 0.9))
        with self.assertRaises(ValueError):
            event.to_record(clock(event, anchor_utc=datetime.max.replace(tzinfo=timezone.utc)))

    def test_replay_recording_anchor_and_utc_conversion(self):
        event, = path(TraversalProducer(config(mode="replay")), (0.1, 0.9))
        mapped = clock(event, basis="recording_anchor", anchor_utc=datetime(2026, 11, 8, 1, tzinfo=timezone(timedelta(hours=1))))
        self.assertEqual(event.to_record(mapped)["completed_at"], "2026-11-08T00:00:00.750000Z")

    def test_frozen_inputs_copy_mutable_point_and_movement_containers(self):
        point = [0.5, 0.1]
        observation = TraversalObservation(1, point)
        point[1] = 0.9
        self.assertEqual(observation.point, (0.5, 0.1))
        movements = [movement()]
        cfg = config(movements=movements)
        movements.clear()
        self.assertEqual(len(cfg.movements), 1)
        with self.assertRaises(FrozenInstanceError):
            cfg.context_version = "changed"

    def test_invalid_gate_policy_and_calibrated_values_are_rejected(self):
        calls = [lambda: TraversalGate("g", (0, 0), (0, 0), "positive"),
                 lambda: TraversalGate("g", (0, 0), (1, 1), "both"),
                 lambda: movement(distance_m=-1), lambda: movement(distance_m=float("nan")),
                 lambda: movement(exit=movement().entry), lambda: config(max_gap_s=0),
                 lambda: config(hysteresis=float("inf")), lambda: config(min_track_hits=True),
                 lambda: config(min_track_hits=1), lambda: config(max_traversal_s=0.5),
                 lambda: config(movements=(movement(), movement())), lambda: config(mode="mixed")]
        for n, call in enumerate(calls):
            with self.subTest(n=n), self.assertRaises(ValueError):
                call()

    def test_invalid_observation_source_times_and_sessions_are_rejected(self):
        calls = [lambda: TraversalObservation(True, (0, 0)),
                 lambda: TraversalObservation(1, (float("nan"), 0)),
                 lambda: TraversalObservation(1, (1.1, 0)),
                 lambda: TraversalObservation(1, (0, 0), interval_state="stopped"),
                 lambda: TraversalObservation(1, (0, 0), interval_state="idling")]
        for n, call in enumerate(calls):
            with self.subTest(n=n), self.assertRaises(ValueError):
                call()
        producer = TraversalProducer(config())
        for change in ({"media_time_s": -1}, {"media_time_s": float("inf")}, {"session": True}, {"session": -1}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                update(producer, 0, [], **change)


if __name__ == "__main__":
    unittest.main()
