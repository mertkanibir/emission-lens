import {
  cameraById,
  validateTrafficMinute,
  VEHICLE_CLASSES,
  type TrafficMinute,
  type WorkerRun,
} from "../../contracts/src/index.ts";
import { validateUtcTimestamp } from "../../contracts/src/validate.ts";
import {
  estimate_completed_traversals,
  get_factor_catalog_status,
  type CompletedTraversal,
  type EstimateInput,
  type EstimateResult,
} from "../../emissions/src/index.ts";
import {
  compare_completed_traversal_scenario,
  type CompletedTraversalScenario,
  type ScenarioTraversal,
} from "../../emissions/src/scenario.ts";

export interface ReportTraversal extends CompletedTraversal {
  /** Optional evidence for this completed cohort, not all observed vehicles. */
  stopped_time_s?: number | null;
}

export interface CompletedTraversalReportInput extends Omit<EstimateInput, "traversals"> {
  run: WorkerRun;
  traversals: ReportTraversal[];
  stopped_time_reduction_pct?: number;
}

export interface CompletedTraversalReport {
  /** This result is not a persistence receipt or calibration approval. */
  stage: "calculation_only";
  run: WorkerRun;
  camera_id: string;
  minute: string;
  mode: EstimateInput["mode"];
  traffic: TrafficMinute[];
  emissions: EstimateResult["rows"];
  calculation: EstimateResult;
  scenario: CompletedTraversalScenario | null;
  provenance: {
    worker_run_id: string;
    model_version: string | null;
    device: string | null;
    calibration_version: string;
    calibration_metadata_supported: boolean;
    class_mapping_version: string | null;
    class_mapping_evidence: string | null;
    factor_version: string;
    method_version: string;
    scenario_method_version: string | null;
    meteorology: EstimateInput["meteorology"];
    completion_time_basis: "supplied_utc_times_not_verified_capture_utc";
  };
  limitations: string[];
}

function text(value: unknown, name: string, nullable = false): void {
  if (value === null && nullable) return;
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 256 || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`${name} must be a nonempty bounded string${nullable ? " or null" : ""}.`);
  }
}

function utc(value: unknown, name: string): string {
  validateUtcTimestamp(value, name);
  return new Date(value as string).toISOString();
}

/**
 * Build the existing aggregate records from an explicit completed cohort.
 * Callers supply reviewed context; this pure function does not approve it,
 * publish a worker batch, alter a calibration registry, or write live totals.
 */
