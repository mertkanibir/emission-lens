import { sumStrict, type TrafficMinute } from "@emission-lens/contracts";

/** Equivalent UTC spellings share a display row; every original record contributes. */
export function recordedMinuteHistory(rows: readonly TrafficMinute[]) {
  const groups = new Map<string, TrafficMinute[]>();
  for (const row of rows) {
    const minute = new Date(row.minute).toISOString();
    const members = groups.get(minute) ?? [];
    members.push(row);
    groups.set(minute, members);
  }

  return [...groups]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([minute, members]) => ({
      minute,
      count: sumStrict(members.map((row) => row.count)),
      traversals: sumStrict(members.map((row) => row.completed_traversals)),
      stopped: sumStrict(members.map((row) => row.stopped_vehicle_seconds)),
    }));
}
