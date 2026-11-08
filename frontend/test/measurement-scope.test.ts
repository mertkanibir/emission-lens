import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { MeasurementWindowView } from "@emission-lens/backend";
import { measurementScope } from "../src/lib/measurement-scope.ts";
import { MeasurementScope } from "../src/components/MeasurementScope.tsx";
import { ScenarioPollutants } from "../src/components/ScenarioPollutants.tsx";
import { scenarioPollutantRows } from "../src/lib/measurement.ts";

/** In-memory presentation fixture only; no registry or source record is installed. */
function windowView(camera: "222" | "223" = "222", combined = false): MeasurementWindowView {
  const calibration = camera === "222" ? "222-ground-esri-v1-7f52d53d8fc8" : "223-ground-esri-v1-34782d640860";
  return {
    camera_id: camera, mode: "replay",
    from: "2026-11-08T03:20:00Z", to: "2026-11-08T04:20:00Z",
    registry: {
      state: "configured", revision: combined ? "222-223-2026-11-08T04:03:40Z" : "222-first-camera-2026-11-08T03:19:55Z",
      calibration_version: calibration,
      mapping_versions: ["pretrained-visual-to-emfac2007-v1"],
      physical_calibration_approved: true,
    },
    minutes: [{
      minute: "2026-11-08T03:30:00Z", batch_id: "display-fixture", revision: 0,
      state: "ready", reasons: [], timing_basis: "estimated_hls_media_utc",
      meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
      calibration_version: calibration,
      mapping_version: "pretrained-visual-to-emfac2007-v1",
      evidence_ref: "display-only", traffic: [], emissions: [],
    }],
    scenario: {
      available: false,
      completed_cohort: {
        count: 1,
        baseline: { distance_m: camera === "222" ? 20 : 15, traversal_time_s: 10, stopped_time_s: null },
        scenario: { distance_m: camera === "222" ? 20 : 15, traversal_time_s: null, stopped_time_s: null },
      },
      pollutants: {
        co2: { baseline_g: 1, scenario_g: null, change_g: null, change_pct: null },
        nox: { baseline_g: 0.001, scenario_g: null, change_g: null, change_pct: null },
      },
      evidence_refs: [], assumptions: [], limitations: [],
    },
    evidence_refs: [], limitations: [],
  };
}

test("the exact approved public profile discloses bounded scope and assumptions without claiming outputs", () => {
  const view = windowView();
  const scope = measurementScope(view);
  assert.equal(scope.known, true);
  const html = renderToStaticMarkup(createElement(MeasurementScope, { scope }));
  assert.match(html, /Eastern 20 m segment/);
  assert.match(html, /completed eastbound movement vehicles, not every crossing or the whole intersection/);
  assert.match(html, /fixed modeling assumptions/);
  assert.match(html, /not measured fleet shares/);
  assert.match(html, /curved-turn paths may be longer/);
  assert.match(html, /70 °F and 60% relative humidity/);
  assert.match(html, /not measured weather/);
  assert.match(html, /stopped time is unavailable/);
  assert.match(html, /nonzero stopped-time reduction cannot be calculated/);
  assert.doesNotMatch(html, /count-[123]|data\/raw|session_id|traversal_id|registry\.json/);
});

test("a different camera, mode, approval, revision or retained version cannot inherit the known scope", () => {
  const changes: Array<(view: MeasurementWindowView) => void> = [
    (v) => { v.camera_id = "223"; },
    (v) => { v.mode = "synthetic"; },
    (v) => { v.registry.state = "invalid"; },
    (v) => { v.registry.physical_calibration_approved = false; },
    (v) => { v.registry.revision = "another-revision"; },
    (v) => { v.registry.calibration_version = "another-calibration"; },
    (v) => { v.registry.mapping_versions = ["another-mapping"]; },
    (v) => { v.registry.mapping_versions.push("another-mapping"); },
    (v) => { v.minutes[0].calibration_version = null; },
    (v) => { v.minutes[0].mapping_version = "another-mapping"; },
    (v) => { v.minutes.push({ ...v.minutes[0], calibration_version: "another-calibration" }); },
  ];
  for (const change of changes) {
    const view = windowView();
    change(view);
    const html = renderToStaticMarkup(createElement(MeasurementScope, { scope: measurementScope(view) }));
    assert.match(html, /Movement scope not reported/);
    assert.doesNotMatch(html, /Eastern 20 m|70 °F|curved-turn/);
  }
  const live = windowView(); live.mode = "live";
  assert.equal(measurementScope(live).known, true);
});

test("missing and mixed weather do not become invented 70 degree observations", () => {
  const empty = windowView(); empty.minutes = [];
  assert.match(measurementScope(empty).assumptions.join(" "), /No retained weather inputs/);
  assert.doesNotMatch(measurementScope(empty).assumptions.join(" "), /70 °F/);
  const mixed = windowView();
  mixed.minutes.push({ ...mixed.minutes[0], meteorology: { temperature_f: 80, relative_humidity_pct: 60 } });
  assert.match(measurementScope(mixed).assumptions.join(" "), /vary by retained minute/);
  assert.doesNotMatch(measurementScope(mixed).assumptions.join(" "), /70 °F/);
  const supportedZero = windowView();
  supportedZero.scenario.completed_cohort.baseline.stopped_time_s = 0;
  assert.doesNotMatch(measurementScope(supportedZero).assumptions.join(" "), /stopped time is unavailable/);
});

