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

export function statusesFor(mode: Mode): CameraStatus[] {
  if (mode === "live") return LIVE_STATUS;
  if (mode === "synthetic") return SYNTHETIC_STATUS;
  return LIVE_STATUS.map((row) => ({ ...row, mode: "replay" as const }));
}

export function trafficFor(mode: Mode): TrafficMinute[] {
  if (mode === "synthetic") return SYNTHETIC_TRAFFIC;
  return [];
}

export function emissionsFor(mode: Mode): EmissionsMinute[] {
  if (mode === "synthetic") return SYNTHETIC_EMISSIONS;
  return [];
}
