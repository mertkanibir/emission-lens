import assert from "node:assert/strict";
import test from "node:test";
import { registryCalibrationState, scenarioPollutantRows, observationStoppedRows } from "../src/lib/measurement.ts";
import { presentPollutantComparison } from "../src/lib/scenario-presentation.ts";

const registry = () => ({
  state: "configured" as const,
  revision: "controlled-test-only",
  calibration_version: "controlled-calibration",
  mapping_versions: ["controlled-mapping"],
  physical_calibration_approved: false,
});

test("registered versions and count approval do not imply approved physical calibration", () => {
  assert.equal(registryCalibrationState(registry()), "missing");
  assert.equal(registryCalibrationState({ ...registry(), physical_calibration_approved: true }), "valid");
  assert.equal(registryCalibrationState({ ...registry(), state: "invalid", physical_calibration_approved: true }), "invalid");
  assert.equal(registryCalibrationState({ ...registry(), state: "missing" }), "missing");
});

test("documented per-pollutant fields map without borrowing values or calculating changes", () => {
  const rows = scenarioPollutantRows({
    co2: { baseline_g: 100, scenario_g: 110, change_g: 10, change_pct: 10 },
    nox: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null },
  });
  assert.deepEqual(rows[0], { pollutant: "co2", baseline: 100, scenario: 110, changeGrams: 10, changePercent: 10 });
  assert.equal(presentPollutantComparison(rows[1]).changeGrams, null);
  const noChange = scenarioPollutantRows({
    co2: { baseline_g: 100, scenario_g: 110, change_g: null, change_pct: null },
    nox: { baseline_g: 0, scenario_g: 0, change_g: 0, change_pct: null },
  });
  assert.equal(noChange[0].changeGrams, null);
  assert.equal(presentPollutantComparison(noChange[1]).baseline, 0);
  assert.equal(presentPollutantComparison(noChange[1]).changePercent, null);
});

test("repeated observation classes aggregate without filling missing stops or entering the completed cohort", () => {
  const rows = observationStoppedRows([
    { vehicle_class: "car", baseline_stopped_vehicle_seconds: 10, scenario_stopped_vehicle_seconds: 8 },
    { vehicle_class: "car", baseline_stopped_vehicle_seconds: 20, scenario_stopped_vehicle_seconds: 16 },
    { vehicle_class: "truck", baseline_stopped_vehicle_seconds: null, scenario_stopped_vehicle_seconds: null },
    { vehicle_class: "truck", baseline_stopped_vehicle_seconds: 0, scenario_stopped_vehicle_seconds: 0 },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].baseline_stopped_vehicle_seconds, 30);
  assert.equal(rows[0].scenario_stopped_vehicle_seconds, 24);
  assert.equal(rows[1].baseline_stopped_vehicle_seconds, null);
  assert.equal(rows[1].scenario_stopped_vehicle_seconds, null);
  assert.equal("traversal_time_s" in rows[0], false);
});
