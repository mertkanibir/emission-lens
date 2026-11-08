import {
  LIVE_STATUS,
  SYNTHETIC_EMISSIONS,
  SYNTHETIC_STATUS,
  SYNTHETIC_TRAFFIC,
  type CameraStatus,
  type EmissionsMinute,
  type Mode,
  type TrafficMinute,
} from "@emission-lens/contracts";
import { readWorkerStore } from "./persistence.ts";
import { richSyntheticDemo, richSyntheticEnabled } from "./synthetic-demo.ts";

export function statusesFor(mode: Mode): CameraStatus[] {
  if (mode === "synthetic") return SYNTHETIC_STATUS;
  const rows = readWorkerStore().statuses.filter((row) => row.mode === mode);
  return LIVE_STATUS.map((fallback) => rows.find((row) => row.camera_id === fallback.camera_id) ?? { ...fallback, mode });
}

export function trafficFor(mode: Mode): TrafficMinute[] {
  const store = readWorkerStore();
  if (mode === "synthetic" && !store.measurement_batches.some(row => row.mode === mode)) return richSyntheticEnabled(mode) ? richSyntheticDemo().store.traffic : SYNTHETIC_TRAFFIC;
  return store.traffic.filter((row) => row.mode === mode);
}

export function emissionsFor(mode: Mode): EmissionsMinute[] {
  const store = readWorkerStore();
  if (mode === "synthetic" && !store.measurement_batches.some(row => row.mode === mode)) return richSyntheticEnabled(mode) ? richSyntheticDemo().store.emissions : SYNTHETIC_EMISSIONS;
  return store.emissions.filter((row) => row.mode === mode);
}
