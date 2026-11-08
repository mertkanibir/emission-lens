import assert from "node:assert/strict";
import test from "node:test";
import type { TrafficMinute } from "@emission-lens/contracts";
import { recordedMinuteHistory } from "../src/lib/minute-history.ts";

/** Public contract-shaped records only; no service or physical approval is installed. */
function traffic(overrides: Partial<TrafficMinute> = {}): TrafficMinute {
  return {
    camera_id: "222",
    minute: "2026-11-08T03:58:00Z",
    run_id: "history-render-test",
    vehicle_class: "car",
    mode: "replay",
    count: 0,
    completed_traversals: 0,
    stopped_vehicle_seconds: 0,
    traversal_time_s: 0,
    distance_m: 0,
    queue_count: null,
    queue_length_m: null,
    coverage: 1,
    ...overrides,
  };
}

test("equivalent UTC minutes combine all class records without mutating their original shape", () => {
  const rows = [
    traffic({ minute: "2026-11-08T03:59:00Z", vehicle_class: "unknown", count: 7, completed_traversals: null, stopped_vehicle_seconds: null }),
    traffic({ minute: "2026-11-08T03:58:00+00:00", vehicle_class: "truck", count: 2, completed_traversals: 1, stopped_vehicle_seconds: 0 }),
    traffic({ minute: "2026-11-08T03:58:00.000Z", vehicle_class: "car", count: 23, completed_traversals: 8, stopped_vehicle_seconds: 3 }),
    traffic({ minute: "2026-11-08T03:58:00Z", vehicle_class: "car", count: 1, completed_traversals: 1, stopped_vehicle_seconds: 2 }),
  ];
  const before = structuredClone(rows);
  for (const row of rows) Object.freeze(row);
  Object.freeze(rows);

  assert.deepEqual(recordedMinuteHistory(rows), [
    { minute: "2026-11-08T03:58:00.000Z", count: 26, traversals: 10, stopped: 5 },
    { minute: "2026-11-08T03:59:00.000Z", count: 7, traversals: null, stopped: null },
  ]);
  assert.deepEqual(rows, before);
  assert.equal(rows[1].vehicle_class, "truck");
  assert.equal(rows[1].minute, "2026-11-08T03:58:00+00:00");
});

test("a null in any record keeps that minute's corresponding summary unavailable", () => {
  assert.deepEqual(recordedMinuteHistory([
    traffic({ count: 23, completed_traversals: 8, stopped_vehicle_seconds: null }),
    traffic({ minute: "2026-11-08T03:58:00+00:00", vehicle_class: "unknown", count: 0, completed_traversals: null, stopped_vehicle_seconds: 0 }),
    traffic({ minute: "2026-11-08T03:59:00Z", vehicle_class: "truck", count: null, completed_traversals: 1, stopped_vehicle_seconds: 0 }),
    traffic({ minute: "2026-11-08T03:59:00.000Z", count: 5, completed_traversals: 4, stopped_vehicle_seconds: 0 }),
  ]), [
    { minute: "2026-11-08T03:58:00.000Z", count: 23, traversals: null, stopped: null },
    { minute: "2026-11-08T03:59:00.000Z", count: null, traversals: 5, stopped: 0 },
  ]);
});

test("supported zero, empty history and genuinely separate minutes remain distinct", () => {
  assert.deepEqual(recordedMinuteHistory([]), []);
  assert.deepEqual(recordedMinuteHistory([
    traffic({ minute: "2026-11-08T04:01:00.000Z", count: null, completed_traversals: null, stopped_vehicle_seconds: null }),
    traffic({ minute: "2026-11-08T04:00:00+00:00", vehicle_class: "truck" }),
    traffic({ minute: "2026-11-08T04:00:00Z" }),
  ]), [
    { minute: "2026-11-08T04:00:00.000Z", count: 0, traversals: 0, stopped: 0 },
    { minute: "2026-11-08T04:01:00.000Z", count: null, traversals: null, stopped: null },
  ]);
});
