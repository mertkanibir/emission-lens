import assert from "node:assert/strict";
import test from "node:test";
import { presentPollutantComparison, signedScenarioValue } from "../src/lib/scenario-presentation.ts";

const row = () => ({
  pollutant: "co2" as const,
  baseline: 100,
  scenario: 120,
  changeGrams: 20,
  changePercent: 20,
});

test("signed increases and decreases are displayed without clamping to savings", () => {
  assert.equal(presentPollutantComparison(row()).changeGrams, 20);
  assert.equal(signedScenarioValue(20, "g"), "+20 g");
  assert.equal(signedScenarioValue(-20, "g"), "−20 g");
  assert.equal(signedScenarioValue(-12.5, "%"), "−12.5%");
});

test("one unavailable side withholds both changes, without hiding the supported baseline", () => {
  const result = presentPollutantComparison({ ...row(), scenario: null });
  assert.equal(result.baseline, 100);
  assert.equal(result.scenario, null);
  assert.equal(result.changeGrams, null);
  assert.equal(result.changePercent, null);
});

test("supported zero remains a value and baseline zero never receives a percent", () => {
  const result = presentPollutantComparison({ ...row(), baseline: 0, scenario: 0, changeGrams: 0, changePercent: 0 });
  assert.equal(result.baseline, 0);
  assert.equal(result.scenario, 0);
  assert.equal(result.changeGrams, 0);
  assert.equal(result.changePercent, null);
  assert.equal(signedScenarioValue(0, "g"), "0 g");
  assert.equal(signedScenarioValue(null, "%"), "Unavailable");
});

test("CO2 support does not fill missing NOx and small NOx totals retain precision", () => {
  assert.equal(presentPollutantComparison(row()).label, "Estimated CO₂");
  const nox = presentPollutantComparison({ ...row(), pollutant: "nox", baseline: null, scenario: null });
  assert.equal(nox.label, "Estimated NOₓ");
  assert.equal(nox.changeGrams, null);
  assert.equal(signedScenarioValue(0.000125, "g"), "+0.000125 g");
  assert.equal(signedScenarioValue(0.0000001, "g"), "+1E-7 g");
});

test("nonfinite values fail closed and no change is calculated from two totals", () => {
  const result = presentPollutantComparison({ ...row(), scenario: Infinity });
  assert.equal(result.scenario, null);
  assert.equal(result.changeGrams, null);
  assert.equal(signedScenarioValue(NaN, "g"), "Unavailable");
  const missingChange = presentPollutantComparison({ ...row(), changeGrams: null });
  assert.equal(missingChange.changeGrams, null);
  assert.equal(missingChange.changePercent, null);
});
