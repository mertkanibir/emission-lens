import type {
  EmissionsMinute,
  Mode,
  TrafficMinute,
} from "../../contracts/src/index.ts";
import type { MeasurementBatch } from "../../contracts/src/measurement.ts";
import type {
  EstimateInput,
  EstimateResult,
} from "../../emissions/src/index.ts";
import type { ScenarioTraversal } from "../../emissions/src/scenario.ts";
export type { MeasurementRegistryStatus } from "./registry.ts";
import type { MeasurementRegistryStatus } from "./registry.ts";

export interface MeasurementPollutantComparison {
  baseline_g: number | null;
  scenario_g: number | null;
  change_g: number | null;
  change_pct: number | null;
}
export interface CohortSide {
  distance_m: number | null;
  traversal_time_s: number | null;
  stopped_time_s: number | null;
}
export interface MeasurementScenarioView {
  available: boolean;
  pollutants: {
    co2: MeasurementPollutantComparison;
    nox: MeasurementPollutantComparison;
  };
  completed_cohort: {
    count: number | null;
    baseline: CohortSide;
    scenario: CohortSide;
  };
  evidence_refs: string[];
  assumptions: string[];
  limitations: string[];
}
export interface MeasurementMinuteView {
  minute: string;
  batch_id: string;
  revision: number;
  state: "ready" | "unavailable";
  reasons: string[];
  timing_basis: MeasurementBatch["timing"]["basis"];
  meteorology: MeasurementBatch["meteorology"];
  calibration_version: string | null;
  mapping_version: string | null;
  evidence_ref: string;
  completed_cohort?: {
    count: number | null;
    stopped_time_s: number | null;
  };
  traffic: TrafficMinute[];
  emissions: EmissionsMinute[];
}
export interface MeasurementWindowView {
  camera_id: string;
  mode: Mode;
  from: string;
  to: string;
  scope?: "reporting_hour" | "explicit_window";
  registry: MeasurementRegistryStatus;
  minutes: MeasurementMinuteView[];
  scenario: MeasurementScenarioView;
  evidence_refs: string[];
  limitations: string[];
}
export interface MeasurementDerived {
  registry_digest: string;
  dependency_key: string;
  evidence_ref: string;
  reasons: string[];
  state: "ready" | "unavailable";
  input:
    | (Omit<EstimateInput, "traversals"> & { traversals: ScenarioTraversal[] })
    | null;
  calculation: EstimateResult;
  traffic: TrafficMinute[];
  emissions: EmissionsMinute[];
}
export interface StoredMeasurement {
  sequence: number;
  accepted_at: string;
  source_digest: string;
  stored_source_digest: string;
  source: MeasurementBatch;
  derived: MeasurementDerived;
  data_digest: string;
  superseded: Array<{
    revision: number;
    source_digest: string;
    accepted_at: string;
  }>;
}
