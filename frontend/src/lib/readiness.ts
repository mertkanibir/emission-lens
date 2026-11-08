import type { EmissionsWindow, TrafficWindow } from "@emission-lens/backend";
import type { Camera, CameraCalibration, Mode } from "@emission-lens/contracts";

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
}: {
  camera: Pick<Camera, "road_region">;
  calibration: CameraCalibration;
  traffic: Pick<TrafficWindow, "totals">;
  emissions: Pick<EmissionsWindow, "quality_state" | "estimate_g_by_pollutant">;
  factors: FactorStatus;
  mode: Mode;
}): ReadinessFact[] {
  const geometryPresent =
    camera.road_region !== null && calibration.gates != null;
  const completed = traffic.totals.completed_traversals;
  const estimatesPresent =
    emissions.quality_state === "ok" &&
    emissions.estimate_g_by_pollutant.co2 !== null &&
    emissions.estimate_g_by_pollutant.nox !== null;
  return [
    {
      label: "Image geometry & review",
      status: geometryPresent
        ? "Present · review not reported"
        : "Geometry incomplete",
      detail: `Road region: ${camera.road_region === null ? "missing" : "present"}; gates: ${calibration.gates == null ? "missing" : "present"}. Review confirmation is unavailable; presence alone is not approval.`,
      missing: !geometryPresent,
    },
    {
      label: "Physical calibration",
      status:
        calibration.validation_status === "valid"
          ? "Marked valid"
          : calibration.validation_status === "invalid"
            ? "Invalid"
            : "Missing",
      detail: `Version: ${calibration.version}. References: ${calibration.reference_measurements == null ? "missing" : "present"}; transform: ${calibration.transform == null ? "missing" : "present"}. A valid flag does not establish class mappings, completed traversals, or independent field validation.`,
      missing: calibration.validation_status !== "valid",
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
          : "A minute-aggregate count. Individual calibrated-traversal evidence is unavailable.",
      missing: completed === null || completed === 0,
    },
    {
      label: "Visual-to-CARB mapping",
      status: factors.production_mapping_loaded
        ? "Reported loaded"
        : "Not loaded",
      detail:
        "Production mapping availability is reported by the factor catalog. Per-camera mapping versions and supporting evidence are unavailable.",
      missing: !factors.production_mapping_loaded,
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
      status: estimatesPresent ? "Estimates recorded" : "Unavailable",
      detail: `Record quality: ${emissions.quality_state.replaceAll("_", " ")}. Missing estimates remain unavailable, never zero.`,
      missing: !estimatesPresent,
    },
  ];
}
