import type { Mode, Pollutant } from "../../contracts/src/index.ts";
import {
  estimate_completed_traversals,
  type ClassMapping,
  type CompletedTraversal,
  type EstimateInput,
  type EstimateResult,
  type Meteorology,
} from "./index.ts";

export const SCENARIO_METHOD_VERSION = "shorter-stops-per-traversal-runex-v1.0";

/** Stopped time belongs to this completed traversal, not the whole camera queue. */
export interface ScenarioTraversal extends CompletedTraversal {
  stopped_time_s: number | null;
}

export interface TraversalScenarioInput extends Omit<EstimateInput, "traversals"> {
  traversals: ScenarioTraversal[];
  stopped_time_reduction_pct: number;
}

export interface TraversalScenarioAdjustment {
  session_id: string;
  traversal_id: string;
  completed_at: string;
  vehicle_class: CompletedTraversal["vehicle_class"];
  distance_m: number;
  baseline_traversal_time_s: number;
  scenario_traversal_time_s: number | null;
  baseline_stopped_time_s: number | null;
  scenario_stopped_time_s: number | null;
}

export interface CompletedTraversalScenario {
  camera_id: string;
  minute: string;
  mode: Mode;
  hypothetical: true;
  method_version: typeof SCENARIO_METHOD_VERSION;
  baseline: EstimateResult;
  scenario: EstimateResult;
  /** Signed scenario minus baseline. A positive value is an increase. */
  change_g_by_pollutant: Record<Pollutant, number | null>;
  /** Null when either side is unavailable or the baseline is zero. */
  change_pct_by_pollutant: Record<Pollutant, number | null>;
  traversals: TraversalScenarioAdjustment[];
  assumptions: {
    stopped_time_reduction_pct: number;
    completed_traversals: number;
    reporting_cohort: "original_completed_traversals";
    held_constant: readonly string[];
    electric_fleet_share_applied: false;
    calibration_version: string;
    class_mapping: ClassMapping | null;
    meteorology: Meteorology;
  };
  limitations: string[];
}

function withoutStoppedTime(traversal: ScenarioTraversal): CompletedTraversal {
  return {
    session_id: traversal.session_id,
    traversal_id: traversal.traversal_id,
    completed_at: traversal.completed_at,
    vehicle_class: traversal.vehicle_class,
    distance_m: traversal.distance_m,
    traversal_time_s: traversal.traversal_time_s,
  };
}

function withheldScenario(baseline: EstimateResult, reason: string): EstimateResult {
  const result = structuredClone(baseline);
  result.evidence = [];
  result.rows = result.rows.map((row) => ({
    ...row,
    estimate_g: null,
    range_low_g: null,
    range_high_g: null,
    // Missing calibration/mapping/year remain the original blocking quality.
    quality_state: row.quality_state === "ok" ? "insufficient_evidence" : row.quality_state,
  }));
  result.limitations.push(reason);
  return result;
}

/**
 * Re-estimate each traversal after changing only its stopped component.
 * The returned hypothetical rows belong in a scenario result, never live totals.
 */
