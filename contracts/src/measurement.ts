import { cameraById } from "./cameras.ts";
import { parseWorkerBatch } from "./ingest.ts";
import {
  VEHICLE_CLASSES,
  type Mode,
  type VehicleClass,
  type WorkerRun,
} from "./types.ts";
import { validateTrafficMinute, validateUtcTimestamp } from "./validate.ts";

export const MEASUREMENT_VERSION = "1.0" as const;
export interface MeasurementObservation {
  vehicle_class: VehicleClass;
  count: number | null;
  stopped_vehicle_seconds: number | null;
  queue_count: number | null;
  coverage: number | null;
}
export interface MeasurementTraversal {
  session_id: string;
  traversal_id: string;
  movement_id: string;
  completed_at: string;
  entry_media_s: number;
  exit_media_s: number;
  traversal_time_s: number;
  stopped_time_s: number | null;
  vehicle_class: VehicleClass;
}
export interface MeasurementBatch {
  measurement_version: typeof MEASUREMENT_VERSION;
  batch_id: string;
  revision: number;
  run: WorkerRun;
  camera_id: string;
  mode: Mode;
  minute: string;
  calibration_version: string | null;
  mapping_version: string | null;
  units: { distance: "m"; time: "s" };
  timing: {
    basis: "estimated_hls_media_utc";
    clock_method: "hls-min-anchor-v1";
    sessions: Array<{ session_id: string; anchor_utc: string }>;
  };
  meteorology: { temperature_f: number; relative_humidity_pct: number };
  observation_ref: { batch_id: string; revision: number } | null;
  observations: MeasurementObservation[];
  traversals: MeasurementTraversal[];
  retract: boolean;
}
export function exactObject(
  value: unknown,
  keys: readonly string[],
  name: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error(`${name} must be an object.`);
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some((key) => !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(row, key))
  )
    throw new Error(`${name} has missing or unsupported fields.`);
  return row;
}
export function boundedText(
  value: unknown,
  name: string,
  nullable = false,
): asserts value is string | null {
  if (nullable && value === null) return;
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 256 ||
    /[\u0000-\u001f]/.test(value)
  )
    throw new Error(
      `${name} must be a bounded nonempty string${nullable ? " or null" : ""}.`,
    );
}
export function utcMicros(value: string): number {
  validateUtcTimestamp(value, "timestamp");
  const fraction = value.match(/\.(\d+)(?:Z|\+00:00)$/)?.[1] ?? "";
  return Date.parse(value) * 1000 + Number(fraction.padEnd(6, "0").slice(3, 6));
}
function finite(
  value: unknown,
  name: string,
  min = 0,
  max = 1e9,
): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${name} is outside the finite supported range.`);
}
function array(value: unknown, max: number, name: string): unknown[] {
  if (!Array.isArray(value) || value.length > max)
    throw new Error(`${name} exceeds its record limit.`);
  return value;
}
function uuid(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error("Expected a UUID.");
}
export function parseMeasurementBatch(value: unknown): MeasurementBatch {
  const row = exactObject(
    value,
    [
      "measurement_version",
      "batch_id",
      "revision",
      "run",
      "camera_id",
      "mode",
      "minute",
      "calibration_version",
      "mapping_version",
      "units",
      "timing",
      "meteorology",
      "observation_ref",
      "observations",
      "traversals",
      "retract",
    ],
    "measurement",
  );
  if (row.measurement_version !== MEASUREMENT_VERSION)
    throw new Error("Unsupported measurement version.");
  const worker = parseWorkerBatch({
    contract_version: "1.1",
    batch_id: row.batch_id,
    revision: row.revision,
    run: row.run,
    statuses: [],
    traffic: [],
    emissions: [],
  });
  if (
    typeof row.camera_id !== "string" ||
    !cameraById(row.camera_id) ||
    row.mode !== worker.run.mode
  )
    throw new Error("Measurement camera/mode does not match its run.");
  validateUtcTimestamp(row.minute, "minute");
  if (
    Date.parse(row.minute as string) % 60_000 !== 0 ||
    /\.(\d*[1-9]\d*)(?:Z|\+00:00)$/.test(row.minute as string)
  )
    throw new Error("Measurement minute must be aligned to UTC.");
  boundedText(row.calibration_version, "calibration_version", true);
  boundedText(row.mapping_version, "mapping_version", true);
  const units = exactObject(row.units, ["distance", "time"], "units");
  if (units.distance !== "m" || units.time !== "s")
    throw new Error(
      "Physical units must be metres and seconds; image units are unsupported.",
    );
  const timing = exactObject(
    row.timing,
    ["basis", "clock_method", "sessions"],
    "timing",
  );
  if (
    timing.basis !== "estimated_hls_media_utc" ||
    timing.clock_method !== "hls-min-anchor-v1"
  )
    throw new Error("Explicit supported estimated media timing is required.");
  const sessions = array(timing.sessions, 32, "sessions").map((value) => {
    const session = exactObject(value, ["session_id", "anchor_utc"], "session");
    boundedText(session.session_id, "session_id");
    validateUtcTimestamp(session.anchor_utc, "anchor_utc");
    return {
      session_id: session.session_id as string,
      anchor_utc: session.anchor_utc as string,
    };
  });
  if (new Set(sessions.map((s) => s.session_id)).size !== sessions.length)
    throw new Error("Duplicate timing session.");
  const met = exactObject(
    row.meteorology,
    ["temperature_f", "relative_humidity_pct"],
    "meteorology",
  );
  finite(met.temperature_f, "temperature_f", -200, 200);
  finite(met.relative_humidity_pct, "relative_humidity_pct", 0, 100);
  let observation_ref: MeasurementBatch["observation_ref"] = null;
  if (row.observation_ref !== null) {
    const ref = exactObject(
      row.observation_ref,
      ["batch_id", "revision"],
      "observation_ref",
    );
    uuid(ref.batch_id);
    if (!Number.isSafeInteger(ref.revision) || (ref.revision as number) < 0)
      throw new Error("Invalid observation revision.");
    observation_ref = {
      batch_id: ref.batch_id.toLowerCase(),
      revision: ref.revision as number,
    };
  }
  const observations = array(row.observations, 9, "observations").map(
    (value) => {
      const obs = exactObject(
        value,
        [
          "vehicle_class",
          "count",
          "stopped_vehicle_seconds",
          "queue_count",
          "coverage",
        ],
        "observation",
      );
      validateTrafficMinute({
        camera_id: row.camera_id as string,
        minute: row.minute as string,
        mode: worker.run.mode,
        run_id: worker.run.run_id,
        vehicle_class: obs.vehicle_class as VehicleClass,
        count: obs.count as number | null,
        stopped_vehicle_seconds: obs.stopped_vehicle_seconds as number | null,
        queue_count: obs.queue_count as number | null,
        coverage: obs.coverage as number | null,
        completed_traversals: null,
        traversal_time_s: null,
        distance_m: null,
        queue_length_m: null,
      });
      return obs as unknown as MeasurementObservation;
    },
  );
  if (
    new Set(observations.map((o) => o.vehicle_class)).size !==
    observations.length
  )
    throw new Error("Duplicate observation class.");
  if (
    observations.filter((o) => o.queue_count !== null).length > 1 ||
    new Set(observations.map((o) => o.coverage).filter((x) => x !== null))
      .size > 1
  )
    throw new Error(
      "Queue/coverage are camera-minute observations, not class sums.",
    );
  const identities = new Set<string>();
  const traversals = array(row.traversals, 1000, "traversals").map((value) => {
    const t = exactObject(
      value,
      [
        "session_id",
        "traversal_id",
        "movement_id",
        "completed_at",
        "entry_media_s",
        "exit_media_s",
        "traversal_time_s",
        "stopped_time_s",
        "vehicle_class",
      ],
      "traversal",
    );
    for (const key of ["session_id", "traversal_id", "movement_id"])
      boundedText(t[key], key);
    if (!VEHICLE_CLASSES.includes(t.vehicle_class as VehicleClass))
      throw new Error("Unsupported traversal class.");
    const session = sessions.find((s) => s.session_id === t.session_id);
    if (!session) throw new Error("Traversal has no matching timing session.");
    finite(t.entry_media_s, "entry_media_s");
    finite(t.exit_media_s, "exit_media_s");
    finite(t.traversal_time_s, "traversal_time_s");
    if (
      t.exit_media_s <= t.entry_media_s ||
      Math.abs(t.traversal_time_s - (t.exit_media_s - t.entry_media_s)) > 1e-6
    )
      throw new Error(
        "Traversal duration must equal its advancing entry/exit media interval.",
      );
    if (t.stopped_time_s !== null)
      finite(t.stopped_time_s, "stopped_time_s", 0, t.traversal_time_s);
    validateUtcTimestamp(t.completed_at, "completed_at");
    const at = utcMicros(t.completed_at as string);
    const expected =
      utcMicros(session.anchor_utc) + Math.round(t.exit_media_s * 1e6);
    if (
      Math.abs(at - expected) > 2 ||
      Date.parse(t.completed_at as string) < Date.parse(row.minute as string) ||
      Date.parse(t.completed_at as string) >=
        Date.parse(row.minute as string) + 60_000
    )
      throw new Error(
        "Traversal completion must match its media clock and reporting minute.",
      );
    const key = JSON.stringify([t.session_id, t.traversal_id]);
    if (identities.has(key)) throw new Error("Duplicate completed traversal.");
    identities.add(key);
    return t as unknown as MeasurementTraversal;
  });
  if (
    typeof row.retract !== "boolean" ||
    (row.retract && (observations.length || traversals.length))
  )
    throw new Error("Retractions must have empty observations and traversals.");
  return JSON.parse(
    JSON.stringify({
      measurement_version: MEASUREMENT_VERSION,
      batch_id: worker.batch_id,
      revision: worker.revision,
      run: worker.run,
      camera_id: row.camera_id,
      mode: worker.run.mode,
      minute: new Date(row.minute as string).toISOString(),
      calibration_version: row.calibration_version,
      mapping_version: row.mapping_version,
      units: { distance: "m", time: "s" },
      timing: {
        basis: timing.basis,
        clock_method: timing.clock_method,
        sessions,
      },
      meteorology: met,
      observation_ref,
      observations,
      traversals,
      retract: row.retract,
    }),
  ) as MeasurementBatch;
}
