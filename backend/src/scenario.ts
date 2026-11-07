import { calibrationFor, sumStrict, type Mode, type VehicleClass } from "@emission-lens/contracts";
import { get_emissions_window, get_traffic_window } from "./queries.ts";

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
}

function adjustTiming(
  stopped: number | null,
  traversal: number | null,
  reductionPct: number,
): { stopped: number | null; traversal: number | null } {
  if (stopped === null) return { stopped: null, traversal };
  const nextStopped = stopped * (1 - reductionPct / 100);
  if (traversal === null) return { stopped: nextStopped, traversal: null };
  const moving = traversal - stopped;
  if (moving < 0) return { stopped: null, traversal: null };
  return { stopped: nextStopped, traversal: moving + nextStopped };
}

function sideFrom(
  count: number | null,
  distance: number | null,
  stopped: number | null,
  traversal: number | null,
  allowSpeed: boolean,
): ScenarioSide {
  const average_speed_m_s =
    allowSpeed && distance !== null && traversal !== null && traversal > 0 ? distance / traversal : null;
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
    throw new Error("Stopped-time reduction must be a percentage from 0 to 100.");
  }
  const share = input.electricFleetShare ?? null;
  if (share !== null && (!Number.isFinite(share) || share < 0 || share > 1)) {
    throw new Error("Electric fleet share must be between 0 and 1, or omitted.");
  }

  const traffic = get_traffic_window({ cameraId: input.cameraId, mode: input.mode, now: input.now });
  const calibration = calibrationFor(input.cameraId);
  const allowSpeed = calibration.validation_status === "valid";
  const classes: ClassComparison[] = traffic.rows.map((row) => {
    const next = adjustTiming(row.stopped_vehicle_seconds, row.traversal_time_s, reduction);
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

  const emissions = get_emissions_window({ cameraId: input.cameraId, mode: input.mode, now: input.now });
  const limitations = [
    "This is a hypothetical stopped-time change. It does not show that a signal adjustment would produce it.",
    "Network effects and displaced queues are not modeled.",
    emissions.note,
    "Scenario ranges are not statistical confidence intervals.",
  ];
  if (!allowSpeed) {
    limitations.push(
      "Calibration is not valid. Average speed and distance-based emissions are suppressed. Counts and stopped time remain.",
    );
  }
  if (share !== null) {
    limitations.push(
      "Electric fleet share was not applied. No fleet-average factor is loaded, and an EV adjustment must not be subtracted twice.",
    );
  }
  if (traffic.rows.length === 0) {
    limitations.push("No completed traversals in this window. Emissions evidence is insufficient, not zero.");
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
      traffic.totals.traversal_time_s,
      allowSpeed,
    ),
    scenario: sideFrom(
      traffic.totals.count,
      traffic.totals.distance_m,
      sumStrict(classes.map((row) => row.scenario_stopped_vehicle_seconds)),
      sumStrict(classes.map((row) => row.scenario_traversal_time_s)),
      allowSpeed,
    ),
    limitations,
  };
}
