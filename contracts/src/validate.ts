import type { EmissionsMinute, TrafficMinute } from "./types.ts";

const UNAVAILABLE: Array<EmissionsMinute["quality_state"]> = [
  "unavailable",
  "insufficient_evidence",
];

export function validateEmissionsMinute(row: EmissionsMinute): void {
  if (UNAVAILABLE.includes(row.quality_state)) {
    if (row.estimate_g !== null || row.range_low_g !== null || row.range_high_g !== null) {
      throw new Error(
        "Unavailable or insufficient emissions cannot carry a numeric estimate, including zero.",
      );
    }
  }
  if (row.quality_state === "ok" && row.estimate_g === null) {
    throw new Error("A supported emissions estimate is required when quality is ok.");
  }
  if (row.quality_state === "calibration_invalid" && row.estimate_g !== null) {
    throw new Error("Distance-based emissions stay empty when calibration is invalid.");
  }
}

export function validateTrafficMinute(row: TrafficMinute): void {
  for (const [name, value] of [
    ["count", row.count],
    ["completed_traversals", row.completed_traversals],
    ["stopped_vehicle_seconds", row.stopped_vehicle_seconds],
    ["traversal_time_s", row.traversal_time_s],
    ["distance_m", row.distance_m],
    ["queue_count", row.queue_count],
    ["queue_length_m", row.queue_length_m],
  ] as const) {
    if (value !== null && value < 0) {
      throw new Error(`${name} cannot be negative.`);
    }
  }
  if (row.coverage !== null && (row.coverage < 0 || row.coverage > 1)) {
    throw new Error("coverage must be between 0 and 1, or null.");
  }
}

/** Sum only when every value is a real number. Missing data stays null, not zero. */
export function sumStrict(values: Array<number | null>): number | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value as number), 0);
}
