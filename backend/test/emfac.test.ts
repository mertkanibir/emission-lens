import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  estimate_completed_traversals,
  get_factor_catalog_status,
  lookup_runex_factor,
  type EstimateInput,
} from "../src/index.ts";
import { speed_bin_mph } from "../../emissions/src/index.ts";

const input = (): EstimateInput => ({
  camera_id: "222", minute: "2026-11-07T21:00:00Z", mode: "synthetic",
  calibration: { camera_id: "222", version: "synthetic-test-only", validation_status: "valid", gates: {}, reference_measurements: {}, transform: [] },
  class_mapping: { version: "synthetic-LDA-assumption", evidence: "Unit-test scenario only: assume the car is an LDA; not an approved live mapping.", classes: { car: [{ emfac_class: "LDA", vmt_share: 1 }] } },
  meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
  traversals: [{ session_id: "test", traversal_id: "1", completed_at: "2026-11-07T21:00:30Z", vehicle_class: "car", distance_m: 1609.344, traversal_time_s: 360 }],
});

test("catalog exposes real source provenance and the complete regional factor grid", () => {
  const status = get_factor_catalog_status();
  assert.equal(status.state, "validated");
  assert.equal(status.model_version, "EMFAC2025 v2.1.1");
  assert.equal(status.region, "Los Angeles (SC)");
  assert.equal(status.validation.factor_rows, 1296);
  assert.equal(status.production_mapping_loaded, false);
});

test("one vehicle-mile reproduces CARB's original RUNEX g/vehicle-mile", () => {
  const lines = readFileSync(new URL("../../emissions/data/la-2026/carb-source.csv", import.meta.url), "utf8").trim().split(/\r?\n/);
  const originals = lines.slice(1).map((line) => line.split(","));
  const result = estimate_completed_traversals(input());
  for (const pollutant of ["co2", "nox"]) {
    const source = originals.find((r) => r[3] === "LDA" && r[4] === "70" && r[5] === "60" && r[6] === "RUNEX" && r[7] === "10" && r[8].toLowerCase() === pollutant)!;
    assert.ok(source);
    const value = result.rows.find((row) => row.pollutant === pollutant)!.estimate_g!;
    assert.ok(Math.abs(value - Number(source[9])) < 1e-9);
  }
  assert.equal(result.evidence[0].speed_bin_mph, 10);
  assert.equal(result.rows[0].mode, "synthetic");
  assert.equal(result.rows[0].range_low_g, null);
  assert.equal(result.mapping_version, "synthetic-LDA-assumption");
});

test("short traversals scale by distance, not vehicle count or number of frames", () => {
  const full = estimate_completed_traversals(input()).rows[0].estimate_g!;
  const value = input();
  value.traversals[0].distance_m /= 10;
  value.traversals[0].traversal_time_s /= 10;
  assert.ok(Math.abs(estimate_completed_traversals(value).rows[0].estimate_g! - full / 10) < 1e-9);
});

test("upper-edge speed bins preserve exact boundaries and reject unsupported speeds", () => {
  for (const [speed, bin] of [[0.1, 5], [5, 5], [5.001, 10], [10, 10], [10.000000000000002, 10], [85.1, 90], [90, 90]]) assert.equal(speed_bin_mph(speed), bin);
  for (const speed of [0, -1, NaN, Infinity, 91]) assert.throws(() => speed_bin_mph(speed));
});

test("lookup does not invent factors for unknown classes or unavailable weather", () => {
  assert.equal(lookup_runex_factor({ emfac_class: "unknown", pollutant: "co2", speed_mph: 10, temperature_f: 70, relative_humidity_pct: 60 }), null);
  assert.equal(lookup_runex_factor({ emfac_class: "LDA", pollutant: "co2", speed_mph: 10, temperature_f: 65, relative_humidity_pct: 60 }), null);
});

test("stops are included in total traversal time without a second idle term", () => {
  const value = input();
  value.traversals[0].traversal_time_s = 720;
  const result = estimate_completed_traversals(value);
  const rate = lookup_runex_factor({ emfac_class: "LDA", pollutant: "co2", speed_mph: 5, ...value.meteorology })!;
  assert.ok(Math.abs(result.rows[0].estimate_g! - rate * 1.609344) < 1e-9);
  assert.equal(result.evidence[0].speed_bin_mph, 5);
});

