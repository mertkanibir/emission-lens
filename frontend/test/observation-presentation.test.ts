import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { latestSupportedMapEstimate } from "../src/lib/map-emissions.ts";
import { latestSupportedMinuteCohort, measurementSupport, queueObservation } from "../src/lib/observation-presentation.ts";
import { SelectedEmissionMetric } from "../src/components/SelectedEmissionMetric.tsx";
import { SupportedMinuteEstimate } from "../src/components/SupportedMinuteEstimate.tsx";
import { Quantity } from "../src/components/ui.tsx";
import { supportedWindow, queueRow, queueWindow } from "./fixtures/supported-window.ts";

test("the summary shows a supported minute beside an unavailable hour without changing either", () => {
  const window = supportedWindow();
  const missing = structuredClone(window.minutes[0]);
  missing.minute = "2026-11-08T03:59:00Z"; missing.state = "unavailable";
  for (const row of missing.emissions) { row.minute = missing.minute; row.estimate_g = null; row.quality_state = "insufficient_evidence"; }
  window.minutes.push(missing);
  const before = structuredClone(window);
  const estimate = latestSupportedMapEstimate(window);
  const html = renderToStaticMarkup(createElement(SelectedEmissionMetric, {
    estimate, windowCo2: null, cameraId: "222", mode: window.mode, state: "degraded",
    support: measurementSupport(window.registry, estimate),
  }));
  assert.match(html, /title="35.741459375498366 g"/);
  assert.match(html, /Latest supported minute/);
  assert.match(html, /dateTime="2026-11-08T03:58:00Z"/);
  assert.match(html, /Nov 7, 7:58 PM PST/);
  assert.match(html, /Camera 222 · Replay · feed degraded · completed movement only/);
  assert.match(html, /Reporting-hour CO₂: unavailable/);
  assert.doesNotMatch(html, /title="0 g"|savings|measured AQI/);
  assert.deepEqual(window, before);
  assert.equal(window.scenario.pollutants.co2.baseline_g, null);
});

test("the shared detail readout retains minute time, mode, offline state and independent NOx support", () => {
  const window = supportedWindow(); window.minutes[0].emissions[1].estimate_g = null;
  const estimate = latestSupportedMapEstimate(window)!;
  const html = renderToStaticMarkup(createElement(SupportedMinuteEstimate, { estimate, cameraId: "222", mode: "replay", state: "offline" }));
  assert.match(html, /Replay records · feed offline/);
  assert.match(html, /2026-11-08T03:58:00Z/);
  assert.match(html, /Estimated CO₂ · this minute/);
  assert.match(html, /Estimated NOₓ · same minute/);
  assert.match(html, /class="q-null">Unavailable/);
  assert.match(html, /separate from the reporting-hour total/);
});

test("supported-minute linked cohort zero is visible independently of unavailable observation-hour stops", () => {
  const estimate = latestSupportedMapEstimate(supportedWindow())!;
  const html = renderToStaticMarkup(createElement(SupportedMinuteEstimate, { estimate, cameraId: "222", mode: "replay", state: "offline", cohort: { count: 5, stopped_time_s: 0 } }));
  assert.match(html, /Completed movement cohort · same minute/);
  assert.match(html, /Traversal-linked stopped time · same cohort/);
  assert.match(html, /title="0 vehicle-s">0/);
  assert.match(html, /General observation-hour stopped time remains separate/);
  assert.match(html, /Video cannot establish whether an engine is running/);
  const absent = renderToStaticMarkup(createElement(SupportedMinuteEstimate, { estimate, cameraId: "222", mode: "replay", state: "offline", cohort: { count: 5, stopped_time_s: null } }));
  assert.match(absent, /Linked stopped time unavailable/);
  assert.doesNotMatch(absent, /title="0 vehicle-s"/);
  const tiny = renderToStaticMarkup(createElement(SupportedMinuteEstimate, { estimate, cameraId: "222", mode: "replay", state: "offline", cohort: { count: 5, stopped_time_s: 0.0001 } }));
  assert.match(tiny, /1E-4/);
  assert.doesNotMatch(tiny, /title="0 vehicle-s"/);
});

