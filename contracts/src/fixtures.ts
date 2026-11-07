import type { CameraStatus, EmissionsMinute, TrafficMinute, WorkerRun } from "./types.ts";
import { validateEmissionsMinute, validateTrafficMinute } from "./validate.ts";

/**
 * Sample clock for the labeled synthetic minute.
 * 7 November 2026, 12:05 America/Los_Angeles (20:05 UTC).
 * Live and replay do not use these rows.
 */
export const SYNTHETIC_AS_OF = "2026-11-07T20:05:00.000Z";
export const SYNTHETIC_MINUTE = "2026-11-07T20:00:00.000Z";
export const SYNTHETIC_RUN_ID = "synthetic-sample-222";

export const LIVE_STATUS: CameraStatus[] = ["222", "223", "228", "220"].map((camera_id) => ({
  camera_id,
  heartbeat_at: null,
  last_source_timestamp: null,
  processing_delay_ms: null,
  fps: null,
  state: "offline" as const,
  mode: "live" as const,
}));

/** Synthetic statuses exist only to exercise the dashboard. They are not live totals. */
export const SYNTHETIC_STATUS: CameraStatus[] = [
  {
    camera_id: "222",
    heartbeat_at: "2026-11-07T20:04:30.000Z",
    last_source_timestamp: "2026-11-07T20:04:28.000Z",
    processing_delay_ms: 2500,
    fps: 5,
    state: "live",
    mode: "synthetic",
  },
  {
    camera_id: "223",
    heartbeat_at: "2026-11-07T19:40:00.000Z",
    last_source_timestamp: "2026-11-07T19:39:00.000Z",
    processing_delay_ms: 90000,
    fps: 1,
    state: "live",
    mode: "synthetic",
  },
  {
    camera_id: "228",
    heartbeat_at: null,
    last_source_timestamp: null,
    processing_delay_ms: null,
    fps: null,
    state: "offline",
    mode: "synthetic",
  },
  {
    camera_id: "220",
    heartbeat_at: null,
    last_source_timestamp: null,
    processing_delay_ms: null,
    fps: null,
    state: "offline",
    mode: "synthetic",
  },
];

export const SYNTHETIC_RUN: WorkerRun = {
  run_id: SYNTHETIC_RUN_ID,
  model_version: null,
  device: null,
  started_at: SYNTHETIC_MINUTE,
  ended_at: null,
  mode: "synthetic",
};

/**
 * One labeled synthetic minute for camera 222.
 * Queue count sits on the car row only so it cannot be summed per class.
 * Unknown stopped time is null on purpose: the mix total must stay null.
 * Emissions are not invented here.
 */
export const SYNTHETIC_TRAFFIC: TrafficMinute[] = [
  {
    camera_id: "222",
    minute: SYNTHETIC_MINUTE,
    run_id: SYNTHETIC_RUN_ID,
    vehicle_class: "car",
    mode: "synthetic",
    count: 20,
    completed_traversals: 14,
    stopped_vehicle_seconds: 420,
    traversal_time_s: 700,
    distance_m: 1120,
    queue_count: 5,
    queue_length_m: null,
    coverage: 1,
  },
  {
    camera_id: "222",
    minute: SYNTHETIC_MINUTE,
    run_id: SYNTHETIC_RUN_ID,
    vehicle_class: "truck",
    mode: "synthetic",
    count: 3,
    completed_traversals: 2,
    stopped_vehicle_seconds: 90,
    traversal_time_s: 160,
    distance_m: 160,
    queue_count: null,
    queue_length_m: null,
    coverage: 1,
  },
  {
    camera_id: "222",
    minute: SYNTHETIC_MINUTE,
    run_id: SYNTHETIC_RUN_ID,
    vehicle_class: "unknown",
    mode: "synthetic",
    count: 1,
    completed_traversals: 0,
    stopped_vehicle_seconds: null,
    traversal_time_s: null,
    distance_m: null,
    queue_count: null,
    queue_length_m: null,
    coverage: 1,
  },
];

export const SYNTHETIC_EMISSIONS: EmissionsMinute[] = (["co2", "nox"] as const).map((pollutant) => ({
  camera_id: "222",
  minute: SYNTHETIC_MINUTE,
  pollutant,
  mode: "synthetic" as const,
  estimate_g: null,
  range_low_g: null,
  range_high_g: null,
  factor_version: null,
  method_version: null,
  quality_state: "unavailable" as const,
}));

for (const row of SYNTHETIC_TRAFFIC) validateTrafficMinute(row);
for (const row of SYNTHETIC_EMISSIONS) validateEmissionsMinute(row);
