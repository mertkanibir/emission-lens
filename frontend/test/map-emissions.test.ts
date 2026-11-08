import assert from "node:assert/strict";
import test from "node:test";
import type { MeasurementWindowView } from "@emission-lens/backend";
import { latestSupportedMapEstimate } from "../src/lib/map-emissions.ts";

/** Public presentation shapes only; these records install no service or approval. */
function view(): MeasurementWindowView {
  return {
    camera_id: "222", mode: "replay",
    from: "2026-11-08T03:00:00Z", to: "2026-11-08T04:00:00Z",
    registry: {
      state: "configured", revision: "map-render-test",
      calibration_version: "render-calibration", mapping_versions: ["render-mapping"],
      physical_calibration_approved: true,
    },
    minutes: [{
      minute: "2026-11-08T03:58:00Z", batch_id: "render-supported", revision: 0,
      state: "ready", reasons: [], timing_basis: "estimated_hls_media_utc",
      meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
      calibration_version: "render-calibration", mapping_version: "render-mapping",
      evidence_ref: "public-render-reference", traffic: [],
      emissions: [
        { camera_id: "222", minute: "2026-11-08T03:58:00Z", pollutant: "co2", mode: "replay", estimate_g: 35.741459375498366, range_low_g: null, range_high_g: null, factor_version: "render-factor", method_version: "render-method", quality_state: "ok" },
        { camera_id: "222", minute: "2026-11-08T03:58:00+00:00", pollutant: "nox", mode: "replay", estimate_g: 0.0065337364924251285, range_low_g: null, range_high_g: null, factor_version: "render-factor", method_version: "render-method", quality_state: "ok" },
      ],
    }],
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
      evidence_refs: [], assumptions: [], limitations: [],
    },
    evidence_refs: [], limitations: [],
  };
}

function atMinute(window: MeasurementWindowView, minute: string) {
  const snapshot = structuredClone(window.minutes[0]);
  snapshot.minute = minute;
  for (const row of snapshot.emissions) row.minute = minute;
  return snapshot;
}

test("latest supported snapshot retains its time when a newer minute is insufficient", () => {
  const window = view();
  const older = atMinute(window, "2026-11-08T03:57:00Z");
  older.emissions[0].estimate_g = 100;
  const unavailable = atMinute(window, "2026-11-08T03:59:00Z");
  unavailable.state = "unavailable";
  for (const row of unavailable.emissions) {
    row.quality_state = "insufficient_evidence";
    row.estimate_g = null;
  }
  window.minutes = [unavailable, older, ...window.minutes];
  assert.deepEqual(latestSupportedMapEstimate(window), {
    minute: "2026-11-08T03:58:00Z", co2_g: 35.741459375498366, nox_g: 0.0065337364924251285,
  });
  assert.equal(window.scenario.pollutants.co2.baseline_g, null);
});

test("only matching live or replay rows under a configured approved registry qualify", () => {
  const mutations: Array<(window: MeasurementWindowView) => void> = [
    (w) => { w.mode = "synthetic"; for (const r of w.minutes[0].emissions) r.mode = "synthetic"; },
    (w) => { w.mode = "live"; },
    (w) => { w.minutes[0].emissions[0].mode = "synthetic"; },
    (w) => { w.minutes[0].emissions[0].camera_id = "223"; },
    (w) => { w.registry.state = "missing"; },
    (w) => { w.registry.state = "invalid"; },
    (w) => { w.registry.physical_calibration_approved = false; },
    (w) => { w.registry.calibration_version = null; },
    (w) => { w.registry.calibration_version = ""; w.minutes[0].calibration_version = ""; },
    (w) => { w.minutes[0].calibration_version = null; },
    (w) => { w.minutes[0].calibration_version = "other-calibration"; },
    (w) => { w.minutes[0].mapping_version = null; },
    (w) => { w.minutes[0].mapping_version = "other-mapping"; },
    (w) => { w.registry.mapping_versions = []; },
    (w) => { w.registry.mapping_versions = [""]; w.minutes[0].mapping_version = ""; },
  ];
  for (const mutate of mutations) {
    const window = view(); mutate(window);
    assert.equal(latestSupportedMapEstimate(window), null);
  }
  const live = view(); live.mode = "live";
  for (const row of live.minutes[0].emissions) row.mode = "live";
  assert.equal(latestSupportedMapEstimate(live)?.co2_g, 35.741459375498366);
});

