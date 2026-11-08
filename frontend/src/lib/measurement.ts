import { sumStrict } from "@emission-lens/contracts";
import type {
  ClassComparison,
  MeasurementRegistryStatus,
  MeasurementScenarioView,
} from "@emission-lens/backend";
import type { PollutantComparisonInput } from "./scenario-presentation";

/** Only camera/mode-scoped server approval supports this presentation state. */
export function registryCalibrationState(registry: MeasurementRegistryStatus) {
  if (registry.state === "configured" && registry.physical_calibration_approved) return "valid" as const;
  return registry.state === "invalid" ? "invalid" as const : "missing" as const;
}

/** Map documented backend results without recalculating or combining pollutants. */
export function scenarioPollutantRows(
  pollutants: MeasurementScenarioView["pollutants"],
): PollutantComparisonInput[] {
  return (["co2", "nox"] as const).map((pollutant) => ({
    pollutant,
    baseline: pollutants[pollutant].baseline_g,
    scenario: pollutants[pollutant].scenario_g,
    changeGrams: pollutants[pollutant].change_g,
    changePercent: pollutants[pollutant].change_pct,
  }));
}

/** General observation-minute stops are grouped without borrowing completed-cohort timing. */
export function observationStoppedRows(
  classes: Pick<ClassComparison, "vehicle_class" | "baseline_stopped_vehicle_seconds" | "scenario_stopped_vehicle_seconds">[],
) {
  return [...new Set(classes.map((row) => row.vehicle_class))].map((vehicle_class) => {
    const members = classes.filter((row) => row.vehicle_class === vehicle_class);
    return {
      vehicle_class,
      baseline_stopped_vehicle_seconds: sumStrict(members.map((row) => row.baseline_stopped_vehicle_seconds)),
      scenario_stopped_vehicle_seconds: sumStrict(members.map((row) => row.scenario_stopped_vehicle_seconds)),
    };
  });
}
