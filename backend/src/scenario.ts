import {
  calibrationFor,
  sumStrict,
  type Mode,
  type VehicleClass,
} from "@emission-lens/contracts";
import { get_emissions_window, get_traffic_window } from "./queries.ts";
import { read_measurement_window } from "./measurements.ts";
import type { MeasurementScenarioView } from "./measurement-types.ts";

export interface ClassComparison {
  vehicle_class: VehicleClass;
  count: number | null;
  distance_m: number | null;
  baseline_stopped_vehicle_seconds: number | null;
  scenario_stopped_vehicle_seconds: number | null;
  baseline_traversal_time_s: number | null;
  scenario_traversal_time_s: number | null;
}

export interface ScenarioSide {
  count: number | null;
  distance_m: number | null;
  stopped_vehicle_seconds: number | null;
  traversal_time_s: number | null;
  average_speed_m_s: number | null;
  estimate_g: null;
}

export interface ScenarioComparison {
  camera_id: string;
  mode: Mode;
  assumptions: {
    stopped_time_reduction_pct: number;
    electric_fleet_share: number | null;
  };
  classes: ClassComparison[];
  baseline: ScenarioSide;
  scenario: ScenarioSide;
  limitations: string[];
  pollutants: MeasurementScenarioView["pollutants"];
  completed_cohort: MeasurementScenarioView["completed_cohort"];
  evidence_refs: string[];
  calculation_assumptions: string[];
}

function adjustTiming(
  stopped: number | null,
  traversal: number | null,
  reductionPct: number,
): { stopped: number | null; traversal: number | null } {
  // Observation-minute stops may include vehicles that have not completed.
  // They cannot be subtracted from the completed cohort's traversal duration.
  return {
    stopped: stopped === null ? null : stopped * (1 - reductionPct / 100),
    traversal: reductionPct === 0 ? traversal : null,
  };
}

function sideFrom(
  count: number | null,
  distance: number | null,
  stopped: number | null,
  traversal: number | null,
  allowSpeed: boolean,
): ScenarioSide {
  const average_speed_m_s =
    allowSpeed && distance !== null && traversal !== null && traversal > 0
      ? distance / traversal
      : null;
  return {
    count,
    distance_m: distance,
    stopped_vehicle_seconds: stopped,
    traversal_time_s: traversal,
    average_speed_m_s,
    estimate_g: null,
  };
}

export function compare_scenario(input: {
  cameraId: string;
  mode: Mode;
  stoppedTimeReductionPct: number;
  electricFleetShare?: number | null;
  now?: Date;
}): ScenarioComparison {
  const reduction = input.stoppedTimeReductionPct;
  if (!Number.isFinite(reduction) || reduction < 0 || reduction > 100) {
    throw new Error(
      "Stopped-time reduction must be a percentage from 0 to 100.",
    );
  }
  const share = input.electricFleetShare ?? null;
  if (share !== null && (!Number.isFinite(share) || share < 0 || share > 1)) {
    throw new Error(
      "Electric fleet share must be between 0 and 1, or omitted.",
    );
  }

  const traffic = get_traffic_window({
    cameraId: input.cameraId,
    mode: input.mode,
    now: input.now,
  });
  const measurement = read_measurement_window({
    cameraId: input.cameraId,
    mode: input.mode,
    now: input.now,
    stoppedTimeReductionPct: reduction,
  });
  const measured = measurement.minutes.length > 0;
  const calibration = calibrationFor(input.cameraId);
  const allowSpeed = measured
    ? measurement.scenario.completed_cohort.baseline.distance_m !== null
    : calibration.validation_status === "valid";
  const classes: ClassComparison[] = traffic.rows.map((row) => {
    const next = adjustTiming(
      row.stopped_vehicle_seconds,
      row.traversal_time_s,
      reduction,
    );
    return {
      vehicle_class: row.vehicle_class,
      count: row.count,
      distance_m: row.distance_m,
      baseline_stopped_vehicle_seconds: row.stopped_vehicle_seconds,
      scenario_stopped_vehicle_seconds: next.stopped,
      baseline_traversal_time_s: row.traversal_time_s,
      scenario_traversal_time_s: next.traversal,
    };
  });

  const emissions = get_emissions_window({
    cameraId: input.cameraId,
    mode: input.mode,
    now: input.now,
  });
  const limitations = [
    "This is a hypothetical stopped-time change. It does not show that a signal adjustment would produce it.",
    "Network effects and displaced queues are not modeled.",
    emissions.note,
    "Scenario ranges are not statistical confidence intervals.",
    "Observed minute stopped seconds and completed-traversal durations can describe different vehicles. Nonzero changes need per-traversal stopped evidence before scenario traversal time, speed or grams can be calculated.",
  ];
  if (measured) {
    limitations.splice(4, 1);
    limitations.push(...measurement.scenario.limitations);
  }
  if (!allowSpeed) {
    limitations.push(
      "Calibration is not valid. Average speed and distance-based emissions are suppressed. Counts and stopped time remain.",
    );
  }
  if (share !== null) {
    limitations.push(
      "Electric fleet share was not applied. Loaded CARB fleet-average factors already include a regional fuel mix; replacing it requires explicit fuel-specific factors and mappings to avoid subtracting EVs twice.",
    );
  }
  if (traffic.rows.length === 0) {
    limitations.push(
      "No completed traversals in this window. Emissions evidence is insufficient, not zero.",
    );
  }

  return {
    camera_id: input.cameraId,
    mode: input.mode,
    assumptions: {
      stopped_time_reduction_pct: reduction,
      electric_fleet_share: share,
    },
    classes,
    baseline: sideFrom(
      traffic.totals.count,
      allowSpeed ? traffic.totals.distance_m : traffic.totals.distance_m,
      traffic.totals.stopped_vehicle_seconds,
      measured
        ? measurement.scenario.completed_cohort.baseline.traversal_time_s
        : traffic.totals.traversal_time_s,
      allowSpeed,
    ),
    scenario: sideFrom(
      traffic.totals.count,
      traffic.totals.distance_m,
      sumStrict(classes.map((row) => row.scenario_stopped_vehicle_seconds)),
      measured
        ? measurement.scenario.completed_cohort.scenario.traversal_time_s
        : sumStrict(classes.map((row) => row.scenario_traversal_time_s)),
      allowSpeed,
    ),
    limitations,
    pollutants: measurement.scenario.pollutants,
    completed_cohort: measurement.scenario.completed_cohort,
    evidence_refs: measurement.evidence_refs,
    calculation_assumptions: measured ? measurement.scenario.assumptions : [],
  };
}
