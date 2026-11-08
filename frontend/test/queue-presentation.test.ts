import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueueQuantity } from "../src/components/ui.tsx";
import { queueObservation, queueScopeDescription, queueValueDescription } from "../src/lib/observation-presentation.ts";
import { queueWindow, queueRow } from "./fixtures/supported-window.ts";

test("positive queue readouts expose a visible and accessible lower bound under provisional image assumptions", () => {
  const html = renderToStaticMarkup(createElement(QueueQuantity, { value: 5 }));
  assert.match(html, /aria-label="At least 5 visible stopped vehicles"/);
  assert.match(html, /≥/);
  assert.match(html, />5</);
  assert.equal(queueValueDescription(5), "At least 5 visible stopped vehicles");
  assert.match(queueScopeDescription(5), /Lower bound on the physical queue/);
  assert.match(queueScopeDescription(5), /provisional image-area and motion assumptions/);
  assert.match(queueScopeDescription(5), /Unobserved or uncertain vehicles may add/);
});

test("a supported queue zero remains observed zero, while null and invalid values remain unknown", () => {
  const zero = renderToStaticMarkup(createElement(QueueQuantity, { value: 0 }));
  assert.match(zero, /0 observed visible stopped vehicles/);
  assert.doesNotMatch(zero, /≥|At least|No queue observation/);
  assert.match(queueScopeDescription(0), /Observed zero within the configured image area/);
  for (const value of [null, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
    const html = renderToStaticMarkup(createElement(QueueQuantity, { value }));
    assert.match(html, /class="q-null">No queue observation/);
    assert.doesNotMatch(html, /≥|At least|observed visible stopped vehicles/);
  }
  assert.match(queueScopeDescription(null), /unknown; no zero is inferred/);
});

test("a reported positive bound keeps its exact canonical minute and cannot substitute a missing or out-of-window time", () => {
  const traffic = queueWindow([queueRow(5)]);
  traffic.queue_count = 5;
  traffic.queue_observation = { state: "observed", minute: "2026-11-08T03:58:00+00:00", reason: "Provisional visible stopped-vehicle lower bound." };
  assert.equal(queueObservation(traffic).value, 5);
  assert.equal(queueObservation(traffic).minute, "2026-11-08T03:58:00+00:00");
  for (const minute of [null, "invalid", traffic.to, "2026-11-08T03:58:00.500Z"]) {
    traffic.queue_observation.minute = minute;
    const observation = queueObservation(traffic);
    assert.equal(observation.value, null);
    assert.equal(observation.label, "No queue observation");
    assert.match(observation.detail, /exact observation minute/);
  }
});
