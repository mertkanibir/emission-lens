import type { Mode } from "@emission-lens/contracts";

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

export function formatQuantity(value: number | null, unit: string): string {
  if (value === null) return "Unavailable";
  const rendered = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  return unit ? `${rendered} ${unit}` : rendered;
}

export function modeLabel(mode: Mode): string {
  if (mode === "replay") return "Replay";
  if (mode === "synthetic") return "Synthetic sample";
  return "Live";
}
