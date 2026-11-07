import { MODES, POLLUTANTS, QUALITY_STATES, VEHICLE_CLASSES, type EmissionsMinute, type TrafficMinute } from "./types.ts";

const UNAVAILABLE: Array<EmissionsMinute["quality_state"]> = [
  "unavailable",
  "insufficient_evidence",
  "calibration_invalid",
];

/** UTC only: an unavailable timestamp is null, never an invented capture time. */
export function validateUtcTimestamp(value: unknown, name: string, nullable = false): void {
  if (value === null && nullable) return;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value)) {
    throw new Error(`${name} must be a UTC timestamp${nullable ? " or null" : ""}.`);
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 19) !== value.slice(0, 19)) {
    throw new Error(`${name} must be a valid UTC timestamp.`);
  }
}

function minuteAndMode(row: EmissionsMinute | TrafficMinute): void {
  validateUtcTimestamp(row.minute, "minute");
  if (Date.parse(row.minute) % 60_000 !== 0 || /\.(\d*[1-9]\d*)(?:Z|\+00:00)$/.test(row.minute)) {
    throw new Error("minute must be aligned to the start of a UTC minute.");
  }
  if (!MODES.includes(row.mode)) throw new Error("Unknown data mode.");
  if (typeof row.camera_id !== "string" || row.camera_id.length === 0) throw new Error("camera_id is required.");
}

function nonnegative(value: unknown, name: string, integer = false): void {
  if (value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${name} must be a finite nonnegative ${integer ? "integer" : "number"}, or null.`);
  }
}

export function validateEmissionsMinute(row: EmissionsMinute): void {
  minuteAndMode(row);
  if (!POLLUTANTS.includes(row.pollutant)) throw new Error("Unknown pollutant.");
  if (!QUALITY_STATES.includes(row.quality_state)) throw new Error("Unknown emissions quality state.");
  for (const name of ["estimate_g", "range_low_g", "range_high_g"] as const) nonnegative(row[name], name);
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
  if ((row.range_low_g === null) !== (row.range_high_g === null)) throw new Error("Scenario range needs both endpoints, or neither.");
  if (row.range_low_g !== null && row.range_high_g !== null && (
    row.range_low_g > row.range_high_g || row.estimate_g === null || row.range_low_g > row.estimate_g || row.range_high_g < row.estimate_g
  )) throw new Error("Scenario range must contain the central estimate.");
}

export function validateTrafficMinute(row: TrafficMinute): void {
  minuteAndMode(row);
  if (!VEHICLE_CLASSES.includes(row.vehicle_class)) throw new Error("Unknown vehicle class.");
  for (const [name, value] of [
    ["count", row.count],
    ["completed_traversals", row.completed_traversals],
    ["stopped_vehicle_seconds", row.stopped_vehicle_seconds],
    ["traversal_time_s", row.traversal_time_s],
    ["distance_m", row.distance_m],
    ["queue_count", row.queue_count],
    ["queue_length_m", row.queue_length_m],
  ] as const) {
    nonnegative(value, name, ["count", "completed_traversals", "queue_count"].includes(name));
  }
  nonnegative(row.coverage, "coverage");
  if (row.coverage !== null && row.coverage > 1) {
    throw new Error("coverage must be between 0 and 1, or null.");
  }
}

/** Sum only when every value is a real number. Missing data stays null, not zero. */
export function sumStrict(values: Array<number | null>): number | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value as number), 0);
}
