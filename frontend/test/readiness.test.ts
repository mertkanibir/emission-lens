import assert from "node:assert/strict";
import test from "node:test";
import { measurementReadiness } from "../src/lib/readiness.ts";
import { supportedWindow } from "./fixtures/supported-window.ts";

function input(): Parameters<typeof measurementReadiness>[0] {
  return {
    mode: "live",
    camera: { road_region: null },
    calibration: {
      camera_id: "222",
      version: "unconfigured",
      validation_status: "missing",
      gates: null,
      reference_measurements: null,
      transform: null,
    },
    traffic: {
      totals: {
        count: null,
        completed_traversals: null,
        stopped_vehicle_seconds: null,
        traversal_time_s: null,
        distance_m: null,
        coverage: null,
      },
    },
    emissions: {
      quality_state: "unavailable",
      estimate_g_by_pollutant: { co2: null, nox: null },
    },
    factors: {
      state: "validated",
      factor_version: "test-catalog",
      region: "test-region",
      calendar_year: 2026,
      process: "RUNEX",
      production_mapping_loaded: false,
    },
  };
}

test("a validated catalog does not make missing camera evidence ready", () => {
  const facts = measurementReadiness(input());
  assert.equal(
    facts.find((f) => f.label === "Running-exhaust factors")?.status,
    "Catalog validated",
  );
  assert.equal(
    facts.find((f) => f.label === "Estimated CO₂ & NOₓ")?.status,
    "Unavailable",
  );
  assert.equal(
    facts.find((f) => f.label === "Visual-to-CARB mapping")?.status,
    "Not loaded",
  );
});

test("present geometry and a valid flag never claim review or independent validation", () => {
  const value = input();
  value.camera.road_region = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };
  value.calibration = {
    ...value.calibration,
    validation_status: "valid",
    gates: {},
    reference_measurements: {},
    transform: {},
  };
  const facts = measurementReadiness(value);
  assert.equal(facts[0].status, "Present · review not reported");
  assert.match(facts[0].detail, /presence alone is not approval/);
  assert.equal(facts[1].status, "Marked valid");
  assert.match(facts[1].detail, /does not establish/);
  assert.equal(facts.at(-1)?.status, "Unavailable");
});

test("supported zero and missing traversal count remain distinct", () => {
  const value = input();
  assert.equal(measurementReadiness(value)[2].status, "Unavailable");
  value.traffic.totals.completed_traversals = 0;
  assert.equal(measurementReadiness(value)[2].status, "0 recorded");
  assert.equal(measurementReadiness(value)[2].missing, true);
});

test("sample traversals stay labeled and partial pollutant records do not imply complete estimates", () => {
  const value = input();
  value.mode = "synthetic";
  value.traffic.totals.completed_traversals = 16;
  value.emissions.quality_state = "ok";
  value.emissions.estimate_g_by_pollutant.co2 = 0;
  const facts = measurementReadiness(value);
  assert.equal(facts[2].status, "16 recorded");
  assert.match(facts[2].detail, /synthetic aggregate/);
  assert.equal(facts.at(-1)?.status, "Partial estimates");
  assert.equal(facts.at(-1)?.missing, true);
});

test("complete supported pollutant zeros are recorded estimates, not missing values", () => {
  const value = input();
  value.emissions = {
    quality_state: "ok",
    estimate_g_by_pollutant: { co2: 0, nox: 0 },
  };
  assert.equal(
    measurementReadiness(value).at(-1)?.status,
    "Estimates recorded",
  );
});

test("server registry facts replace static physical flags without claiming reviewed counts", () => {
  const value = input();
  value.traffic.totals.count = 24;
  value.measurement = {
    camera_id: "222", mode: "live", from: "2026-11-07T20:00:00Z", to: "2026-11-07T21:00:00Z",
    registry: { state: "configured", revision: "controlled-test", calibration_version: "controlled-calibration", mapping_versions: ["controlled-mapping"], physical_calibration_approved: false },
    minutes: [], evidence_refs: [], limitations: [],
    scenario: {
      available: false,
      pollutants: {
        co2: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null },
        nox: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null },
      },
      completed_cohort: {
        count: null,
        baseline: { distance_m: null, traversal_time_s: null, stopped_time_s: null },
        scenario: { distance_m: null, traversal_time_s: null, stopped_time_s: null },
      },
      assumptions: [], evidence_refs: [], limitations: [],
    },
  };
  let facts = measurementReadiness(value);
  assert.equal(facts[0].status, "Count review not reported");
  assert.equal(facts[1].status, "Not approved");
  assert.equal(facts.at(-1)?.status, "Unavailable");
  value.measurement.registry.physical_calibration_approved = true;
  facts = measurementReadiness(value);
  assert.equal(facts[1].status, "Registry approved");
  assert.equal(facts[0].status, "Count review not reported");
  assert.equal(facts.at(-1)?.status, "Unavailable");
  assert.match(facts[1].detail, /controlled-calibration/);
});

test("unsupported numeric fields do not claim readiness, while supported pollutants remain independent", () => {
  const value = input();
  value.emissions.estimate_g_by_pollutant = { co2: 0, nox: 0 };
  assert.equal(measurementReadiness(value).at(-1)?.status, "Unavailable");
  value.emissions.estimate_g_by_pollutant.nox = null;
  value.emissions.rows = [{
    camera_id: "222", minute: "2026-11-07T20:04:00Z", mode: "live", pollutant: "co2",
    quality_state: "ok", estimate_g: 0, range_low_g: null, range_high_g: null,
    factor_version: "controlled-test-factor", method_version: "controlled-test-method",
  }];
  const fact = measurementReadiness(value).at(-1)!;
  assert.equal(fact.status, "Partial estimates");
  assert.match(fact.detail, /CO₂: recorded; NOₓ: unavailable/);
  assert.equal(fact.missing, true);
});

test("readiness reports a supported minute separately from unsupported reporting-hour totals", () => {
  const value = input();
  value.mode = "replay"; value.measurement = supportedWindow();
  const before = structuredClone(value.measurement);
  let fact = measurementReadiness(value).at(-1)!;
  assert.equal(fact.status, "Supported minute retained");
  assert.match(fact.detail, /2026-11-08T03:58:00Z/);
  assert.match(fact.detail, /separate from the reporting-hour total and feed freshness/);
  assert.match(fact.detail, /Reporting-hour CO₂: unavailable; NOₓ: unavailable/);
  assert.equal(fact.missing, false);
  assert.deepEqual(value.measurement, before);
  value.measurement.minutes[0].emissions[1].estimate_g = null;
  fact = measurementReadiness(value).at(-1)!;
  assert.equal(fact.status, "Supported minute retained");
  assert.equal(fact.missing, true);
});
