import assert from "node:assert/strict";
import test from "node:test";
import {
  compare_completed_traversal_scenario,
  SCENARIO_METHOD_VERSION,
  type TraversalScenarioInput,
} from "../../emissions/src/scenario.ts";
import { estimate_completed_traversals, lookup_runex_factor } from "../../emissions/src/index.ts";

// Every geometry/mapping/traversal in this file is explicitly hypothetical.
// These calculations never register calibration or write live observations.
function input(): TraversalScenarioInput {
  return {
    camera_id: "222", minute: "2026-11-07T21:00:00Z", mode: "synthetic",
    calibration: {
      camera_id: "222", version: "synthetic-scenario-test-only", validation_status: "valid",
      gates: {}, reference_measurements: {}, transform: [],
    },
    class_mapping: {
      version: "synthetic-LDA-assumption",
      evidence: "Synthetic arithmetic only: assume cars are LDA; not an approved live mapping.",
      classes: { car: [{ emfac_class: "LDA", vmt_share: 1 }] },
    },
    meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
    traversals: [{
      session_id: "synthetic-session", traversal_id: "first", completed_at: "2026-11-07T21:00:30Z",
      vehicle_class: "car", distance_m: 1609.344, traversal_time_s: 360, stopped_time_s: 180,
    }],
    stopped_time_reduction_pct: 50,
  };
}

function grams(result: ReturnType<typeof compare_completed_traversal_scenario>["baseline"], pollutant: "co2" | "nox" = "co2") {
  return result.rows.find((row) => row.pollutant === pollutant)!.estimate_g;
}

