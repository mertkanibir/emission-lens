import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MeasurementWindowView } from "@emission-lens/backend";
import { MeasurementSnapshots } from "../src/components/MeasurementSnapshots.tsx";

/** Public rendering shapes only; no physical approval or record is installed. */
function view(): MeasurementWindowView {
  return {
    camera_id: "222", mode: "replay", from: "2026-11-08T03:00:00Z", to: "2026-11-08T04:00:00Z",
    registry: { state: "missing", revision: null, calibration_version: null, mapping_versions: [], physical_calibration_approved: false },
    minutes: [
      { minute: "2026-11-08T03:58:00Z", batch_id: "render-ready", revision: 0, state: "ready", reasons: [], timing_basis: "estimated_hls_media_utc", meteorology: { temperature_f: 70, relative_humidity_pct: 60 }, calibration_version: null, mapping_version: null, evidence_ref: "public-reference", traffic: [], emissions: [
        { camera_id: "222", minute: "2026-11-08T03:58:00Z", pollutant: "co2", estimate_g: 35.741459375498366, range_low_g: null, range_high_g: null, factor_version: "render-factor", method_version: "render-method", quality_state: "ok", mode: "replay" },
        { camera_id: "222", minute: "2026-11-08T03:58:00Z", pollutant: "nox", estimate_g: 0.0065337364924251285, range_low_g: null, range_high_g: null, factor_version: "render-factor", method_version: "render-method", quality_state: "ok", mode: "replay" },
      ] },
      { minute: "2026-11-08T03:59:00Z", batch_id: "render-gap", revision: 0, state: "unavailable", reasons: ["No completed traversals"], timing_basis: "estimated_hls_media_utc", meteorology: { temperature_f: 70, relative_humidity_pct: 60 }, calibration_version: null, mapping_version: null, evidence_ref: "public-gap", traffic: [], emissions: [
        { camera_id: "222", minute: "2026-11-08T03:59:00Z", pollutant: "co2", estimate_g: null, range_low_g: null, range_high_g: null, factor_version: "render-factor", method_version: "render-method", quality_state: "insufficient_evidence", mode: "replay" },
      ] },
    ],
    scenario: { available: false, pollutants: { co2: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null }, nox: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null } }, completed_cohort: { count: 8, baseline: { distance_m: null, traversal_time_s: null, stopped_time_s: null }, scenario: { distance_m: null, traversal_time_s: null, stopped_time_s: null } }, evidence_refs: [], assumptions: [], limitations: [] },
    evidence_refs: [], limitations: [],
  };
}

test("snapshots expose precise ready-minute grams alongside an unavailable minute without changing the window", () => {
  const window = view(); const before = structuredClone(window);
  const html = renderToStaticMarkup(createElement(MeasurementSnapshots, { window }));
  assert.match(html, /Per-minute estimates for completed movement vehicles/);
  assert.match(html, /do not create a partial whole-window total/);
  assert.match(html, /Estimated CO₂ · ok/);
  assert.match(html, /title="35.741459375498366 g"/);
  assert.match(html, /Estimated NOₓ · ok/);
  assert.match(html, /0\.006534/);
  assert.match(html, /title="0.0065337364924251285 g"/);
  assert.match(html, /Estimated CO₂ · insufficient evidence/);
  assert.match(html, /class="q-null">Unavailable/);
  assert.deepEqual(window, before);
});

test("supported zero stays zero and missing or unsupported minute grams stay unavailable", () => {
  const window = view();
  window.minutes[0].emissions[0].estimate_g = 0;
  window.minutes[0].emissions[1].estimate_g = 0.003161844094161299;
  let html = renderToStaticMarkup(createElement(MeasurementSnapshots, { window }));
  assert.match(html, /title="0 g"/);
  assert.match(html, /0\.003162/);
  window.minutes[0].emissions[0].quality_state = "unavailable";
  window.minutes[0].emissions[1].estimate_g = null;
  html = renderToStaticMarkup(createElement(MeasurementSnapshots, { window }));
  assert.doesNotMatch(html, /title="0 g"|0\.003162/);
  assert.equal((html.match(/class="q-null">Unavailable/g) ?? []).length, 4);
});

test("each pollutant keeps its own support and an absent row is explicitly unavailable", () => {
  const window = view();
  window.minutes[0].state = "unavailable";
  window.minutes[0].emissions = [window.minutes[0].emissions[1]];
  const html = renderToStaticMarkup(createElement(MeasurementSnapshots, { window }));
  assert.match(html, /Estimated CO₂ · unavailable/);
  assert.match(html, /Estimated NOₓ · ok/);
  assert.match(html, /0\.006534/);
  assert.equal((html.match(/class="q-null">Unavailable/g) ?? []).length, 3);
});
