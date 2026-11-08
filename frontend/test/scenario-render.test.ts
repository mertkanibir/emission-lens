import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ScenarioPollutants } from "../src/components/ScenarioPollutants.tsx";

test("comparison renders independently labeled pollutants and keeps signed increases visible", () => {
  const html = renderToStaticMarkup(createElement(ScenarioPollutants, { rows: [
    { pollutant: "co2", baseline: 100, scenario: 120, changeGrams: 20, changePercent: 20 },
    { pollutant: "nox", baseline: 0, scenario: 0, changeGrams: 0, changePercent: null },
  ] }));
  assert.match(html, /aria-label="Hypothetical emissions comparison"/);
  assert.match(html, /scope="row">Estimated CO₂/);
  assert.match(html, /scope="row">Estimated NOₓ/);
  assert.match(html, /\+20 g/);
  assert.match(html, /\+20%/);
  assert.match(html, /0 g/);
  assert.match(html, /Percent change is undefined when the baseline is zero/);
  assert.match(html, /positive value is an increase/);
});

test("a missing pollutant never borrows another pollutant's totals or changes", () => {
  const html = renderToStaticMarkup(createElement(ScenarioPollutants, { rows: [
    { pollutant: "co2", baseline: 1, scenario: 0.9, changeGrams: -0.1, changePercent: -10 },
    { pollutant: "nox", baseline: null, scenario: null, changeGrams: 9, changePercent: 90 },
  ] }));
  const nox = html.slice(html.indexOf('scope="row">Estimated NOₓ'));
  assert.equal((nox.match(/class="q-null">Unavailable/g) ?? []).length, 4);
  assert.doesNotMatch(nox, /\+9 g|\+90%/);
  assert.match(html, /−0.1 g/);
  assert.match(html, /−10%/);
});
