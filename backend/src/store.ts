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

export function statusesFor(mode: Mode): CameraStatus[] {
  if (mode === "synthetic") return SYNTHETIC_STATUS;
  const rows = readWorkerStore().statuses.filter((row) => row.mode === mode);
  return LIVE_STATUS.map((fallback) => rows.find((row) => row.camera_id === fallback.camera_id) ?? { ...fallback, mode });
}

export function trafficFor(mode: Mode): TrafficMinute[] {
  if (mode === "synthetic") return SYNTHETIC_TRAFFIC;
  return readWorkerStore().traffic.filter((row) => row.mode === mode);
}

export function emissionsFor(mode: Mode): EmissionsMinute[] {
  if (mode === "synthetic") return SYNTHETIC_EMISSIONS;
  return readWorkerStore().emissions.filter((row) => row.mode === mode);
}