test("unavailable, null, nonfinite and negative CO2 never use whole-window fallback", () => {
  const mutations: Array<(window: MeasurementWindowView) => void> = [
    (w) => { w.minutes = []; },
    (w) => { w.minutes[0].state = "unavailable"; },
    (w) => { w.minutes[0].emissions = []; },
    (w) => { w.minutes[0].emissions[0].quality_state = "unavailable"; },
    (w) => { w.minutes[0].emissions[0].estimate_g = null; },
    (w) => { w.minutes[0].emissions[0].estimate_g = NaN; },
    (w) => { w.minutes[0].emissions[0].estimate_g = Infinity; },
    (w) => { w.minutes[0].emissions[0].estimate_g = -1; },
    (w) => { w.minutes[0].emissions[0].minute = "2026-11-08T03:57:00Z"; },
  ];
  for (const mutate of mutations) {
    const window = view(); window.scenario.pollutants.co2.baseline_g = 999;
    mutate(window);
    assert.equal(latestSupportedMapEstimate(window), null);
  }
});

test("bounds are half-open and invalid or reversed window times are rejected", () => {
  const mutations: Array<(window: MeasurementWindowView) => void> = [
    (w) => { w.from = "2026-11-08T03:59:00Z"; },
    (w) => { w.to = "2026-11-08T03:58:00Z"; },
    (w) => { w.from = "2026-11-08T04:00:00Z"; },
    (w) => { w.from = "invalid"; },
    (w) => { w.to = "invalid"; },
    (w) => { w.minutes[0].minute = "invalid"; },
  ];
  for (const mutate of mutations) {
    const window = view(); mutate(window);
    assert.equal(latestSupportedMapEstimate(window), null);
  }
  const atStart = view(); atStart.from = "2026-11-08T03:58:00+00:00";
  assert.notEqual(latestSupportedMapEstimate(atStart), null);
});

test("duplicate snapshots at the chosen instant are rejected instead of merged or selected", () => {
  for (const duplicateUnavailable of [false, true]) {
    const window = view();
    const older = atMinute(window, "2026-11-08T03:57:00Z");
    const duplicate = atMinute(window, "2026-11-08T03:58:00+00:00");
    if (duplicateUnavailable) duplicate.state = "unavailable";
    window.minutes.push(older, duplicate);
    assert.equal(latestSupportedMapEstimate(window), null);
  }
  for (const pollutant of ["co2", "nox"] as const) {
    const window = view();
    window.minutes[0].emissions.push({ ...window.minutes[0].emissions.find((row) => row.pollutant === pollutant)! });
    assert.equal(latestSupportedMapEstimate(window), null);
  }
});

test("supported zero and small NOx are copied exactly without source mutation", () => {
  const window = view(); window.minutes[0].emissions[0].estimate_g = 0;
  const before = structuredClone(window);
  for (const row of window.minutes[0].emissions) Object.freeze(row);
  Object.freeze(window.minutes[0].emissions);
  Object.freeze(window.minutes[0]); Object.freeze(window.minutes); Object.freeze(window.registry);
  Object.freeze(window);
  assert.deepEqual(latestSupportedMapEstimate(window), {
    minute: "2026-11-08T03:58:00Z", co2_g: 0, nox_g: 0.0065337364924251285,
  });
  assert.deepEqual(window, before);
});

test("NOx requires its own matching supported finite value and never borrows CO2", () => {
  const mutations: Array<(window: MeasurementWindowView) => void> = [
    (w) => { w.minutes[0].emissions.pop(); },
    (w) => { w.minutes[0].emissions[1].quality_state = "insufficient_evidence"; },
    (w) => { w.minutes[0].emissions[1].estimate_g = null; },
    (w) => { w.minutes[0].emissions[1].estimate_g = NaN; },
    (w) => { w.minutes[0].emissions[1].estimate_g = Infinity; },
    (w) => { w.minutes[0].emissions[1].estimate_g = -1; },
    (w) => { w.minutes[0].emissions[1].mode = "synthetic"; },
    (w) => { w.minutes[0].emissions[1].camera_id = "223"; },
    (w) => { w.minutes[0].emissions[1].minute = "2026-11-08T03:59:00Z"; },
  ];
  for (const mutate of mutations) {
    const window = view(); mutate(window);
    assert.deepEqual(latestSupportedMapEstimate(window), {
      minute: "2026-11-08T03:58:00Z", co2_g: 35.741459375498366, nox_g: null,
    });
  }
  const zero = view(); zero.minutes[0].emissions[1].estimate_g = 0;
  assert.equal(latestSupportedMapEstimate(zero)?.nox_g, 0);
});
