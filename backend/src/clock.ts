import { SYNTHETIC_AS_OF, type Mode } from "@emission-lens/contracts";

const STALE_MS = 120_000;

export function asOf(mode: Mode, now = new Date()): string {
  if (mode === "synthetic") return SYNTHETIC_AS_OF;
  return now.toISOString();
}

export function reportingWindow(mode: Mode, now = new Date()): { from: string; to: string } {
  const toMs = Date.parse(asOf(mode, now));
  return {
    from: new Date(toMs - 60 * 60 * 1000).toISOString(),
    to: new Date(toMs).toISOString(),
  };
}

export function isStale(heartbeatAt: string | null, asOfIso: string): boolean {
  if (heartbeatAt === null) return true;
  const age = Date.parse(asOfIso) - Date.parse(heartbeatAt);
  return !Number.isFinite(age) || age < -30_000 || age > STALE_MS;
}
