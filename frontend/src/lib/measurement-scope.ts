import type { MeasurementWindowView } from "@emission-lens/backend";

// Reviewed profile references already exposed by the public read model.
// This is presentation context, never an approval or a calculation input.
const SHARED_MAPPING = "pretrained-visual-to-emfac2007-v1";
const COMBINED_REVISION = "222-223-2026-11-08T04:03:40Z";
const REVIEWED_PROFILES = [
  {
    camera: "222",
    revisions: ["222-first-camera-2026-11-08T03:19:55Z", COMBINED_REVISION],
    calibration: "222-ground-esri-v1-7f52d53d8fc8",
    title: "Eastern 20 m segment",
    direction: "eastbound",
    distance: 20,
  },
  {
    camera: "223",
    revisions: [COMBINED_REVISION],
    calibration: "223-ground-esri-v1-34782d640860",
    title: "15 m southbound segment",
    direction: "southbound",
    distance: 15,
  },
];

export function measurementScope(window: MeasurementWindowView) {
  const { registry, minutes } = window;
  const profile = REVIEWED_PROFILES.find((value) => value.camera === window.camera_id
    && value.revisions.some((revision) => revision === registry.revision)
    && value.calibration === registry.calibration_version);
  const known = profile !== undefined
    && (window.mode === "live" || window.mode === "replay")
    && registry.state === "configured"
    && registry.physical_calibration_approved
    && registry.mapping_versions.length === 1
    && registry.mapping_versions[0] === SHARED_MAPPING
    && minutes.every((minute) => minute.calibration_version === profile.calibration
      && minute.mapping_version === SHARED_MAPPING);

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
    title: profile.title,
    summary: `Estimates under this profile cover completed ${profile.direction} movement vehicles, not every crossing or the whole intersection.`,
    assumptions: [
      `The ${profile.distance} m distance and CARB fleet mixtures are fixed modeling assumptions. Fleet mixtures are not measured fleet shares; curved-turn paths may be longer.`,
      weatherNote,
      ...(window.scenario.completed_cohort.baseline.stopped_time_s === null
        ? ["Traversal-linked stopped time is unavailable. A nonzero stopped-time reduction cannot be calculated."]
        : []),
    ],
  };
}
