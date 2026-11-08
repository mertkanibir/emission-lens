import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { calibrationFor } from "../../contracts/src/cameras.ts";
import type { WorkerBatch } from "../../contracts/src/ingest.ts";
import { draft_brief, rank_investigation_priorities } from "../src/brief.ts";
import { ingestWorkerBatch } from "../src/ingest.ts";
import { get_emissions_window } from "../src/queries.ts";
import { loadRegistry, registryStatus, type RegistryDocument } from "../src/registry.ts";

const NOW = new Date("2026-11-08T05:36:00Z");
const input = { cameraId: "222", mode: "replay" as const, now: NOW };

// Private software fixtures only: these never activate a camera or supply grams.
function registry(): RegistryDocument {
  return {
    registry_version: "1.0", revision: "brief-availability-test-only",
    calibrations: [{
      camera_id: "222", version: "test-only-calibration",
      approval: { status: "approved", reviewed_by: "Mert", reviewed_at: "2026-11-07T19:00:00Z",
        evidence_refs: ["software-fixture-not-physical-validation"], modes: ["replay"] },
      valid_from: "2026-11-07T19:00:00Z", valid_to: null,
      calibration: { camera_id: "222", version: "test-only-calibration", validation_status: "valid",
        gates: { entry: { fixture: true }, exit: { fixture: true } },
        reference_measurements: { source: "software-fixture-only" },
        transform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
      movements: [{ movement_id: "test-only-movement", entry_gate_id: "entry", exit_gate_id: "exit",
        distance_m: 1, distance_units: "m", evidence_refs: ["software-fixture-only"] }],
    }],
    mappings: [],
  };
}

function isolated(document: unknown, work: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "brief-availability-"));
  const keys = ["EMISSION_LENS_STORE_PATH", "EMISSION_LENS_REGISTRY_PATH"] as const;
  const previous = keys.map(key => process.env[key]);
  const path = join(directory, "store.json");
  process.env.EMISSION_LENS_STORE_PATH = path;
  if (document === null) delete process.env.EMISSION_LENS_REGISTRY_PATH;
  else {
    process.env.EMISSION_LENS_REGISTRY_PATH = join(directory, "registry.json");
    writeFileSync(process.env.EMISSION_LENS_REGISTRY_PATH, JSON.stringify(document));
  }
  try { work(path); }
  finally {
    keys.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
    rmSync(directory, { recursive: true, force: true });
  }
}

function observation(minute: string, quality: "insufficient_evidence" | "calibration_invalid" = "insufficient_evidence"): WorkerBatch {
  const run_id = randomUUID();
  return {
    contract_version: "1.1", batch_id: randomUUID(), revision: 0,
    run: { run_id, model_version: "availability-fixture", device: "no-inference",
      started_at: minute, ended_at: new Date(Date.parse(minute) + 30_000).toISOString(), mode: "replay" },
    statuses: [],
    traffic: [{ camera_id: "222", minute, run_id, vehicle_class: "car", mode: "replay", count: 4,
      completed_traversals: null, stopped_vehicle_seconds: null, traversal_time_s: null,
      distance_m: null, queue_count: null, queue_length_m: null, coverage: null }],
    emissions: [{ camera_id: "222", minute, pollutant: "co2", mode: "replay", estimate_g: null,
      range_low_g: null, range_high_g: null, factor_version: null, method_version: null, quality_state: quality }],
  };
}

test("aged-out replay records with current registry approval explain missing evidence, not invalid calibration", () => {
  isolated(registry(), path => {
    assert.equal(calibrationFor("222").validation_status, "missing");
    ingestWorkerBatch(observation("2026-11-08T03:58:00Z"), NOW);
    const original = readFileSync(path);
    assert.equal(registryStatus(loadRegistry(), "222", "replay", NOW).physical_calibration_approved, true);
    const emissions = get_emissions_window(input);
    assert.equal(emissions.rows.length, 0);
    assert.equal(emissions.quality_state, "unavailable");
    assert.deepEqual(emissions.estimate_g_by_pollutant, { co2: null, nox: null });
    assert.match(emissions.note, /No estimated-emissions records.*reporting window/);
    assert.match(emissions.note, /Camera calibration is approved for this mode and time/);
    const brief = draft_brief(input);
    assert.doesNotMatch(brief.text, /calibration is not valid|Validate camera calibration/);
    assert.match(brief.text, /Crossings: unavailable/);
    assert.match(brief.text, /Estimated CO2: unavailable; this is not zero/);
    assert.match(brief.text, /Estimated NOx: unavailable; this is not zero/);
    const ranking = rank_investigation_priorities(input);
    assert.match(ranking.dimensions.find(row => row.dimension === "emissions")!.suggested_step, /Collect completed traversals in this reporting window/);
    assert.equal(ranking.score, null);
    assert.deepEqual(readFileSync(path), original);
  });
});

for (const condition of ["pending", "expired", "future", "other-mode", "ambiguous", "invalid", "missing"] as const) {
  test(`empty replay window does not infer approval from ${condition} registry scope`, () => {
    const document = registry();
    if (condition === "pending") document.calibrations[0].approval.status = "pending";
    if (condition === "expired") document.calibrations[0].valid_to = NOW.toISOString();
    if (condition === "future") document.calibrations[0].valid_from = "2026-11-08T05:36:01Z";
    if (condition === "other-mode") document.calibrations[0].approval.modes = ["live"];
    if (condition === "ambiguous") {
      const second = structuredClone(document.calibrations[0]);
      second.version = second.calibration.version = "another-test-only-calibration";
      document.calibrations.push(second);
    }
    isolated(condition === "invalid" ? {} : condition === "missing" ? null : document, () => {
      const emissions = get_emissions_window(input);
      assert.equal(emissions.quality_state, "unavailable");
      assert.deepEqual(emissions.estimate_g_by_pollutant, { co2: null, nox: null });
      assert.doesNotMatch(emissions.note, /Camera calibration is approved/);
      assert.match(emissions.note, condition === "invalid" ? /registry is invalid/ : /No unique server-approved camera calibration applies/);
      assert.match(rank_investigation_priorities(input).dimensions.find(row => row.dimension === "emissions")!.suggested_step, /Validate camera calibration/);
    });
  });
}

test("empty-window approval uses the requested clock rather than current wall time", () => {
  const document = registry();
  document.calibrations[0].valid_to = "2026-11-08T05:36:01Z";
  isolated(document, () => {
    assert.match(get_emissions_window(input).note, /Camera calibration is approved for this mode and time/);
    const expired = get_emissions_window({ ...input, now: new Date("2026-11-08T05:36:01Z") });
    assert.doesNotMatch(expired.note, /Camera calibration is approved/);
    assert.deepEqual(expired.estimate_g_by_pollutant, { co2: null, nox: null });
  });
});

test("registry approval does not override an in-window calibration-invalid observation", () => {
  isolated(registry(), () => {
    ingestWorkerBatch(observation("2026-11-08T05:35:00Z", "calibration_invalid"), NOW);
    const emissions = get_emissions_window(input);
    assert.equal(emissions.quality_state, "calibration_invalid");
    assert.match(emissions.note, /Camera calibration is not valid/);
    assert.deepEqual(emissions.estimate_g_by_pollutant, { co2: null, nox: null });
  });
});
