import type { TrafficMinute } from "@emission-lens/contracts";
import type { MeasurementWindowView } from "@emission-lens/backend";

const valid = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const strict = (values: Array<number | null>) => values.length && values.every(valid) ? values.reduce<number>((sum, value) => sum + value!, 0) : null;

/** Exact UTC minute anchors; missing records never contribute an observed zero. */
export function evidenceAnalytics(window: MeasurementWindowView, traffic: readonly TrafficMinute[]) {
  const from = Date.parse(window.from), to = Date.parse(window.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 86_400_000) throw new RangeError("Choose a valid interval of at most 24 hours.");
  const eligible = window.mode === "synthetic" || ["222", "223"].includes(window.camera_id);
  const inWindow = (minute: string) => { const t = Date.parse(minute); return Number.isFinite(t) && t % 60000 === 0 && t >= from && t < to; };
  const rows = eligible ? traffic.filter(row => row.camera_id === window.camera_id && row.mode === window.mode && inWindow(row.minute)) : [];
  const grouped = new Map<number, TrafficMinute[]>();
  for (const row of rows) { const t = Date.parse(row.minute); grouped.set(t, [...(grouped.get(t) ?? []), row]); }
  const measurements = new Map<number, MeasurementWindowView["minutes"]>();
  for (const row of window.minutes) if (inWindow(row.minute)) { const t = Date.parse(row.minute); measurements.set(t, [...(measurements.get(t) ?? []), row]); }
  const registry = window.registry;
  const approved = eligible && registry.state === "configured" && registry.physical_calibration_approved && !!registry.calibration_version?.trim();
  const slots = [];
  for (let t = Math.ceil(from / 60000) * 60000; t < to; t += 60000) {
    const members = grouped.get(t) ?? [];
    const candidates = measurements.get(t) ?? [];
    const m = candidates.length === 1 ? candidates[0] : null;
    const matching = approved && m?.state === "ready" && m.calibration_version === registry.calibration_version && !!m.mapping_version && registry.mapping_versions.includes(m.mapping_version);
    const co2Rows = matching ? m.emissions.filter(row => row.pollutant === "co2") : [];
    const co2 = co2Rows.length === 1 && co2Rows[0].camera_id === window.camera_id && co2Rows[0].mode === window.mode && Date.parse(co2Rows[0].minute) === t && co2Rows[0].quality_state === "ok" && valid(co2Rows[0].estimate_g) ? co2Rows[0].estimate_g : null;
    const cohort = co2 !== null && valid(m?.completed_cohort?.count) && Number.isInteger(m!.completed_cohort!.count) && m!.completed_cohort!.count! > 0 ? m!.completed_cohort!.count! : null;
    slots.push({ minute: new Date(t).toISOString(), recorded: members.length > 0, count: strict(members.map(row => row.count)), co2_g: co2, cohort_count: cohort });
  }
  const recorded = slots.filter(slot => slot.recorded);
  const supported = slots.filter(slot => slot.co2_g !== null);
  const intensity = supported.filter(slot => slot.cohort_count !== null);
  const cohortVehicles = intensity.reduce((sum, slot) => sum + slot.cohort_count!, 0);
  const cohortGrams = intensity.reduce((sum, slot) => sum + slot.co2_g!, 0);
  const classes = [...new Set(rows.map(row => row.vehicle_class))].map(vehicle_class => ({ vehicle_class, count: strict(rows.filter(row => row.vehicle_class === vehicle_class).map(row => row.count)) })).sort((a,b) => (b.count ?? -1) - (a.count ?? -1));
  const counts = recorded.filter(slot => slot.count !== null);
  const peak = counts.length ? counts.reduce((best, slot) => slot.count! > best.count! ? slot : best) : null;
  return { camera_id: window.camera_id, mode: window.mode, from: window.from, to: window.to, eligible, slots, classes, requested_minutes: slots.length, recorded_minutes: recorded.length, supported_minutes: supported.length, observed_crossings: strict(recorded.map(slot => slot.count)), cohort_minutes: intensity.length, cohort_vehicles: cohortVehicles || null, co2_per_completed_vehicle_g: cohortVehicles > 0 ? cohortGrams / cohortVehicles : null, peak };
}
