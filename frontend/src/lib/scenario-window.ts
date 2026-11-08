import type { MeasurementWindowView } from "@emission-lens/backend";
import { latestSupportedMapEstimate } from "./map-emissions";

/** Select by time and support only; never search for a favorable scenario change. */
export function latestCompleteScenarioMinute(window: MeasurementWindowView, asOf: string) {
  const clock = Date.parse(asOf);
  const end = Date.parse(window.to);
  if (!Number.isFinite(clock) || !Number.isFinite(end)) return null;
  const completeTo = Math.floor(Math.min(end, clock) / 60_000) * 60_000;
  const estimate = latestSupportedMapEstimate({ ...window, to: new Date(completeTo).toISOString() });
  if (estimate === null) return null;
  const from = Date.parse(estimate.minute);
  if (from % 60_000 !== 0 || from + 60_000 > clock || from + 60_000 > end) return null;
  return { from: new Date(from).toISOString(), to: new Date(from + 60_000).toISOString() };
}