export function compare_completed_traversal_scenario(input: TraversalScenarioInput): CompletedTraversalScenario {
  const reduction = input.stopped_time_reduction_pct;
  if (!Number.isFinite(reduction) || reduction < 0 || reduction > 100) {
    throw new Error("Stopped-time reduction must be a finite percentage from 0 to 100.");
  }
  for (const traversal of input.traversals) {
    if (!Number.isFinite(traversal.distance_m) || traversal.distance_m <= 0 ||
        !Number.isFinite(traversal.traversal_time_s) || traversal.traversal_time_s <= 0) {
      throw new Error("Completed traversals require positive finite distance and total time.");
    }
    const stopped = traversal.stopped_time_s;
    if (stopped !== null && (!Number.isFinite(stopped) || stopped < 0 || stopped > traversal.traversal_time_s)) {
      throw new Error("Traversal stopped time must be finite, between zero and total traversal time, or null.");
    }
  }
  const estimateInput: EstimateInput = {
    camera_id: input.camera_id,
    minute: input.minute,
    mode: input.mode,
    calibration: input.calibration,
    class_mapping: input.class_mapping,
    meteorology: input.meteorology,
    traversals: input.traversals.map(withoutStoppedTime),
  };
  const baseline = estimate_completed_traversals(estimateInput);
  const traversals = input.traversals.map((traversal): TraversalScenarioAdjustment => {
    const stopped = traversal.stopped_time_s;
    const nextStopped = stopped === null ? null : stopped * (1 - reduction / 100);
    const nextDuration = reduction === 0 ? traversal.traversal_time_s
      : stopped === null ? null : traversal.traversal_time_s - stopped + nextStopped!;
    return {
      session_id: traversal.session_id,
      traversal_id: traversal.traversal_id,
      completed_at: traversal.completed_at,
      vehicle_class: traversal.vehicle_class,
      distance_m: traversal.distance_m,
      baseline_traversal_time_s: traversal.traversal_time_s,
      scenario_traversal_time_s: nextDuration,
      baseline_stopped_time_s: stopped,
      scenario_stopped_time_s: nextStopped,
    };
  });
  let scenario: EstimateResult;
  if (reduction === 0) {
    // No stopped evidence is needed to make no change to the existing cohort.
    scenario = structuredClone(baseline);
  } else if (traversals.some((traversal) => traversal.scenario_traversal_time_s === null)) {
    scenario = withheldScenario(baseline, "Stopped time is unavailable for at least one completed traversal; the whole scenario total is withheld.");
  } else if (traversals.some((traversal) => traversal.scenario_traversal_time_s! <= 0)) {
    scenario = withheldScenario(baseline, "The requested reduction leaves zero total traversal time for at least one vehicle; no supported finite-speed scenario exists.");
  } else {
    scenario = estimate_completed_traversals({
      ...estimateInput,
      traversals: estimateInput.traversals.map((traversal, index) => ({
        ...traversal,
        traversal_time_s: traversals[index].scenario_traversal_time_s!,
      })),
    });
  }
  const change_g_by_pollutant = { co2: null, nox: null } as Record<Pollutant, number | null>;
  const change_pct_by_pollutant = { co2: null, nox: null } as Record<Pollutant, number | null>;
  for (const pollutant of ["co2", "nox"] as const) {
    const before = baseline.rows.find((row) => row.pollutant === pollutant);
    const after = scenario.rows.find((row) => row.pollutant === pollutant);
    if (before?.quality_state !== "ok" || after?.quality_state !== "ok" || before.estimate_g === null || after.estimate_g === null) continue;
    const difference = after.estimate_g - before.estimate_g;
    change_g_by_pollutant[pollutant] = difference;
    if (before.estimate_g !== 0) {
      const percentage = difference / before.estimate_g * 100;
      if (!Number.isFinite(percentage)) throw new Error("Scenario percentage calculation overflowed.");
      change_pct_by_pollutant[pollutant] = percentage;
    }
  }
  return {
    camera_id: input.camera_id,
    minute: baseline.rows[0].minute,
    mode: input.mode,
    hypothetical: true,
    method_version: SCENARIO_METHOD_VERSION,
    baseline,
    scenario,
    change_g_by_pollutant,
    change_pct_by_pollutant,
    traversals,
    assumptions: {
      stopped_time_reduction_pct: reduction,
      completed_traversals: input.traversals.length,
      reporting_cohort: "original_completed_traversals",
      held_constant: ["completed traversal cohort", "segment distances", "non-stopped travel time", "visual classes and CARB VMT mapping", "meteorology and factor catalog"],
      electric_fleet_share_applied: false,
      calibration_version: input.calibration.version,
      class_mapping: structuredClone(input.class_mapping),
      meteorology: { ...input.meteorology },
    },
    limitations: [
      "Hypothetical estimated tailpipe CO2 and NOx for the supplied completed-traversal cohort, not all queued or observed traffic.",
      "Each traversal is recalculated separately; no factor is applied to a whole-minute average speed.",
      "Original completion timestamps select the same reporting cohort on both sides; scenario vehicles are not shifted into another minute.",
      "Reducing stopped time does not establish that a signal adjustment could achieve the change; displaced queues and network effects are omitted.",
      "RUNEX already includes ordinary driving-cycle stops; no ordinary-idle process or extra EV discount is added.",
      "Factor bins are nonlinear: a shorter-stop scenario can increase estimated emissions. Signed changes are not clamped to savings.",
      "No uncertainty range or statistical confidence interval is calculated.",
      "Hypothetical scenario rows must not be written as observed live emissions totals.",
    ],
  };
}
