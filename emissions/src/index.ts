import catalog from "../data/la-2026/factors.json";
import {
  validateEmissionsMinute,
  VEHICLE_CLASSES,
  type CameraCalibration,
  type EmissionsMinute,
  type Mode,
  type Pollutant,
  type VehicleClass,
} from "../../contracts/src/index.ts";

export const METHOD_VERSION = "completed-traversals-runex-v1.0";
const METRES_PER_MILE = 1609.344;
const MILES_TO_KM = 1.609344;
const VALID_CLASSES = new Set(catalog.request.vehicleCategory.split(","));
const VALID_CAMERA_IDS = new Set(["220", "222", "223", "228"]);

export interface Meteorology {
  temperature_f: number;
  relative_humidity_pct: number;
}

/** Weights describe VMT shares within a visual class, not population shares. */
export interface ClassMapping {
  version: string;
  evidence: string;
  classes: Partial<Record<VehicleClass, Array<{ emfac_class: string; vmt_share: number }>>>;
}

/** Distances/times refer to completed traversals, including any stops. */
export interface CompletedTraversal {
  session_id: string;
  traversal_id: string;
  completed_at: string;
  vehicle_class: VehicleClass;
  distance_m: number;
  traversal_time_s: number;
}

export interface EstimateInput {
  camera_id: string;
  minute: string;
  mode: Mode;
  calibration: CameraCalibration;
  class_mapping: ClassMapping | null;
  traversals: CompletedTraversal[];
  meteorology: Meteorology;
}

export interface TraversalEvidence {
  session_id: string;
  traversal_id: string;
  vehicle_class: VehicleClass;
  distance_m: number;
  traversal_time_s: number;
  speed_mph: number;
  speed_bin_mph: number;
  co2_g: number;
  nox_g: number;
}

export interface EstimateResult {
  rows: EmissionsMinute[];
  evidence: TraversalEvidence[];
  mapping_version: string | null;
  mapping_evidence: string | null;
  calibration_version: string;
  meteorology: Meteorology;
  range_kind: "not_calculated";
  limitations: string[];
}

const factorKey = (vehicle: string, pollutant: string, bin: number, t: number, rh: number) =>
  [vehicle, pollutant, bin, t, rh].join("|");

// Validate the checked-in table at load time as well as during acquisition.
const factors = new Map<string, number>();
for (const row of catalog.factors) {
  const key = factorKey(row.vehicle_class, row.pollutant, row.speed_bin_mph, row.temperature_f, row.relative_humidity_pct);
  if (
    catalog.process !== "RUNEX" || catalog.units !== "g/vehicle-km" ||
    !VALID_CLASSES.has(row.vehicle_class) || !["co2", "nox"].includes(row.pollutant) ||
    !Number.isFinite(row.g_per_vehicle_km) || row.g_per_vehicle_km < 0 ||
    Math.abs(row.g_per_vehicle_km * MILES_TO_KM - row.source_g_per_vehicle_mile) > 1e-8 ||
    factors.has(key)
  ) throw new Error("Invalid or duplicate CARB RUNEX factor.");
  factors.set(key, row.g_per_vehicle_km);
}
for (const vehicle of VALID_CLASSES) {
  for (const pollutant of ["co2", "nox"]) {
    for (let bin = 5; bin <= 90; bin += 5) {
      for (const met of catalog.meteorology_assumptions) {
        if (!factors.has(factorKey(vehicle, pollutant, bin, met.temperature_f, met.relative_humidity_pct))) {
          throw new Error("Incomplete CARB RUNEX factor grid; missing factors cannot be zero.");
        }
      }
    }
  }
}

export function get_factor_catalog_status() {
  return {
    state: "validated" as const,
    factor_version: catalog.factor_version,
    model_version: catalog.model_version,
    source_url: catalog.source_url,
    source_sha256: catalog.source_sha256,
    retrieved_at: catalog.retrieved_at,
    region: catalog.region,
    calendar_year: catalog.calendar_year,
    season: catalog.season,
    vehicle_category_scheme: catalog.vehicle_category_scheme,
    vehicle_classes: [...VALID_CLASSES],
    process: catalog.process,
    units: catalog.units,
    fuel_assumption: catalog.fuel_assumption,
    model_year_assumption: catalog.model_year_assumption,
    meteorology_assumptions: catalog.meteorology_assumptions.map((row) => ({ ...row })),
    validation: { ...catalog.validation },
    production_mapping_loaded: false,
  };
}