test("the linked cohort comes only from the exact supported minute and never from hour or observation stops", () => {
  const window = supportedWindow();
  window.scenario.completed_cohort = { count: 999, baseline: { distance_m: null, traversal_time_s: null, stopped_time_s: 999 }, scenario: { distance_m: null, traversal_time_s: null, stopped_time_s: 999 } };
  const observation = queueRow(null); observation.stopped_vehicle_seconds = 888;
  window.minutes[0].traffic = [observation];
  assert.equal(latestSupportedMinuteCohort(window), null);
  window.minutes[0].completed_cohort = { count: 5, stopped_time_s: 0 };
  const before = structuredClone(window);
  assert.deepEqual(latestSupportedMinuteCohort(window), { count: 5, stopped_time_s: 0 });
  assert.deepEqual(window, before);
  window.minutes[0].completed_cohort.stopped_time_s = null;
  assert.deepEqual(latestSupportedMinuteCohort(window), { count: 5, stopped_time_s: null });
  window.minutes[0].completed_cohort = { count: 0, stopped_time_s: 0 };
  assert.equal(latestSupportedMinuteCohort(window), null);
  window.minutes[0].completed_cohort = { count: 5, stopped_time_s: 0 };
  window.registry.physical_calibration_approved = false;
  assert.equal(latestSupportedMinuteCohort(window), null);
});

test("unapproved cameras cannot borrow supported values, and labeled synthetic totals stay samples", () => {
  for (const camera of ["220", "228"]) {
    const window = supportedWindow(); window.camera_id = camera; window.registry.state = "missing"; window.registry.physical_calibration_approved = false;
    const estimate = latestSupportedMapEstimate(window);
    const support = measurementSupport(window.registry, estimate);
    const html = renderToStaticMarkup(createElement(SelectedEmissionMetric, { estimate, windowCo2: null, cameraId: camera, mode: "live", state: "live", support }));
    assert.equal(estimate, null);
    assert.match(html, /Awaiting approved inputs/);
    assert.match(html, /fresh preview does not establish count accuracy/);
    assert.doesNotMatch(html, /35.7|title="0 g"|Latest supported minute/);
  }
  const window = supportedWindow(); window.mode = "synthetic";
  const html = renderToStaticMarkup(createElement(SelectedEmissionMetric, { estimate: latestSupportedMapEstimate(window), windowCo2: 0, cameraId: "222", mode: "synthetic", state: "live", support: measurementSupport(window.registry, null) }));
  assert.match(html, /title="0 g"/);
  assert.match(html, /Labeled synthetic reporting-window estimate/);
  assert.doesNotMatch(html, /Latest supported minute/);
});

test("a missing latest queue stays absent instead of resurrecting an older count", () => {
  const traffic = queueWindow([queueRow(5), queueRow(null, "2026-11-08T03:59:00Z")]);
  const before = structuredClone(traffic);
  const queue = queueObservation(traffic);
  assert.equal(queue.value, null);
  assert.equal(queue.minute, "2026-11-08T03:59:00.000Z");
  assert.equal(queue.label, "No queue observation");
  assert.match(queue.detail, /Older observations are not substituted/);
  assert.match(queue.detail, /configuration status is not reported/);
  const html = renderToStaticMarkup(createElement(Quantity, { value: queue.value, unavailable: queue.label }));
  assert.match(html, /No queue observation/);
  assert.doesNotMatch(html, />0</);
  assert.deepEqual(traffic, before);
});

test("one canonical-minute queue zero is a supported observation, while duplicate class observations are ambiguous", () => {
  const traffic = queueWindow([queueRow(5), queueRow(0, "2026-11-08T03:59:00Z"), { ...queueRow(null, "2026-11-08T03:59:00+00:00"), vehicle_class: "truck" }]);
  assert.equal(queueObservation(traffic).value, 0);
  assert.equal(queueObservation(traffic).minute, "2026-11-08T03:59:00.000Z");
  traffic.rows[2].queue_count = 0;
  assert.equal(queueObservation(traffic).value, null);
  assert.equal(queueObservation(traffic).label, "Conflicting observations");
});

test("explicit backend observation status is authoritative and mode/window boundaries do not supply fallback queues", () => {
  const traffic = queueWindow([queueRow(4)]);
  traffic.queue_observation = { state: "unavailable", minute: "2026-11-08T03:59:00Z", reason: "Latest minute lacks reviewed queue evidence." };
  assert.equal(queueObservation(traffic).value, null);
  assert.equal(queueObservation(traffic).detail, "Latest minute lacks reviewed queue evidence.");
  traffic.queue_observation = { state: "observed", minute: "2026-11-08T03:59:00Z", reason: "Actual image observation." }; traffic.queue_count = 0;
  assert.equal(queueObservation(traffic).value, 0);
  delete traffic.queue_observation;
  traffic.rows = [{ ...queueRow(9), mode: "live" }, queueRow(9, traffic.to), queueRow(9, "2026-11-08T02:59:00Z")];
  assert.equal(queueObservation(traffic).value, null);
  assert.equal(queueObservation(queueWindow([])).value, null);
});
