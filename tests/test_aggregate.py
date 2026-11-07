"""Receipt-minute aggregation uses synthetic events and no camera assumptions."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import unittest

from worker.aggregate import MinuteAggregator
from worker.metrics import CameraMetrics, MetricsConfig


NOW = datetime(2026, 11, 7, 23, 30, 59, tzinfo=timezone.utc)


def config(**changes):
    raw = {"camera_id": "222", "version": "test-reviewed-v1", "enabled": True,
           "image_geometry_status": "reviewed", "road_region": [[0, 0], [1, 0], [1, 1], [0, 1]],
           "excluded_regions": [], "gates": [{"id": "selected", "start": [0.1, 0.5], "end": [0.9, 0.5], "direction": "both"}]}
    raw.update(changes)
    return MetricsConfig.from_dict(raw)


def frame(media=0, received=NOW, session=1, camera="222"):
    return SimpleNamespace(camera_id=camera, session=session, media_time_s=media, received_at=received)


def event(gate="selected", label="car", session=1):
    return SimpleNamespace(camera_id="222", session=session, gate_id=gate, vehicle_class=label)


def update(events=(), enabled=True, queue=None, session=1):
    # The engine's cumulative totals must not be mistaken for new events.
    return SimpleNamespace(camera_id="222", session=session, enabled=enabled, crossings=events,
                           counts_by_class={"car": 999}, queue_count=queue)


def run(mode="live", run_id="run-1"):
    return {"run_id": run_id, "mode": mode}


class AggregateTests(unittest.TestCase):
    def test_only_selected_gate_events_count_and_zeros_require_observation(self):
        aggregate = MinuteAggregator(config(), "run-1", "live")
        self.assertEqual(aggregate.batches(run()), [])
        aggregate.observe(frame(), update((event(), event("other", "truck"))))
        rows = aggregate.batches(run())[0]["traffic"]
        self.assertEqual({r["vehicle_class"]: r["count"] for r in rows}["car"], 1)
        self.assertEqual(sum(r["count"] for r in rows), 1)
        self.assertEqual(len(rows), 4)
        self.assertNotIn("tesla", {row["vehicle_class"] for row in rows})

    def test_cumulative_snapshots_keep_uuid_and_increase_revision(self):
        aggregate = MinuteAggregator(config(), "run-1", "live")
        aggregate.observe(frame(), update((event(),)))
        first = aggregate.batches(run())[0]
        self.assertEqual(first["revision"], 0)
        self.assertEqual(aggregate.batches(run()), [])
        aggregate.observe(frame(0.2), update((event(label="bus"),)))
        second = aggregate.batches(run())[0]
        self.assertEqual(first["batch_id"], second["batch_id"])
        self.assertEqual(second["revision"], 1)
        self.assertEqual(sum(r["count"] for r in second["traffic"]), 2)

    def test_duplicate_frame_cannot_add_events_twice(self):
        aggregate = MinuteAggregator(config(), "run-1", "live")
        aggregate.observe(frame(), update((event(),)))
        aggregate.observe(frame(), update((event(),)))
        self.assertEqual(sum(r["count"] for r in aggregate.batches(run())[0]["traffic"]), 1)

    def test_receipt_utc_minute_boundary_keeps_mode_separate(self):
        live = MinuteAggregator(config(), "run-1", "live")
        replay = MinuteAggregator(config(), "run-1", "replay")
        for aggregate in (live, replay):
            aggregate.observe(frame(), update((event(),)))
            aggregate.observe(frame(0.2, NOW + timedelta(seconds=1)), update())
        batches = live.batches(run())
        self.assertEqual([b["traffic"][0]["minute"] for b in batches], ["2026-11-07T23:30:00+00:00", "2026-11-07T23:31:00+00:00"])
        replay_batches = replay.batches(run("replay"))
        self.assertNotEqual(batches[0]["batch_id"], replay_batches[0]["batch_id"])
        self.assertEqual(replay_batches[0]["traffic"][0]["mode"], "replay")

    def test_unreviewed_or_disabled_config_never_produces_supported_zero(self):
        aggregate = MinuteAggregator(config(enabled=False, image_geometry_status="unvalidated"), "run-1", "live")
        aggregate.observe(frame(), update(enabled=False))
        self.assertEqual(aggregate.batches(run()), [])

    def test_multiple_gates_need_explicit_selection(self):
        gates = [{"id": value, "start": [0.1, y], "end": [0.9, y], "direction": "both"} for value, y in (("first", 0.4), ("second", 0.6))]
        with self.assertRaisesRegex(ValueError, "explicitly"):
            MinuteAggregator(config(gates=gates), "run-1", "live")
        self.assertEqual(MinuteAggregator(config(gates=gates), "run-1", "live", "second").count_gate_id, "second")

    def test_queue_on_one_row_and_unsupported_quantities_remain_null(self):
        aggregate = MinuteAggregator(config(stopped_threshold_per_s=0.01, queue_region=[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]]), "run-1", "live")
        aggregate.observe(frame(), update(queue=4))
        rows = aggregate.batches(run())[0]["traffic"]
        self.assertEqual([row["queue_count"] for row in rows if row["queue_count"] is not None], [4])
        for row in rows:
            for field in ("completed_traversals", "stopped_vehicle_seconds", "traversal_time_s", "distance_m", "queue_length_m", "coverage"):
                self.assertIsNone(row[field])

    def test_new_run_has_distinct_uuid_and_cannot_reuse_existing_aggregator(self):
        first = MinuteAggregator(config(), "run-1", "live")
        second = MinuteAggregator(config(), "run-2", "live")
        for aggregate in (first, second):
            aggregate.observe(frame(), update())
        self.assertNotEqual(first.batches(run())[0]["batch_id"], second.batches(run(run_id="run-2"))[0]["batch_id"])
        with self.assertRaisesRegex(ValueError, "immutable"):
            first.batches(run("replay"))

    def test_only_actual_model_classes_can_be_supported_zeros(self):
        aggregate = MinuteAggregator(config(), "run-1", "live", supported_classes={"car", "tesla", "pickup"})
        aggregate.observe(frame(), update())
        rows = aggregate.batches(run())[0]["traffic"]
        self.assertEqual({row["vehicle_class"] for row in rows}, {"car", "tesla", "pickup"})
        self.assertEqual(sum(row["count"] for row in rows), 0)
        with self.assertRaisesRegex(ValueError, "not supported"):
            aggregate.observe(frame(0.2), update((event(label="truck"),)))
        self.assertEqual(aggregate.batches(run()), [])

    def test_aware_non_utc_receipt_is_normalized_to_utc_minute(self):
        aggregate = MinuteAggregator(config(), "run-1", "live")
        local = NOW.astimezone(timezone(timedelta(hours=-5)))
        aggregate.observe(frame(received=local), update())
        self.assertEqual(aggregate.batches(run())[0]["traffic"][0]["minute"], "2026-11-07T23:30:00+00:00")

    def test_real_image_metrics_events_are_aggregated_once_not_per_frame(self):
        settings = config()
        metrics = CameraMetrics(settings)
        aggregate = MinuteAggregator(settings, "run-1", "live")
        for index, y in enumerate((0.4, 0.45, 0.6, *([0.6] * 12))):
            current = frame(index * 0.2)
            current.image = SimpleNamespace(shape=(100, 100, 3))
            vehicle = SimpleNamespace(track_id=1, label="car", detection=SimpleNamespace(x1=49, x2=51, y1=y * 100 - 2, y2=y * 100))
            aggregate.observe(current, metrics.update(current, [vehicle]))
        self.assertEqual(sum(row["count"] for row in aggregate.batches(run())[0]["traffic"]), 1)


if __name__ == "__main__":
    unittest.main()