test("scope disclosure preserves missing scenario grams and signed changes", () => {
  const view = windowView();
  const before = structuredClone(view);
  measurementScope(view);
  assert.deepEqual(view, before);
  const html = renderToStaticMarkup(createElement(ScenarioPollutants, {
    rows: scenarioPollutantRows(view.scenario.pollutants),
  }));
  assert.equal((html.match(/class="q-null">Unavailable/g) ?? []).length, 6);
  assert.doesNotMatch(html, /savings|−100%/);
});

test("the exact combined registry retains 222 scope and adds only the matching 223 southbound profile", () => {
  for (const camera of ["222", "223"] as const) {
    for (const mode of ["live", "replay"] as const) {
      const view = windowView(camera, true); view.mode = mode;
      const before = structuredClone(view);
      const scope = measurementScope(view);
      const html = renderToStaticMarkup(createElement(MeasurementScope, { scope }));
      assert.equal(scope.known, true);
      assert.match(html, camera === "222" ? /Eastern 20 m segment/ : /15 m southbound segment/);
      assert.match(html, camera === "222" ? /completed eastbound movement vehicles/ : /completed southbound movement vehicles/);
      assert.match(html, new RegExp(`The ${camera === "222" ? 20 : 15} m distance`));
      assert.match(html, /fixed modeling assumptions/);
      assert.match(html, /not measured fleet shares/);
      assert.match(html, /70 °F and 60% relative humidity/);
      assert.match(html, /not measured weather/);
      assert.match(html, /curved-turn paths may be longer/);
      assert.match(html, /stopped time is unavailable/);
      assert.doesNotMatch(html, /count-[123]|data\/raw|session_id|traversal_id|registry\.json/);
      assert.deepEqual(view, before);
    }
  }
});

test("combined-profile recognition rejects cross-camera, old-only, mixed, revoked and unknown references", () => {
  const changes: Array<(view: MeasurementWindowView) => void> = [
    (v) => { v.camera_id = "222"; },
    (v) => { v.camera_id = "228"; },
    (v) => { v.registry.revision = "222-first-camera-2026-11-08T03:19:55Z"; },
    (v) => { v.registry.revision = "222-223-unknown"; },
    (v) => { v.registry.calibration_version = "222-ground-esri-v1-7f52d53d8fc8"; },
    (v) => { v.registry.mapping_versions = ["another-mapping"]; },
    (v) => { v.registry.mapping_versions.push("another-mapping"); },
    (v) => { v.registry.physical_calibration_approved = false; },
    (v) => { v.registry.state = "invalid"; },
    (v) => { v.registry.state = "missing"; },
    (v) => { v.mode = "synthetic"; },
    (v) => { v.minutes[0].calibration_version = "222-ground-esri-v1-7f52d53d8fc8"; },
    (v) => { v.minutes[0].mapping_version = null; },
    (v) => { v.minutes.push({ ...v.minutes[0], calibration_version: "unreviewed-version" }); },
  ];
  for (const change of changes) {
    const view = windowView("223", true); change(view);
    const scope = measurementScope(view);
    assert.equal(scope.known, false);
    assert.match(scope.title, /not reported/);
    assert.doesNotMatch(renderToStaticMarkup(createElement(MeasurementScope, { scope })), /15 m|20 m|70 °F|southbound|eastbound/);
  }
  const reverse = windowView("222", true);
  reverse.registry.calibration_version = "223-ground-esri-v1-34782d640860";
  reverse.minutes[0].calibration_version = reverse.registry.calibration_version;
  assert.equal(measurementScope(reverse).known, false);
});

test("223 registration without records supplies context but never manufactures weather or physical values", () => {
  const view = windowView("223", true);
  view.minutes = [];
  view.scenario.completed_cohort = { count: null, baseline: { distance_m: null, traversal_time_s: null, stopped_time_s: null }, scenario: { distance_m: null, traversal_time_s: null, stopped_time_s: null } };
  view.scenario.pollutants = { co2: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null }, nox: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null } };
  const before = structuredClone(view);
  const scope = measurementScope(view);
  assert.equal(scope.known, true);
  assert.match(scope.assumptions.join(" "), /No retained weather inputs/);
  assert.doesNotMatch(scope.assumptions.join(" "), /70 °F/);
  const html = renderToStaticMarkup(createElement(ScenarioPollutants, { rows: scenarioPollutantRows(view.scenario.pollutants) }));
  assert.equal((html.match(/class="q-null">Unavailable/g) ?? []).length, 8);
  assert.deepEqual(view, before);
  const mixed = windowView("223", true);
  mixed.minutes.push({ ...mixed.minutes[0], meteorology: { temperature_f: 80, relative_humidity_pct: 50 } });
  assert.match(measurementScope(mixed).assumptions.join(" "), /vary by retained minute/);
  mixed.scenario.completed_cohort.baseline.stopped_time_s = 0;
  assert.doesNotMatch(measurementScope(mixed).assumptions.join(" "), /stopped time is unavailable/);
});