/** Upper-edge bins: (0,5], (5,10], ...; conservative support ends at 90 mph. */
export function speed_bin_mph(speedMph: number): number {
  if (!Number.isFinite(speedMph) || speedMph <= 0 || speedMph > 90) {
    throw new Error("Completed traversal speed must be above zero and at most 90 mph.");
  }
  const bins = speedMph / 5;
  const nearest = Math.round(bins);
  // Distance/time arithmetic can put an exact boundary a few ULPs above it.
  const stable = nearest >= 1 && Math.abs(bins - nearest) <= Number.EPSILON * Math.max(1, bins) * 8 ? nearest : bins;
  return Math.ceil(stable) * 5;
}

export function lookup_runex_factor(input: Meteorology & {
  emfac_class: string;
  pollutant: Pollutant;
  speed_mph: number;
}): number | null {
  const bin = speed_bin_mph(input.speed_mph);
  return factors.get(factorKey(input.emfac_class, input.pollutant, bin, input.temperature_f, input.relative_humidity_pct)) ?? null;
}

function validateMapping(mapping: ClassMapping): void {
  if (!mapping.version.trim() || !mapping.evidence.trim()) {
    throw new Error("Class mappings require a version and documented evidence or explicit scenario assumptions.");
  }
  for (const [visual, mix] of Object.entries(mapping.classes)) {
    if (!(VEHICLE_CLASSES as readonly string[]).includes(visual) || !mix || mix.length === 0) {
      throw new Error("Unsupported or empty visual-class mapping.");
    }
    const seen = new Set<string>();
    let share = 0;
    for (const item of mix) {
      if (!VALID_CLASSES.has(item.emfac_class) || !Number.isFinite(item.vmt_share) || item.vmt_share <= 0 || seen.has(item.emfac_class)) {
        throw new Error("Invalid CARB category, VMT weight, or duplicate mapping category.");
      }
      share += item.vmt_share;
      seen.add(item.emfac_class);
    }
    if (Math.abs(share - 1) > 1e-9) throw new Error("VMT shares must sum to one within each visual class.");
  }
  if (mapping.classes.unknown) throw new Error("Unknown vehicles must stay unknown.");
}