test("empty queue, missing calibration, missing mapping, and unknowns stay null", () => {
  const empty = input(); empty.traversals = [];
  assert.equal(estimate_completed_traversals(empty).rows[0].quality_state, "insufficient_evidence");
  const uncalibrated = input(); uncalibrated.calibration.validation_status = "missing";
  assert.equal(estimate_completed_traversals(uncalibrated).rows[0].quality_state, "calibration_invalid");
  const noMapping = input(); noMapping.class_mapping = null;
  assert.equal(estimate_completed_traversals(noMapping).rows[0].estimate_g, null);
  const unknown = input(); unknown.traversals[0].vehicle_class = "unknown";
  assert.equal(estimate_completed_traversals(unknown).rows[0].estimate_g, null);
});

test("a known class plus an unmapped class does not produce a misleading partial total", () => {
  const value = input();
  value.traversals.push({ ...value.traversals[0], traversal_id: "2", vehicle_class: "truck" });
  const result = estimate_completed_traversals(value);
  assert.equal(result.rows[0].estimate_g, null);
  assert.deepEqual(result.evidence, []);
});

test("CARB mixtures are combined using explicit VMT weights", () => {
  const value = input();
  value.class_mapping!.classes.car = [{ emfac_class: "LDA", vmt_share: 0.75 }, { emfac_class: "LDT2", vmt_share: 0.25 }];
  const result = estimate_completed_traversals(value);
  const factor = (c: string) => lookup_runex_factor({ emfac_class: c, pollutant: "co2", speed_mph: 10, ...value.meteorology })!;
  assert.ok(Math.abs(result.rows[0].estimate_g! - (factor("LDA") * 0.75 + factor("LDT2") * 0.25) * 1.609344) < 1e-9);
});

test("invalid mapping weights, duplicate categories, or unsupported categories are rejected", () => {
  for (const mix of [[{ emfac_class: "LDA", vmt_share: 0.5 }], [{ emfac_class: "LDA", vmt_share: NaN }], [{ emfac_class: "LDA", vmt_share: 0.5 }, { emfac_class: "LDA", vmt_share: 0.5 }], [{ emfac_class: "Tesla", vmt_share: 1 }]]) {
    const value = input(); value.class_mapping!.classes.car = mix;
    assert.throws(() => estimate_completed_traversals(value));
  }
});

test("duplicate traversal IDs in one session are rejected, different sessions stay separate", () => {
  const value = input(); value.traversals.push({ ...value.traversals[0] });
  assert.throws(() => estimate_completed_traversals(value), /duplicate/);
  value.traversals[1].session_id = "new-session";
  assert.equal(estimate_completed_traversals(value).evidence.length, 2);
});

test("invalid distances, durations, timestamps, and calibration camera IDs are rejected", () => {
  for (const field of ["distance_m", "traversal_time_s"] as const) {
    for (const bad of [0, -1, NaN, Infinity]) {
      const value = input(); value.traversals[0][field] = bad;
      assert.throws(() => estimate_completed_traversals(value));
    }
  }
  const wrongCamera = input(); wrongCamera.calibration.camera_id = "223";
  assert.throws(() => estimate_completed_traversals(wrongCamera));
  for (const minute of ["2026-11-07T21:00:01Z", "2026-02-30T00:00:00Z", "2026-11-07T21:00:00", "invalid"]) {
    const value = input(); value.minute = minute;
    assert.throws(() => estimate_completed_traversals(value));
  }
});

test("traversals must complete inside the requested minute", () => {
  const value = input(); value.traversals[0].completed_at = "2026-11-07T21:01:00Z";
  assert.throws(() => estimate_completed_traversals(value), /reporting minute/);
});

test("weather outside the table and other local calendar years stay unavailable", () => {
  const weather = input(); weather.meteorology.relative_humidity_pct = 50;
  assert.equal(estimate_completed_traversals(weather).rows[0].estimate_g, null);
  const year = input(); year.minute = "2027-01-01T08:00:00Z";
  assert.equal(estimate_completed_traversals(year).rows[0].estimate_g, null);
  const local2026 = input(); local2026.minute = "2027-01-01T00:00:00Z"; local2026.traversals[0].completed_at = "2027-01-01T00:00:30Z";
  assert.equal(estimate_completed_traversals(local2026).rows[0].quality_state, "ok");
});

test("a valid flag without calibration references cannot enable emissions", () => {
  const value = input(); value.calibration.reference_measurements = null;
  assert.equal(estimate_completed_traversals(value).rows[0].quality_state, "calibration_invalid");
});
