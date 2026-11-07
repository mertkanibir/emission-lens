import { calibrationFor, cameraById } from "./cameras.ts";
import { CAMERA_STATES, CONTRACT_VERSION, MODES, type CameraStatus, type EmissionsMinute, type TrafficMinute, type WorkerRun } from "./types.ts";
import { validateEmissionsMinute, validateTrafficMinute, validateUtcTimestamp } from "./validate.ts";

/** Additive transport envelope. Core records retain contract 1.1 semantics. */
export interface WorkerBatch {
  contract_version: typeof CONTRACT_VERSION;
  batch_id: string;
  revision: number;
  run: WorkerRun;
  statuses: CameraStatus[];
  traffic: TrafficMinute[];
  emissions: EmissionsMinute[];
}

function object(value: unknown, keys: string[], name: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error(`${name} must be an object.`);
  }
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !keys.includes(key)) || keys.some((key) => !Object.hasOwn(result, key))) {
    throw new Error(`${name} has missing or unsupported fields.`);
  }
  return result;
}

function text(value: unknown, name: string, nullable = false): void {
  if (value === null && nullable) return;
  if (typeof value !== "string" || value.length === 0 || value.length > 256 || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`${name} must be a nonempty string${nullable ? " or null" : ""}.`);
  }
}

function numberOrNull(value: unknown, name: string): void {
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
    throw new Error(`${name} must be finite and nonnegative, or null.`);
  }
}

function cameraAndMode(row: Record<string, unknown>, run: WorkerRun): void {
  if (typeof row.camera_id !== "string" || !cameraById(row.camera_id)) throw new Error("Unknown camera_id.");
  if (row.mode !== run.mode) throw new Error("All batch records must have the worker run's mode.");
}

function rows<T>(value: unknown, max: number, name: string, parse: (row: unknown) => T): T[] {
  if (!Array.isArray(value) || value.length > max) throw new Error(`${name} must be an array of at most ${max} records.`);
  return value.map(parse);
}

function unique<T>(items: T[], key: (item: T) => string, name: string): void {
  const keys = items.map(key);
  if (new Set(keys).size !== keys.length) throw new Error(`${name} contains duplicate record keys.`);
}

/** Reject the whole request on malformed, mixed-mode or unsupported observations. */
export function parseWorkerBatch(value: unknown): WorkerBatch {
  const raw = object(value, ["contract_version", "batch_id", "revision", "run", "statuses", "traffic", "emissions"], "batch");
  if (raw.contract_version !== CONTRACT_VERSION) throw new Error(`contract_version must be ${CONTRACT_VERSION}.`);
  if (typeof raw.batch_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.batch_id)) throw new Error("batch_id must be a UUID.");
  if (typeof raw.revision !== "number" || !Number.isSafeInteger(raw.revision) || raw.revision < 0) throw new Error("revision must be a nonnegative safe integer.");
  const runRaw = object(raw.run, ["run_id", "model_version", "device", "started_at", "ended_at", "mode"], "run");
  text(runRaw.run_id, "run_id");
  text(runRaw.model_version, "model_version", true);
  text(runRaw.device, "device", true);
  validateUtcTimestamp(runRaw.started_at, "started_at", true);
  validateUtcTimestamp(runRaw.ended_at, "ended_at", true);
  if (!MODES.includes(runRaw.mode as WorkerRun["mode"])) throw new Error("Unknown run mode.");
  const run = runRaw as unknown as WorkerRun;
  if (run.ended_at !== null && (run.started_at === null || Date.parse(run.ended_at) < Date.parse(run.started_at))) throw new Error("Run end must follow a known start.");
  const statuses = rows(raw.statuses, 4, "statuses", (value) => {
    const row = object(value, ["camera_id", "heartbeat_at", "last_source_timestamp", "processing_delay_ms", "fps", "state", "mode"], "status");
    cameraAndMode(row, run);
    validateUtcTimestamp(row.heartbeat_at, "heartbeat_at", true);
    validateUtcTimestamp(row.last_source_timestamp, "last_source_timestamp", true);
    numberOrNull(row.processing_delay_ms, "processing_delay_ms");
    if (row.processing_delay_ms !== null && !Number.isSafeInteger(row.processing_delay_ms)) throw new Error("processing_delay_ms must be an integer or null.");
    numberOrNull(row.fps, "fps");
    if (!CAMERA_STATES.includes(row.state as CameraStatus["state"])) throw new Error("Unknown camera state.");
    if (row.state !== "offline" && row.heartbeat_at === null) throw new Error("An active camera needs a processing heartbeat.");
    if (row.last_source_timestamp === null && row.processing_delay_ms !== null) throw new Error("Processing delay is unavailable without a source capture timestamp.");
    if (row.heartbeat_at !== null && row.last_source_timestamp !== null && Date.parse(row.last_source_timestamp as string) > Date.parse(row.heartbeat_at as string)) throw new Error("Source capture time cannot follow the processing heartbeat.");
    return row as unknown as CameraStatus;
  });
  const traffic = rows(raw.traffic, 1000, "traffic", (value) => {
    const row = object(value, ["camera_id", "minute", "run_id", "vehicle_class", "mode", "count", "completed_traversals", "stopped_vehicle_seconds", "traversal_time_s", "distance_m", "queue_count", "queue_length_m", "coverage"], "traffic row");
    cameraAndMode(row, run);
    if (row.run_id !== run.run_id) throw new Error("Traffic run_id must match its worker run.");
    validateTrafficMinute(row as unknown as TrafficMinute);
    if (run.mode !== "synthetic" && calibrationFor(row.camera_id as string).validation_status !== "valid" && (row.distance_m !== null || row.queue_length_m !== null)) throw new Error("Distance metrics require valid camera calibration.");
    return row as unknown as TrafficMinute;
  });
  const emissions = rows(raw.emissions, 1000, "emissions", (value) => {
    const row = object(value, ["camera_id", "minute", "pollutant", "mode", "estimate_g", "range_low_g", "range_high_g", "factor_version", "method_version", "quality_state"], "emissions row");
    cameraAndMode(row, run);
    text(row.factor_version, "factor_version", true);
    text(row.method_version, "method_version", true);
    validateEmissionsMinute(row as unknown as EmissionsMinute);
    if (row.quality_state === "ok" && calibrationFor(row.camera_id as string).validation_status !== "valid") throw new Error("Estimated emissions require valid camera calibration.");
    if (row.quality_state === "ok" && (row.factor_version === null || row.method_version === null)) throw new Error("Estimated emissions need factor and method provenance.");
    return row as unknown as EmissionsMinute;
  });
  unique(statuses, (row) => row.camera_id, "statuses");
  unique(traffic, (row) => `${row.camera_id}|${Date.parse(row.minute)}|${row.vehicle_class}`, "traffic");
  unique(emissions, (row) => `${row.camera_id}|${Date.parse(row.minute)}|${row.pollutant}`, "emissions");
  // Rebuild through JSON so callers cannot mutate a parsed batch after validation.
  return JSON.parse(JSON.stringify({ contract_version: CONTRACT_VERSION, batch_id: raw.batch_id.toLowerCase(), revision: raw.revision, run, statuses, traffic, emissions })) as WorkerBatch;
}
