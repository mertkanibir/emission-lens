import {
  calibrationFor,
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
  type VehicleClass,
} from "@emission-lens/contracts";
import { asOf, isStale, reportingWindow } from "./clock.ts";
import { emissionsFor, statusesFor, trafficFor } from "./store.ts";

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

export function displayedState(status: CameraStatus, asOfIso: string): CameraState {
  if (status.heartbeat_at === null || status.last_source_timestamp === null) return "offline";
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
  const queueCount = uniqueOrNull(rows.map((row) => row.queue_count));
  const queueLength = uniqueOrNull(rows.map((row) => row.queue_length_m));
  let note = "No traffic rows in this window.";
  if (input.mode === "replay") note = "Replay is empty. No clip is loaded, and replay is not mixed into live totals.";
  else if (input.mode === "live") note = "No live worker output yet. Missing counts stay unavailable.";
  else if (rows.length > 0 && totals.stopped_vehicle_seconds === null) {
    note = "Synthetic sample. Stopped time is incomplete for at least one class, so the mix total is unavailable.";
  } else if (rows.length > 0) {
    note = "Synthetic sample. Not a live total.";
  }
  return {
    camera_id: input.cameraId,
    mode: input.mode,
    from,
    to,
    rows,
    totals,
    queue_count: queueCount,
    queue_length_m: queueLength,
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
  const quality_state: QualityState =
    rows.length === 0 ? "unavailable" : rows.some((row) => row.quality_state !== "ok") ? rows[0].quality_state : "ok";
  const calibration = calibrationFor(input.cameraId);
  const note =
    quality_state === "ok"
      ? "Estimated emissions use the loaded factor table for this window."
      : calibration.validation_status !== "valid"
        ? "Estimated emissions are unavailable. Usable factors are not loaded, and calibration is not valid, so distance-based emissions stay empty. This is not a zero."
        : "Estimated emissions are unavailable until a traceable factor table is loaded. This is not a zero.";
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
  const order: VehicleClass[] = ["car", "truck", "bus", "motorcycle", "unknown"];
  return [...rows].sort((a, b) => order.indexOf(a.vehicle_class) - order.indexOf(b.vehicle_class));
}
