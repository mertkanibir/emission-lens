import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { latestCompleteScenarioMinute } from "../src/lib/scenario-window.ts";
import { ScenarioWindowControls } from "../src/components/ScenarioWindowControls.tsx";
import { supportedWindow } from "./fixtures/supported-window.ts";

test("the offered scenario minute has finished and never substitutes an in-progress estimate", () => {
  const window = supportedWindow();
  const current = structuredClone(window.minutes[0]); current.minute = "2026-11-08T03:59:00Z";
  for (const row of current.emissions) { row.minute = current.minute; row.estimate_g = 0; }
  window.minutes.push(current);
  const before = structuredClone(window);
  assert.deepEqual(latestCompleteScenarioMinute(window, "2026-11-08T03:59:30Z"), { from: "2026-11-08T03:58:00.000Z", to: "2026-11-08T03:59:00.000Z" });
  assert.deepEqual(latestCompleteScenarioMinute(window, "2026-11-08T04:00:00+00:00"), { from: "2026-11-08T03:59:00.000Z", to: "2026-11-08T04:00:00.000Z" });
  assert.deepEqual(window, before);
  window.to = "2026-11-08T03:59:30Z";
  assert.deepEqual(latestCompleteScenarioMinute(window, "2026-11-08T04:00:00Z"), { from: "2026-11-08T03:58:00.000Z", to: "2026-11-08T03:59:00.000Z" });
});

test("missing, unapproved, synthetic, invalid-clock and incomplete-only windows offer no scenario minute", () => {
  const changes: Array<(window: ReturnType<typeof supportedWindow>) => void> = [
    (w) => { w.minutes = []; },
    (w) => { w.registry.physical_calibration_approved = false; },
    (w) => { w.mode = "synthetic"; },
    (w) => { w.to = "2026-11-08T03:58:30Z"; },
    (w) => { w.minutes[0].state = "unavailable"; },
  ];
  for (const change of changes) { const window = supportedWindow(); change(window); assert.equal(latestCompleteScenarioMinute(window, "2026-11-08T03:58:30Z"), null); }
  assert.equal(latestCompleteScenarioMinute(supportedWindow(), "invalid"), null);
});

test("scenario window links preserve camera, mode, reduction and exact minute bounds while the hour resets selection", () => {
  const candidate = { from: "2026-11-08T03:58:00.000Z", to: "2026-11-08T03:59:00.000Z" };
  const html = renderToStaticMarkup(createElement(ScenarioWindowControls, {
    cameraId: "222", mode: "replay", reduction: 100, ...candidate, explicit: true, candidate, error: null,
  }));
  assert.match(html, /Selected window/);
  assert.match(html, /Camera 222 · Replay/);
  assert.match(html, /Every included minute must be supported; gaps stay unavailable/);
  assert.match(html, /reporting-hour totals and brief retain their own scope/);
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1].replaceAll("&amp;", "&"), "http://localhost"));
  assert.equal(links.length, 2);
  for (const link of links) { assert.equal(link.pathname, "/cameras/222"); assert.equal(link.searchParams.get("mode"), "replay"); assert.equal(link.searchParams.get("reduce"), "100"); assert.equal(link.hash, "#scenario"); }
  assert.equal(links[0].searchParams.has("from"), false);
  assert.equal(links[0].searchParams.has("to"), false);
  assert.equal(links[1].searchParams.get("from"), candidate.from);
  assert.equal(links[1].searchParams.get("to"), candidate.to);
  assert.match(html, /aria-current="true"[^>]*>Use latest complete supported minute/);
});

test("an invalid selection and a missing complete minute remain explicit without a fabricated option", () => {
  const html = renderToStaticMarkup(createElement(ScenarioWindowControls, {
    cameraId: "228", mode: "live", reduction: 20, from: "2026-11-08T03:00:00Z", to: "2026-11-08T04:00:00Z", explicit: false, candidate: null,
    error: "Both UTC minute boundaries are required.",
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Selected window could not be used/);
  assert.match(html, /Showing the reporting-hour comparison below/);
  assert.match(html, /No complete supported minute is available/);
  assert.doesNotMatch(html, /Use latest complete supported minute|from=/);
});

test("embedded workspace selection preserves the selected camera and interval through native navigation", () => {
  const candidate = { from: "2026-11-08T03:58:00.000Z", to: "2026-11-08T03:59:00.000Z" };
  const html = renderToStaticMarkup(createElement(ScenarioWindowControls, { workspace: true, cameraId: "223", mode: "replay", reduction: 20, ...candidate, explicit: true, candidate, error: null }));
  const links = [...html.matchAll(/href="([^"]+)"/g)].map((match) => new URL(match[1].replaceAll("&amp;", "&"), "http://localhost"));
  assert.equal(links.length, 2);
  for (const link of links) { assert.equal(link.pathname, "/"); assert.equal(link.searchParams.get("camera"), "223"); assert.equal(link.searchParams.get("mode"), "replay"); assert.equal(link.hash, "#scenario"); }
  assert.equal(links[0].searchParams.has("from"), false);
  assert.equal(links[1].searchParams.get("from"), candidate.from);
  assert.equal(links[1].searchParams.get("to"), candidate.to);
});
