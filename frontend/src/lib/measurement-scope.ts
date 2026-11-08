import type { MeasurementWindowView } from "@emission-lens/backend";

// Reviewed profile references already exposed by the public read model.
// This is presentation context, never an approval or a calculation input.
const REVIEWED_222 = {
  revision: "222-first-camera-2026-11-08T03:19:55Z",
  calibration: "222-ground-esri-v1-7f52d53d8fc8",
  mapping: "pretrained-visual-to-emfac2007-v1",
};

export function measurementScope(window: MeasurementWindowView) {
  const { registry, minutes } = window;
  const known = window.camera_id === "222"
    && (window.mode === "live" || window.mode === "replay")
    && registry.state === "configured"
    && registry.physical_calibration_approved
    && registry.revision === REVIEWED_222.revision
    && registry.calibration_version === REVIEWED_222.calibration
    && registry.mapping_versions.length === 1
    && registry.mapping_versions[0] === REVIEWED_222.mapping
    && minutes.every((minute) => minute.calibration_version === REVIEWED_222.calibration
      && minute.mapping_version === REVIEWED_222.mapping);

  if (!known) return {
    known: false,
    title: "Movement scope not reported",
    summary: "The supported road segment has not been reported for this window.",
    assumptions: [] as string[],
  };

  const weather = new Set(minutes.map((minute) =>
    `${minute.meteorology.temperature_f} °F and ${minute.meteorology.relative_humidity_pct}% relative humidity`));
  const weatherNote = weather.size === 0
    ? "No retained weather inputs are reported in this window."
    : weather.size === 1
      ? `${[...weather][0]} are fixed model inputs, not measured weather.`
      : "Weather inputs vary by retained minute. They are modeling assumptions, not measured weather; see the retained snapshots.";

  return {
    known: true,
    title: "Eastern 20 m segment",
    summary: "Estimates under this profile cover completed eastbound movement vehicles, not every crossing or the whole intersection.",
    assumptions: [
      "The 20 m distance and CARB fleet mixtures are fixed modeling assumptions. Fleet mixtures are not measured fleet shares; curved-turn paths may be longer.",
      weatherNote,
      ...(window.scenario.completed_cohort.baseline.stopped_time_s === null
        ? ["Traversal-linked stopped time is unavailable. A nonzero stopped-time reduction cannot be calculated."]
        : []),
    ],
  };
}