export function estimate_completed_traversals(input: EstimateInput): EstimateResult {
  if (!VALID_CAMERA_IDS.has(input.camera_id)) throw new Error("No verified regional scope for this camera.");
  if (!["live", "replay", "synthetic"].includes(input.mode)) throw new Error("Invalid data mode.");
  if (input.calibration.camera_id !== input.camera_id) throw new Error("Calibration belongs to another camera.");
  const instant = new Date(input.minute);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?Z$/.test(input.minute) || !Number.isFinite(instant.getTime()) || instant.toISOString().replace(".000Z", "Z") !== input.minute.replace(".000Z", "Z")) {
    throw new Error("A valid UTC minute timestamp is required.");
  }
  const localYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric" }).format(instant));
  const base: EstimateResult = {
    rows: [], evidence: [], mapping_version: input.class_mapping?.version ?? null,
    mapping_evidence: input.class_mapping?.evidence ?? null,
    calibration_version: input.calibration.version,
    meteorology: { ...input.meteorology }, range_kind: "not_calculated",
    limitations: [
      "Estimated tailpipe CO2 and NOx for completed calibrated traversals of the observed segment only.",
      "RUNEX includes ordinary driving-cycle stops; no separate ordinary-idle emissions are added.",
      "CARB fuel and model-year mixtures are already included. No additional EV discount is applied.",
      "Upper-edge speed-bin lookup is a segment-average approximation, not a second-by-second engine model.",
      "Temperature and humidity are explicit assumptions, not observed current weather. No uncertainty range is calculated.",
    ],
  };
  function unavailable(quality: EmissionsMinute["quality_state"], reason: string): EstimateResult {
    base.limitations.push(reason);
    base.rows = ["co2", "nox"].map((pollutant) => makeRow(pollutant as Pollutant, quality, null));
    return base;
  }
  function makeRow(pollutant: Pollutant, quality: EmissionsMinute["quality_state"], value: number | null): EmissionsMinute {
    const row: EmissionsMinute = {
      camera_id: input.camera_id, minute: instant.toISOString(), mode: input.mode, pollutant,
      estimate_g: value, range_low_g: null, range_high_g: null,
      factor_version: catalog.factor_version, method_version: METHOD_VERSION, quality_state: quality,
    };
    validateEmissionsMinute(row);
    return row;
  }
  if (localYear !== catalog.calendar_year) return unavailable("unavailable", "Observation year does not match the factor year in the camera's local timezone.");
  if (input.calibration.validation_status !== "valid") return unavailable("calibration_invalid", "Camera calibration is missing or invalid.");
  if (!input.calibration.version.trim() || input.calibration.gates === null || input.calibration.reference_measurements === null || input.calibration.transform === null) {
    return unavailable("calibration_invalid", "Calibration marked valid lacks its version, gates, references, or transform.");
  }
  if (input.traversals.length === 0) return unavailable("insufficient_evidence", "No completed calibrated traversals; a queue alone is not zero emissions.");
  if (!input.class_mapping) return unavailable("unavailable", "No documented mapping from visual classes to CARB vehicle categories was supplied.");
  validateMapping(input.class_mapping);
  if (!catalog.meteorology_assumptions.some((met) => met.temperature_f === input.meteorology.temperature_f && met.relative_humidity_pct === input.meteorology.relative_humidity_pct)) {
    return unavailable("unavailable", "Requested meteorological assumptions are not in the loaded factor table.");
  }
  const identities = new Set<string>();
  const evidence: TraversalEvidence[] = [];
  for (const traversal of input.traversals) {
    const completedAt = Date.parse(traversal.completed_at);
    if (!traversal.completed_at.endsWith("Z") || !Number.isFinite(completedAt) || completedAt < instant.getTime() || completedAt >= instant.getTime() + 60_000) {
      throw new Error("Traversal completion time must be UTC and belong to the requested reporting minute.");
    }
    const identity = JSON.stringify([traversal.session_id, traversal.traversal_id]);
    if (!traversal.session_id.trim() || !traversal.traversal_id.trim() || identities.has(identity)) {
      throw new Error("Missing or duplicate traversal identity within a camera session.");
    }
    identities.add(identity);
    if (!Number.isFinite(traversal.distance_m) || !Number.isFinite(traversal.traversal_time_s) || traversal.distance_m <= 0 || traversal.traversal_time_s <= 0) {
      throw new Error("Completed traversals require positive finite distance and total time, including stops.");
    }
    const speed = traversal.distance_m / traversal.traversal_time_s * 3600 / METRES_PER_MILE;
    if (speed > 90) return unavailable("insufficient_evidence", "Traversal speed exceeds the supported factor lookup range.");
    const mix = traversal.vehicle_class === "unknown" ? undefined : input.class_mapping.classes[traversal.vehicle_class];
    if (!mix) return unavailable("unavailable", "At least one traversal has an unknown or unmapped vehicle class; the total is withheld.");
    const totals = { co2: 0, nox: 0 };
    for (const pollutant of ["co2", "nox"] as const) {
      for (const item of mix) {
        const factor = lookup_runex_factor({ ...input.meteorology, emfac_class: item.emfac_class, pollutant, speed_mph: speed });
        if (factor === null) return unavailable("unavailable", "A required factor is missing; the total is withheld.");
        totals[pollutant] += traversal.distance_m / 1000 * factor * item.vmt_share;
      }
      if (!Number.isFinite(totals[pollutant])) throw new Error("Emissions calculation overflowed.");
    }
    evidence.push({ ...traversal, speed_mph: speed, speed_bin_mph: speed_bin_mph(speed), co2_g: totals.co2, nox_g: totals.nox });
  }
  base.evidence = evidence;
  base.rows = ["co2", "nox"].map((pollutant) => {
    const total = evidence.reduce((sum, item) => sum + (pollutant === "co2" ? item.co2_g : item.nox_g), 0);
    if (!Number.isFinite(total)) throw new Error("Emissions total overflowed.");
    return makeRow(pollutant as Pollutant, "ok", total);
  });
  return base;
}

/** Registry loaders validate reviewed mixtures without activating a camera. */
export { validateMapping as validate_class_mapping };
