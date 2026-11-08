import type { EmissionsWindow, TrafficWindow, MeasurementWindowView } from "@emission-lens/backend";
import type { Camera, CameraCalibration, Mode } from "@emission-lens/contracts";
import { latestSupportedMapEstimate } from "./map-emissions";

export interface ReadinessFact {
  label: string;
  status: string;
  detail: string;
  missing: boolean;
}

type FactorStatus = {
  state: string;
  factor_version: string;
  region: string;
  calendar_year: number;
  process: string;
  production_mapping_loaded: boolean;
};

/** Presentation of exposed records, never a scientific approval or a readiness score. */
export function measurementReadiness({
  camera,
  calibration,
  traffic,
  emissions,
  factors,
  mode,
  measurement,
}: {
  camera: Pick<Camera, "road_region">;
  calibration: CameraCalibration;
  traffic: Pick<TrafficWindow, "totals">;
  emissions: Pick<EmissionsWindow, "quality_state" | "estimate_g_by_pollutant"> & Partial<Pick<EmissionsWindow, "rows">>;
  factors: FactorStatus;
  mode: Mode;
  measurement?: MeasurementWindowView;
}): ReadinessFact[] {
  const geometryPresent =
    camera.road_region !== null && calibration.gates != null;
  const completed = traffic.totals.completed_traversals;
  const supported = (pollutant: "co2" | "nox") => {
    if (emissions.estimate_g_by_pollutant[pollutant] === null) return false;
    const rows = emissions.rows?.filter((row) => row.pollutant === pollutant);
    return rows && rows.length > 0
      ? rows.every((row) => row.quality_state === "ok" && row.estimate_g !== null)
      : emissions.quality_state === "ok";
  };
  const co2Present = supported("co2");
  const noxPresent = supported("nox");
  const estimatesPresent = co2Present && noxPresent;
  const registry = measurement?.registry;
  const minuteEstimate = measurement ? latestSupportedMapEstimate(measurement) : null;
  return [
    {
      label: "Image geometry & review",
      status: measurement
        ? "Count review not reported"
        : geometryPresent ? "Present · review not reported" : "Geometry incomplete",
      detail: measurement
        ? "The public measurement summary does not expose selected-gate count review. A stored count, geometry presence or physical-calibration approval does not establish reviewed crossing accuracy."
        : `Road region: ${camera.road_region === null ? "missing" : "present"}; gates: ${calibration.gates == null ? "missing" : "present"}. Review confirmation is unavailable; presence alone is not approval.`,
      missing: measurement ? true : !geometryPresent,
    },
    {
      label: "Physical calibration",
      status: registry
        ? registry.state === "invalid" ? "Registry invalid" : registry.physical_calibration_approved ? "Registry approved" : "Not approved"
        : calibration.validation_status === "valid"
          ? "Marked valid"
          : calibration.validation_status === "invalid"
            ? "Invalid"
            : "Missing",
      detail: registry
        ? `Camera/mode registry: ${registry.state}. Revision: ${registry.revision ?? "unavailable"}; calibration version: ${registry.calibration_version ?? "unavailable"}. Count approval alone does not approve physical calibration or emissions; each retained measurement must match the approved versions.`
        : `Version: ${calibration.version}. References: ${calibration.reference_measurements == null ? "missing" : "present"}; transform: ${calibration.transform == null ? "missing" : "present"}. A valid flag does not establish class mappings, completed traversals, or independent field validation.`,
      missing: registry ? registry.state !== "configured" || !registry.physical_calibration_approved : calibration.validation_status !== "valid",
    },
    {
      label: "Completed traversals",
      status:
        completed === null
          ? "Unavailable"
          : `${completed.toLocaleString("en-US")} recorded`,
      detail:
        mode === "synthetic"
          ? "Labeled synthetic aggregate. It does not establish calibrated field traversals."
          : measurement
            ? `${measurement.minutes.length} retained measurement snapshots. Original scenario cohort: ${measurement.scenario.completed_cohort.count ?? "unavailable"}. Private calculation evidence is identified by the public receipt references; it does not certify crossing accuracy.`
            : "A minute-aggregate count. Individual calibrated-traversal evidence is unavailable.",
      missing: completed === null || completed === 0,
    },
    {
      label: "Visual-to-CARB mapping",
      status: registry
        ? registry.mapping_versions.length > 0 ? "Versions registered" : "No version reported"
        : factors.production_mapping_loaded
        ? "Reported loaded"
        : "Not loaded",
      detail: registry
        ? `Camera/mode mapping versions: ${registry.mapping_versions.join(", ") || "unavailable"}. Applied versions and blocking reasons are listed with each retained measurement; a catalog alone does not approve a mapping.`
        : "Production mapping availability is reported by the factor catalog. Per-camera mapping versions and supporting evidence are unavailable.",
      missing: registry ? registry.mapping_versions.length === 0 : !factors.production_mapping_loaded,
    },
    {
      label: "Running-exhaust factors",
      status:
        factors.state === "validated"
          ? "Catalog validated"
          : "Catalog not validated",
      detail: `${factors.factor_version} · ${factors.region} · ${factors.calendar_year} · ${factors.process}. Loaded factors are not proof that an estimate used them; applied versions are shown with the emissions records.`,
      missing: factors.state !== "validated",
    },
    {
      label: "Estimated CO₂ & NOₓ",
      status: minuteEstimate ? "Supported minute retained" : estimatesPresent ? "Estimates recorded" : co2Present || noxPresent ? "Partial estimates" : "Unavailable",
      detail: `${minuteEstimate ? `A completed-movement CO₂${minuteEstimate.nox_g === null ? "" : " / NOₓ"} estimate is retained for ${minuteEstimate.minute}. This minute is separate from the reporting-hour total and feed freshness. ` : ""}Reporting-hour CO₂: ${co2Present ? "recorded" : "unavailable"}; NOₓ: ${noxPresent ? "recorded" : "unavailable"}. Record quality: ${emissions.quality_state.replaceAll("_", " ")}. Each pollutant retains its own support; missing estimates remain unavailable, never zero.`,
      missing: !estimatesPresent && (minuteEstimate === null || minuteEstimate.nox_g === null),
    },
  ];
}