export function build_completed_traversal_report(input: CompletedTraversalReportInput): CompletedTraversalReport {
  const value = structuredClone(input);
  if (!cameraById(value.camera_id)) throw new Error("Unknown report camera.");
  if (!["live", "replay", "synthetic"].includes(value.mode) || value.run.mode !== value.mode) {
    throw new Error("Report and worker run modes must match a supported data mode.");
  }
  text(value.run.run_id, "run_id");
  text(value.run.model_version, "model_version", true);
  text(value.run.device, "device", true);
  validateUtcTimestamp(value.run.started_at, "started_at", true);
  validateUtcTimestamp(value.run.ended_at, "ended_at", true);
  if (value.run.ended_at !== null && (value.run.started_at === null || Date.parse(value.run.ended_at) < Date.parse(value.run.started_at))) {
    throw new Error("Worker run end must follow a known start.");
  }
  const minute = utc(value.minute, "minute");
  if (Date.parse(minute) % 60_000 !== 0 || /\.(\d*[1-9]\d*)(?:Z|\+00:00)$/.test(value.minute)) {
    throw new Error("Report minute must align to the start of a UTC minute.");
  }
  if (value.calibration.camera_id !== value.camera_id) throw new Error("Calibration belongs to another report camera.");
  if (!["valid", "invalid", "missing"].includes(value.calibration.validation_status)) throw new Error("Unknown calibration validation status.");
  text(value.calibration.version, "calibration version");
  for (const field of ["gates", "reference_measurements", "transform"] as const) {
    if (value.calibration[field] === undefined) throw new Error("Unavailable calibration metadata must be explicitly null.");
  }
  if (!Number.isFinite(value.meteorology.temperature_f) || !Number.isFinite(value.meteorology.relative_humidity_pct)) {
    throw new Error("Meteorological assumptions must be finite.");
  }
  if (!Array.isArray(value.traversals)) throw new Error("A completed traversal cohort is required.");
  const seen = new Set<string>();
  const traversals: ScenarioTraversal[] = value.traversals.map((traversal) => {
    text(traversal.session_id, "session_id");
    text(traversal.traversal_id, "traversal_id");
    const identity = JSON.stringify([traversal.session_id, traversal.traversal_id]);
    if (seen.has(identity)) throw new Error("Duplicate traversal identity within a camera session.");
    seen.add(identity);
    if (!(VEHICLE_CLASSES as readonly string[]).includes(traversal.vehicle_class)) throw new Error("Unknown traversal vehicle class.");
    for (const field of ["distance_m", "traversal_time_s"] as const) {
      if (!Number.isFinite(traversal[field]) || traversal[field] <= 0) throw new Error("Completed traversals require positive finite distance and total time.");
    }
    const completed_at = utc(traversal.completed_at, "completed_at");
    if (Date.parse(completed_at) < Date.parse(minute) || Date.parse(completed_at) >= Date.parse(minute) + 60_000) {
      throw new Error("Traversal completion must belong to the report minute.");
    }
    const stopped = traversal.stopped_time_s ?? null;
    if (stopped !== null && (!Number.isFinite(stopped) || stopped < 0 || stopped > traversal.traversal_time_s)) {
      throw new Error("Completed-cohort stopped time must be between zero and traversal duration, or unavailable.");
    }
    return {
      session_id: traversal.session_id,
      traversal_id: traversal.traversal_id,
      completed_at,
      vehicle_class: traversal.vehicle_class,
      distance_m: traversal.distance_m,
      traversal_time_s: traversal.traversal_time_s,
      stopped_time_s: stopped,
    };
  });
  const estimateInput: EstimateInput = {
    camera_id: value.camera_id,
    minute,
    mode: value.mode,
    calibration: value.calibration,
    class_mapping: value.class_mapping,
    meteorology: {
      temperature_f: value.meteorology.temperature_f,
      relative_humidity_pct: value.meteorology.relative_humidity_pct,
    },
    traversals: traversals.map(({ stopped_time_s: _, ...traversal }) => traversal),
  };
  const calculation = estimate_completed_traversals(estimateInput);
  const calibrationSupported = value.calibration.validation_status === "valid"
    && value.calibration.gates !== null
    && value.calibration.reference_measurements !== null
    && value.calibration.transform !== null;
  const traffic: TrafficMinute[] = VEHICLE_CLASSES.flatMap((vehicle_class) => {
    const members = traversals.filter((traversal) => traversal.vehicle_class === vehicle_class);
    if (members.length === 0) return [];
    const row: TrafficMinute = {
      camera_id: value.camera_id,
      minute,
      run_id: value.run.run_id,
      vehicle_class,
      mode: value.mode,
      // A completed traversal is not an independent line-crossing count.
      count: null,
      completed_traversals: members.length,
      traversal_time_s: members.reduce((sum, traversal) => sum + traversal.traversal_time_s, 0),
      distance_m: calibrationSupported ? members.reduce((sum, traversal) => sum + traversal.distance_m, 0) : null,
      // These refer to the broader observed traffic, not this completed cohort.
      stopped_vehicle_seconds: null,
      queue_count: null,
      queue_length_m: null,
      coverage: null,
    };
    validateTrafficMinute(row);
    return [row];
  });
  const scenario = value.stopped_time_reduction_pct === undefined ? null : compare_completed_traversal_scenario({
    ...estimateInput,
    traversals,
    stopped_time_reduction_pct: value.stopped_time_reduction_pct,
  });
  return {
    stage: "calculation_only",
    run: {
      run_id: value.run.run_id,
      model_version: value.run.model_version,
      device: value.run.device,
      started_at: value.run.started_at,
      ended_at: value.run.ended_at,
      mode: value.run.mode,
    },
    camera_id: value.camera_id,
    minute,
    mode: value.mode,
    traffic,
    emissions: calculation.rows,
    calculation,
    scenario,
    provenance: {
      worker_run_id: value.run.run_id,
      model_version: value.run.model_version,
      device: value.run.device,
      calibration_version: calculation.calibration_version,
      calibration_metadata_supported: calibrationSupported,
      class_mapping_version: calculation.mapping_version,
      class_mapping_evidence: calculation.mapping_evidence,
      factor_version: get_factor_catalog_status().factor_version,
      method_version: calculation.rows[0].method_version!,
      scenario_method_version: scenario?.method_version ?? null,
      meteorology: { ...estimateInput.meteorology },
      completion_time_basis: "supplied_utc_times_not_verified_capture_utc",
    },
    limitations: [
      ...calculation.limitations,
      "This report uses the supplied completed-traversal cohort; it does not create missing observations or validate crossing/tracking accuracy.",
      "The supplied calibration status and metadata are calculation inputs, not independent geometry validation or registry approval.",
      "Line crossings, all-observed stopped seconds, queues and footage coverage cannot be reconstructed from a completed-traversal cohort and remain unavailable.",
      "Supplied completion UTC may be an estimated HLS media clock; this report does not establish source capture UTC.",
      "No persistence route or registry activation occurs here. A shared approved calibration/mapping registry, measurement producer, evidence persistence and transactional publication remain integration work.",
      "Hypothetical scenario rows remain inside the scenario result and must not be published as observed emissions.",
    ],
  };
}
