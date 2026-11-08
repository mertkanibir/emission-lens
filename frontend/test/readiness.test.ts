import assert from "node:assert/strict";
import test from "node:test";
import { measurementReadiness } from "../src/lib/readiness.ts";

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
  assert.equal(facts.at(-1)?.status, "Unavailable");
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
