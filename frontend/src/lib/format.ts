import type { CameraState, Mode, QualityState } from "@emission-lens/contracts";

export const PACIFIC = "America/Los_Angeles";

export function parseMode(value: string | undefined): Mode {
  if (value === "replay" || value === "synthetic") return value;
  return "live";
}

export function parseReduction(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 20;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function isValidReduction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export type MapView = "activity" | "emissions";

export function parseView(value: string | undefined): MapView {
  return value === "emissions" ? "emissions" : "activity";
}

/** Builds a same-site href. Live is the default mode, so it is left out of the query. */
export function hrefWith(path: string, params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "mode" && value === "live") continue;
    query.set(key, String(value));
  }
  const rendered = query.toString();
  return rendered ? `${path}?${rendered}` : path;
}

export function formatInstant(iso: string | null, timeZone: string): string {
  if (iso === null) return "Unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatWindow(fromIso: string, toIso: string, timeZone: string): string {
  const time = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return `${time.format(new Date(fromIso))} to ${time.format(new Date(toIso))} ${zoneAbbreviation(toIso, timeZone)}`;
}

export function formatClock(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** Torrance local time with seconds and an explicit zone, e.g. "12:04:30 PST". */
export function formatLocalClock(iso: string): string {
  return `${formatClock(iso, PACIFIC)} ${zoneAbbreviation(iso, PACIFIC)}`;
}

export function zoneAbbreviation(iso: string, timeZone: string): string {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(new Date(iso))
    .find((item) => item.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/** Age of `earlier` measured at `later`. Null when either side is unavailable. */
export function formatAge(earlier: string | null, later: string | null): string | null {
  if (earlier === null || later === null) return null;
  const seconds = Math.round((Date.parse(later) - Date.parse(earlier)) / 1000);
  if (!Number.isFinite(seconds)) return null;
  if (seconds < 0) return "ahead of the data clock";
  if (seconds < 90) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value);
}

export function formatQuantity(value: number | null, unit: string): string {
  if (value === null) return "Unavailable";
  const rendered = formatNumber(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null) return "Unavailable";
  return `${formatNumber(fraction * 100, 0)}%`;
}

export function formatCoordinates(latitude: number, longitude: number): string {
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? "N" : "S"}`;
  const lon = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? "E" : "W"}`;
  return `${lat}, ${lon}`;
}

export function modeLabel(mode: Mode): string {
  if (mode === "replay") return "Replay";
  if (mode === "synthetic") return "Synthetic sample";
  return "Live";
}

export function stateLabel(state: CameraState): string {
  if (state === "live") return "Live";
  if (state === "degraded") return "Degraded";
  return "Offline";
}

export function qualityLabel(state: QualityState): string {
  if (state === "ok") return "Estimated";
  if (state === "insufficient_evidence") return "Insufficient evidence";
  if (state === "calibration_invalid") return "Calibration invalid";
  return "Unavailable";
}
