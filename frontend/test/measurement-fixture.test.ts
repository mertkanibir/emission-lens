import assert from "node:assert/strict";
import test from "node:test";
import { parseMeasurementBatch } from "@emission-lens/contracts";
import { controlledMeasurement, controlledRegistry } from "./fixtures/measurement.ts";

test("the controlled route fixture uses the published envelope and synthetic-only approvals", () => {
  const input = controlledMeasurement();
  assert.equal(parseMeasurementBatch(input).mode, "synthetic");
  assert.equal(input.run.mode, "synthetic");
  const registry = controlledRegistry();
  for (const entry of [...registry.calibrations, ...registry.mappings]) {
    assert.deepEqual(entry.approval.modes, ["synthetic"]);
    assert.match(entry.approval.evidence_refs[0], /not-field-evidence/);
  }
  assert.equal("distance_m" in input.traversals[0], false);
  assert.equal("estimate_g" in input, false);
});
