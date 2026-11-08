import type { MeasurementWindowView } from "@emission-lens/backend";
import type { EmissionsMinute } from "@emission-lens/contracts";

export type MapEmissionEstimate = {
  minute: string;
  co2_g: number;
  nox_g: number | null;
};

function supportedGrams(
  row: EmissionsMinute,
  window: MeasurementWindowView,
  instant: number,
): number | null {
  return row.camera_id === window.camera_id
    && row.mode === window.mode
    && Date.parse(row.minute) === instant
    && row.quality_state === "ok"
    && typeof row.estimate_g === "number"
    && Number.isFinite(row.estimate_g)
    && row.estimate_g >= 0
    ? row.estimate_g
    : null;
}

/** A retained supported minute, never a sum or a replacement for the window total. */
export function latestSupportedMapEstimate(window: MeasurementWindowView): MapEmissionEstimate | null {
  const { registry } = window;
  const labeledDemo = window.mode === "synthetic"
    && registry.revision === "synthetic-rich-demo-v1"
    && registry.calibration_version === `synthetic-demo-${window.camera_id}`;
  if ((window.mode !== "live" && window.mode !== "replay" && !labeledDemo)
    || registry.state !== "configured"
    || !registry.physical_calibration_approved
    || registry.calibration_version === null
    || registry.calibration_version.trim() === "") return null;

  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) return null;

  const occurrences = new Map<number, number>();
  let selected: MeasurementWindowView["minutes"][number] | null = null;
  let newest = -Infinity;
  for (const minute of window.minutes) {
    const instant = Date.parse(minute.minute);
    if (!Number.isFinite(instant) || instant < from || instant >= to) continue;
    occurrences.set(instant, (occurrences.get(instant) ?? 0) + 1);
    if (minute.state !== "ready"
      || minute.calibration_version !== registry.calibration_version
      || minute.mapping_version === null
      || minute.mapping_version.trim() === ""
      || !registry.mapping_versions.includes(minute.mapping_version)) continue;
    if (!minute.emissions.some((row) => row.pollutant === "co2"
      && supportedGrams(row, window, instant) !== null)) continue;
    if (instant > newest) {
      selected = minute;
      newest = instant;
    }
  }
  if (selected === null || occurrences.get(newest) !== 1) return null;

  const co2 = selected.emissions.filter((row) => row.pollutant === "co2");
  const nox = selected.emissions.filter((row) => row.pollutant === "nox");
  // Duplicate snapshots or pollutant rows have no authoritative ordering here.
  if (co2.length !== 1 || nox.length > 1) return null;
  const co2_g = supportedGrams(co2[0], window, newest);
  if (co2_g === null) return null;
  return {
    minute: selected.minute,
    co2_g,
    nox_g: nox.length === 1 ? supportedGrams(nox[0], window, newest) : null,
  };
}
