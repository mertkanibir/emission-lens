import {
  cameraById,
  CAMERAS,
  sumStrict,
  type CameraState,
  type CameraStatus,
  type ContextSnapshot,
  type EmissionsMinute,
  type Mode,
  type QualityState,
  type TrafficMinute,
  VEHICLE_CLASSES,
  type VehicleClass,
} from "@emission-lens/contracts";
import { asOf, isStale, reportingWindow } from "./clock.ts";
import { emissionsFor, statusesFor, trafficFor } from "./store.ts";
import { readWorkerStore } from "./persistence.ts";
import { get_factor_catalog_status } from "../../emissions/src/index.ts";
import { loadRegistry, registryStatus } from "./registry.ts";

export interface CameraStatusView extends CameraStatus {
  displayed_state: CameraState;
  as_of: string;
}

export interface TrafficTotals {
  count: number | null;
  completed_traversals: number | null;
  stopped_vehicle_seconds: number | null;
  traversal_time_s: number | null;
  distance_m: number | null;
  coverage: number | null;
}

export interface TrafficWindow {
  camera_id: string;
  mode: Mode;
  from: string;
  to: string;
  rows: TrafficMinute[];
  totals: TrafficTotals;
  queue_count: number | null;
  queue_length_m: number | null;
  queue_observation?: {
    state: "observed" | "unavailable" | "ambiguous";
    minute: string | null;
    reason: string;
    scope?: "visible_stationary_lower_bound";
  };
  note: string;
}

export interface EmissionsWindow {
  camera_id: string;
  mode: Mode;
  from: string;
  to: string;
  rows: EmissionsMinute[];
  estimate_g_by_pollutant: { co2: number | null; nox: number | null };
  quality_state: QualityState;
  note: string;
}

function inWindow(minute: string, from: string, to: string): boolean {
  const value = Date.parse(minute);
  return value >= Date.parse(from) && value < Date.parse(to);
}

function uniqueOrNull(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  const first = present[0];
  return present.every((value) => value === first) ? first : null;
}

/** Queue columns describe one image observation, never an hour/class sum. */
export function latestQueueObservation(rows: TrafficMinute[]): {
  queue_count: number | null;
  queue_length_m: number | null;
  queue_observation: NonNullable<TrafficWindow["queue_observation"]>;
} {
  const latest = rows.reduce((at, row) => Math.max(at, Date.parse(row.minute)), -Infinity);
  if (!Number.isFinite(latest)) return {
    queue_count: null,
    queue_length_m: null,
    queue_observation: { state: "unavailable", minute: null, reason: "No traffic minute is available in this reporting window." },
  };
  const current = rows.filter((row) => Date.parse(row.minute) === latest);
  const observed = current.filter((row) => row.queue_count !== null);
  const minute = new Date(latest).toISOString();
  if (observed.length === 0) return {
    queue_count: null,
    queue_length_m: null,
    queue_observation: { state: "unavailable", minute, reason: "The latest traffic minute has no queue observation; older observations are not substituted." },
  };
  if (observed.length > 1) return {
    queue_count: null,
    queue_length_m: null,
    queue_observation: { state: "ambiguous", minute, reason: "The latest traffic minute has multiple queue observations across class rows; no unique observation is supported." },
  };
  return {
    queue_count: observed[0].queue_count,
    queue_length_m: observed[0].queue_length_m,
    queue_observation: observed[0].queue_count! > 0
      ? { state: "observed", minute, scope: "visible_stationary_lower_bound",
          reason: `At least ${observed[0].queue_count} visible stopped vehicles in the latest traffic-minute image observation. This provisional image-area/motion count is a lower bound, not a physical queue total or reporting-window total.` }
      : { state: "observed", minute,
          reason: "A supported zero is retained for the latest traffic-minute image observation; this is not a physical queue total or reporting-window total." },
  };
}

export function displayedState(status: CameraStatus, asOfIso: string): CameraState {
  // Caltrans does not expose capture UTC. A worker heartbeat records advancing
  // frame processing; capture time remains independently unavailable.
  if (status.state === "offline" || status.heartbeat_at === null) return "offline";
  if (isStale(status.heartbeat_at, asOfIso)) return "degraded";
  return status.state;
}

export function get_camera_status(cameraId: string, mode: Mode, now = new Date()): CameraStatusView {
  const clock = asOf(mode, now);
  const stored =
    statusesFor(mode).find((row) => row.camera_id === cameraId) ??
    ({
      camera_id: cameraId,
      heartbeat_at: null,
      last_source_timestamp: null,
      processing_delay_ms: null,
      fps: null,
      state: "offline",
      mode,
    } satisfies CameraStatus);
  return { ...stored, displayed_state: displayedState(stored, clock), as_of: clock };
}