function near(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} versus ${expected}`);
}

test("per-traversal stopped-time scenario reproduces the matching real RUNEX factor without adding idle", () => {
  const value = input();
  const result = compare_completed_traversal_scenario(value);
  assert.equal(result.hypothetical, true);
  assert.equal(result.method_version, SCENARIO_METHOD_VERSION);
  assert.equal(result.mode, "synthetic");
  assert.equal(result.traversals[0].scenario_stopped_time_s, 90);
  assert.equal(result.traversals[0].scenario_traversal_time_s, 270);
  assert.equal(result.scenario.evidence[0].speed_bin_mph, 15);
  for (const pollutant of ["co2", "nox"] as const) {
    const factor = lookup_runex_factor({ emfac_class: "LDA", pollutant, speed_mph: 3600 / 270, ...value.meteorology })!;
    near(grams(result.scenario, pollutant)!, 1.609344 * factor);
    near(result.change_g_by_pollutant[pollutant]!, grams(result.scenario, pollutant)! - grams(result.baseline, pollutant)!);
    near(result.change_pct_by_pollutant[pollutant]!, result.change_g_by_pollutant[pollutant]! / grams(result.baseline, pollutant)! * 100);
  }
  assert.equal(result.scenario.rows[0].range_low_g, null);
  assert.equal(result.scenario.rows[0].range_high_g, null);
  assert.equal(result.scenario.range_kind, "not_calculated");
  assert.ok(result.limitations.some((line) => /no ordinary-idle/i.test(line)));
});

test("nonlinear factors are applied per traversal instead of to the minute's average speed", () => {
  const value = input();
  value.traversals[0].stopped_time_s = 240;
  value.traversals.push({ ...value.traversals[0], traversal_id: "second", completed_at: "2026-11-07T21:00:31Z", traversal_time_s: 72, stopped_time_s: 12 });
  const result = compare_completed_traversal_scenario(value);
  assert.deepEqual(result.scenario.evidence.map((row) => row.speed_bin_mph), [15, 55]);
  const factor = (speed: number) => lookup_runex_factor({ emfac_class: "LDA", pollutant: "co2", speed_mph: speed, ...value.meteorology })!;
  const expected = 1.609344 * (factor(15) + factor(3600 / 66));
  near(grams(result.scenario)!, expected);
  const incorrectMinuteAverage = 2 * 1.609344 * factor(7200 / (240 + 66));
  assert.ok(Math.abs(grams(result.scenario)! - incorrectMinuteAverage) > 1);
  assert.equal(result.assumptions.completed_traversals, 2);
  assert.deepEqual(result.baseline.evidence.map((row) => row.distance_m), result.scenario.evidence.map((row) => row.distance_m));
});

test("original completion cohort and non-stopped time stay fixed even if a hypothetical vehicle finishes sooner", () => {
  const value = input();
  value.traversals[0].completed_at = "2026-11-07T21:00:00Z";
  const result = compare_completed_traversal_scenario(value);
  const change = result.traversals[0];
  assert.equal(change.completed_at, value.traversals[0].completed_at);
  assert.equal(change.distance_m, value.traversals[0].distance_m);
  assert.equal(change.scenario_traversal_time_s! - change.scenario_stopped_time_s!, change.baseline_traversal_time_s - change.baseline_stopped_time_s!);
  assert.equal(result.assumptions.reporting_cohort, "original_completed_traversals");
  assert.deepEqual(result.baseline.meteorology, result.scenario.meteorology);
  assert.equal(result.baseline.mapping_version, result.scenario.mapping_version);
  assert.equal(result.baseline.rows[0].factor_version, result.scenario.rows[0].factor_version);
  assert.equal(result.scenario.rows[0].minute, result.baseline.rows[0].minute);
});

test("zero reduction is an exact baseline comparison even when stopped evidence is unavailable", () => {
  const value = input();
  value.stopped_time_reduction_pct = 0;
  value.traversals[0].stopped_time_s = null;
  const result = compare_completed_traversal_scenario(value);
  assert.deepEqual(result.scenario, result.baseline);
  assert.deepEqual(result.change_g_by_pollutant, { co2: 0, nox: 0 });
  assert.deepEqual(result.change_pct_by_pollutant, { co2: 0, nox: 0 });
  assert.equal(result.traversals[0].scenario_traversal_time_s, 360);
  result.scenario.evidence[0].distance_m = 1;
  assert.equal(result.baseline.evidence[0].distance_m, 1609.344);
});

test("a partially missing stopped cohort withholds the whole scenario but preserves a supported baseline", () => {
  const value = input();
  value.traversals.push({ ...value.traversals[0], traversal_id: "second", stopped_time_s: null });
  const result = compare_completed_traversal_scenario(value);
  assert.ok(grams(result.baseline)! > 0);
  assert.equal(grams(result.scenario), null);
  assert.equal(result.scenario.rows[0].quality_state, "insufficient_evidence");
  assert.deepEqual(result.scenario.evidence, []);
  assert.deepEqual(result.change_g_by_pollutant, { co2: null, nox: null });
  assert.deepEqual(result.change_pct_by_pollutant, { co2: null, nox: null });
  assert.equal(result.traversals[0].scenario_traversal_time_s, 270);
  assert.equal(result.traversals[1].scenario_traversal_time_s, null);
});

test("zero stopped time does not invent an emissions saving", () => {
  const value = input();
  value.traversals[0].stopped_time_s = 0;
  const result = compare_completed_traversal_scenario(value);
  assert.deepEqual(result.scenario, result.baseline);
  assert.deepEqual(result.change_g_by_pollutant, { co2: 0, nox: 0 });
});

test("100 percent reduction supports positive moving time but withholds a zero-duration scenario", () => {
  const value = input();
  value.stopped_time_reduction_pct = 100;
  const supported = compare_completed_traversal_scenario(value);
  assert.equal(supported.traversals[0].scenario_stopped_time_s, 0);
  assert.equal(supported.traversals[0].scenario_traversal_time_s, 180);
  assert.equal(supported.scenario.evidence[0].speed_bin_mph, 20);
  value.traversals[0].stopped_time_s = value.traversals[0].traversal_time_s;
  const unsupported = compare_completed_traversal_scenario(value);
  assert.ok(grams(unsupported.baseline)! > 0);
  assert.equal(grams(unsupported.scenario), null);
  assert.equal(unsupported.scenario.rows[0].quality_state, "insufficient_evidence");
  assert.deepEqual(unsupported.scenario.evidence, []);
  assert.equal(unsupported.change_g_by_pollutant.co2, null);
});

test("scenario speeds outside factor support stay unavailable rather than being clipped to a supported bin", () => {
  const value = input();
  value.traversals[0].traversal_time_s = 72;
  value.traversals[0].stopped_time_s = 60;
  value.stopped_time_reduction_pct = 100;
  const result = compare_completed_traversal_scenario(value);
  assert.equal(result.baseline.evidence[0].speed_bin_mph, 50);
  assert.equal(grams(result.scenario), null);
  assert.equal(result.scenario.rows[0].quality_state, "insufficient_evidence");
  assert.equal(result.change_pct_by_pollutant.nox, null);
});

test("higher-speed factor increases remain positive changes rather than being clamped to savings", () => {
  const value = input();
  value.traversals[0].traversal_time_s = 60;
  value.traversals[0].stopped_time_s = 12;
  value.stopped_time_reduction_pct = 100;
  const result = compare_completed_traversal_scenario(value);
  assert.equal(result.baseline.evidence[0].speed_bin_mph, 60);
  assert.equal(result.scenario.evidence[0].speed_bin_mph, 75);
  assert.ok(result.change_g_by_pollutant.co2! > 0);
  assert.ok(result.change_pct_by_pollutant.co2! > 0);
});

test("missing calibration, class mapping, factors and empty completed cohorts preserve unavailable meanings", () => {
  const cases: Array<[string, (value: TraversalScenarioInput) => void]> = [
    ["calibration_invalid", (value) => { value.calibration.validation_status = "missing"; }],
    ["calibration_invalid", (value) => { value.calibration.transform = null; }],
    ["unavailable", (value) => { value.class_mapping = null; }],
    ["unavailable", (value) => { value.traversals[0].vehicle_class = "unknown"; }],
    ["unavailable", (value) => { value.meteorology.relative_humidity_pct = 10; }],
    ["insufficient_evidence", (value) => { value.traversals = []; }],
  ];
  for (const [quality, mutate] of cases) {
    const value = input(); mutate(value);
    const result = compare_completed_traversal_scenario(value);
    assert.equal(result.baseline.rows[0].quality_state, quality);
    assert.equal(result.scenario.rows[0].quality_state, quality);
    assert.equal(grams(result.baseline), null);
    assert.equal(grams(result.scenario), null);
    assert.deepEqual(result.change_g_by_pollutant, { co2: null, nox: null });
  }
});

test("malformed reduction, traversal durations and stopped components are rejected", () => {
  for (const bad of [-1, 101, NaN, Infinity]) {
    const value = input(); value.stopped_time_reduction_pct = bad;
    assert.throws(() => compare_completed_traversal_scenario(value), /percentage/);
  }
  for (const bad of [-1, 361, NaN, Infinity, undefined, "1", true]) {
    const value = input(); value.traversals[0].stopped_time_s = bad as never;
    assert.throws(() => compare_completed_traversal_scenario(value), /stopped time/);
  }
  for (const field of ["distance_m", "traversal_time_s"] as const) {
    for (const bad of [0, -1, NaN, Infinity]) {
      const value = input(); value.traversals[0][field] = bad;
      assert.throws(() => compare_completed_traversal_scenario(value), /positive finite/);
    }
  }
});

test("the scenario retains estimator identity checks and does not mutate caller data or mapping assumptions", () => {
  const value = input();
  const original = structuredClone(value);
  const result = compare_completed_traversal_scenario(value);
  assert.deepEqual(value, original);
  result.assumptions.class_mapping!.classes.car![0].vmt_share = 0.5;
  result.assumptions.meteorology.temperature_f = 60;
  assert.deepEqual(value, original);
  assert.deepEqual(result.baseline, estimate_completed_traversals({
    ...original,
    traversals: original.traversals.map(({ stopped_time_s: _stopped, ...traversal }) => traversal),
  }));
  const duplicate = input(); duplicate.traversals.push({ ...duplicate.traversals[0] });
  assert.throws(() => compare_completed_traversal_scenario(duplicate), /duplicate/);
  const outside = input(); outside.traversals[0].completed_at = "2026-11-07T21:01:00Z";
  assert.throws(() => compare_completed_traversal_scenario(outside), /reporting minute/);
});
