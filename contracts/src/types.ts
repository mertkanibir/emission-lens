export const CONTRACT_VERSION = "1.0" as const;

export const MODES = ["live", "replay", "synthetic"] as const;
export type Mode = (typeof MODES)[number];

export const CAMERA_STATES = ["live", "degraded", "offline"] as const;
export type CameraState = (typeof CAMERA_STATES)[number];

export const VEHICLE_CLASSES = ["car", "truck", "bus", "motorcycle", "unknown"] as const;
export type VehicleClass = (typeof VEHICLE_CLASSES)[number];

export const POLLUTANTS = ["co2", "nox"] as const;
export type Pollutant = (typeof POLLUTANTS)[number];

export const QUALITY_STATES = [
  "ok",
  "insufficient_evidence",
  "unavailable",
  "calibration_invalid",
] as const;
export type QualityState = (typeof QUALITY_STATES)[number];

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Camera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stream_url: string;
  road_region: GeoJsonPolygon | null;
  enabled: boolean;
}

export interface CameraCalibration {
  camera_id: string;
  version: string;
  gates: unknown | null;
  reference_measurements: unknown | null;
  transform: unknown | null;
  validation_status: "valid" | "invalid" | "missing";
}

export interface WorkerRun {
  run_id: string;
  model_version: string | null;
  device: string | null;
  started_at: string | null;
  ended_at: string | null;
  mode: Mode;
}

export interface CameraStatus {
  camera_id: string;
  heartbeat_at: string | null;
  last_source_timestamp: string | null;
  processing_delay_ms: number | null;
  fps: number | null;
  state: CameraState;
  mode: Mode;
}

export interface TrafficMinute {
  camera_id: string;
  minute: string;
  run_id: string | null;
  vehicle_class: VehicleClass;
  mode: Mode;
  count: number | null;
  completed_traversals: number | null;
  stopped_vehicle_seconds: number | null;
  traversal_time_s: number | null;
  distance_m: number | null;
  queue_count: number | null;
  queue_length_m: number | null;
  coverage: number | null;
}

export interface EmissionsMinute {
  camera_id: string;
  minute: string;
  pollutant: Pollutant;
  mode: Mode;
  estimate_g: number | null;
  range_low_g: number | null;
  range_high_g: number | null;
  factor_version: string | null;
  method_version: string | null;
  quality_state: QualityState;
}

export interface ContextSnapshot {
  camera_id: string | null;
  region: string | null;
  source: string;
  retrieved_at: string | null;
  applicable_at: string | null;
  values: Record<string, unknown> | null;
  mode: Mode;
}