export function get_traffic_window(input: {
  cameraId: string;
  mode: Mode;
  now?: Date;
}): TrafficWindow {
  const now = input.now ?? new Date();
  const { from, to } = reportingWindow(input.mode, now);
  const rows = trafficFor(input.mode).filter(
    (row) => row.camera_id === input.cameraId && inWindow(row.minute, from, to),
  );
  const totals: TrafficTotals = {
    count: sumStrict(rows.map((row) => row.count)),
    completed_traversals: sumStrict(rows.map((row) => row.completed_traversals)),
    stopped_vehicle_seconds: sumStrict(rows.map((row) => row.stopped_vehicle_seconds)),
    traversal_time_s: sumStrict(rows.map((row) => row.traversal_time_s)),
    distance_m: sumStrict(rows.map((row) => row.distance_m)),
    coverage: uniqueOrNull(rows.map((row) => row.coverage)),
  };
  const queue = latestQueueObservation(rows);
  let note = "No traffic rows in this window.";
  if (input.mode === "replay") note = rows.length === 0
    ? "No replay traffic aggregates in this window. Replay is not mixed into live totals."
    : "Recorded observations are kept separate from live totals. Missing metrics remain unavailable.";
  else if (input.mode === "live") note = rows.length === 0
    ? "No live traffic aggregates in this window. Counts require configured crossing gates; missing metrics stay unavailable."
    : "Live worker records received. Counts require configured crossing gates; missing metrics stay unavailable.";
  else if (rows.length > 0 && totals.stopped_vehicle_seconds === null) {
    note = "Synthetic sample. Stopped time is incomplete for at least one class, so the mix total is unavailable.";
  } else if (rows.length > 0) {
    note = "Synthetic sample. Not a live total.";
  }
  if (input.mode !== "synthetic" && rows.length > 0) {
    const versions = new Map(readWorkerStore().runs.map((run) => [run.run_id, run.model_version]));
    const estimated = rows.filter((row) => row.run_id !== null && versions.get(row.run_id)?.includes("|t:hls-min-anchor-v1")).length;
    if (estimated === rows.length) {
      note += " Camera-minutes use estimated HLS media time; minimum transport delay and capture UTC remain unavailable.";
    } else if (estimated > 0) {
      note += " This window has mixed timing bases: estimated HLS media time and legacy or unspecified record times. Their UTC boundaries are not directly comparable.";
    }
  }
  return {
    camera_id: input.cameraId,
    mode: input.mode,
    from,
    to,
    rows,
    totals,
    ...queue,
    note,
  };
}

export function get_emissions_window(input: {
  cameraId: string;
  mode: Mode;
  now?: Date;
}): EmissionsWindow {
  const now = input.now ?? new Date();
  const { from, to } = reportingWindow(input.mode, now);
  const rows = emissionsFor(input.mode).filter(
    (row) => row.camera_id === input.cameraId && inWindow(row.minute, from, to),
  );
  const estimateFor = (pollutant: "co2" | "nox"): number | null => {
    const matching = rows.filter((row) => row.pollutant === pollutant);
    if (matching.length === 0) return null;
    if (matching.some((row) => row.quality_state !== "ok")) return null;
    return sumStrict(matching.map((row) => row.estimate_g));
  };
  const quality_state: QualityState = rows.length === 0
    ? "unavailable"
    : rows.find((row) => row.quality_state !== "ok")?.quality_state ?? "ok";
  const registry = rows.length === 0
    ? registryStatus(loadRegistry(), input.cameraId, input.mode, now)
    : null;
  const emptyWindowApproval = registry?.state === "configured" &&
    registry.physical_calibration_approved && registry.calibration_version !== null
    ? "Camera calibration is approved for this mode and time; completed traversals and a documented class mapping are still required."
    : registry?.state === "invalid"
      ? "The measurement registry is invalid, so camera calibration approval cannot be verified."
      : "No unique server-approved camera calibration applies to this mode and time.";
  const note =
    quality_state === "ok"
      ? "Estimated emissions use the loaded factor table for this window."
      : rows.length === 0
        ? `No estimated-emissions records are available in this reporting window. ${emptyWindowApproval} This is not a zero.`
        : quality_state === "calibration_invalid"
          ? `CARB ${get_factor_catalog_status().model_version} factors are validated for Los Angeles (SC), 2026. Camera calibration is not valid, so estimated emissions stay unavailable. This is not a zero.`
          : "CARB factors are validated. Estimated emissions still require completed traversals and a documented class mapping. This is not a zero.";
  return {
    camera_id: input.cameraId,
    mode: input.mode,
    from,
    to,
    rows,
    estimate_g_by_pollutant: { co2: estimateFor("co2"), nox: estimateFor("nox") },
    quality_state,
    note,
  };
}

export function get_context(cameraId: string, mode: Mode): ContextSnapshot {
  const camera = cameraById(cameraId);
  return {
    camera_id: cameraId,
    region: camera ? "Torrance, California" : null,
    source: "none",
    retrieved_at: null,
    applicable_at: null,
    values: null,
    mode,
  };
}

export function listCameras(): typeof CAMERAS {
  return CAMERAS;
}

export function classRows(rows: TrafficMinute[]): TrafficMinute[] {
  const order: readonly VehicleClass[] = VEHICLE_CLASSES;
  return [...rows].sort((a, b) => order.indexOf(a.vehicle_class) - order.indexOf(b.vehicle_class));
}
