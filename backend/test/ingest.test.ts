import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseWorkerBatch, type WorkerBatch } from "../../contracts/src/ingest.ts";
import { ingestWorkerBatch, IngestError, readWorkerStore } from "../src/ingest.ts";
import { statusesFor, trafficFor } from "../src/store.ts";

const NOW = new Date("2026-11-07T23:00:40.000Z");

function fixture(mode: WorkerBatch["run"]["mode"] = "live"): WorkerBatch {
  return {
    contract_version: "1.1", batch_id: randomUUID(), revision: 0,
    run: { run_id: "test-run", model_version: "test-model", device: "test-device", started_at: "2026-11-07T23:00:00Z", ended_at: null, mode },
    statuses: [{ camera_id: "222", heartbeat_at: "2026-11-07T23:00:30Z", last_source_timestamp: null, processing_delay_ms: null, fps: 5, state: "live", mode }],
    traffic: [{ camera_id: "222", minute: "2026-11-07T23:00:00Z", run_id: "test-run", vehicle_class: "car", mode, count: 4, completed_traversals: null, stopped_vehicle_seconds: null, traversal_time_s: null, distance_m: null, queue_count: null, queue_length_m: null, coverage: null }],
    emissions: [{ camera_id: "222", minute: "2026-11-07T23:00:00Z", mode, pollutant: "co2", estimate_g: null, range_low_g: null, range_high_g: null, factor_version: null, method_version: null, quality_state: "calibration_invalid" }],
  };
}

function withStore(work: (path: string) => void): void {
  const previous = process.env.EMISSION_LENS_STORE_PATH;
  const directory = mkdtempSync(join(tmpdir(), "emission-ingest-"));
  const path = join(directory, "worker.json");
  process.env.EMISSION_LENS_STORE_PATH = path;
  try { work(path); } finally {
    if (previous === undefined) delete process.env.EMISSION_LENS_STORE_PATH;
    else process.env.EMISSION_LENS_STORE_PATH = previous;
    rmSync(directory, { recursive: true, force: true });
  }
}

function status(code: number) {
  return (error: unknown): boolean => error instanceof IngestError && error.status === code;
}

test("worker records persist across independent reads and retries do not add counts", () => withStore((path) => {
  const batch = fixture();
  assert.equal(ingestWorkerBatch(batch, NOW).duplicate, false);
  assert.equal(ingestWorkerBatch(JSON.parse(JSON.stringify(batch)), NOW).duplicate, true);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).batches.length, 1);
  assert.equal(readWorkerStore().traffic[0].count, 4);
  assert.equal(trafficFor("live")[0].count, 4);
  assert.equal(statusesFor("live").find((row) => row.camera_id === "222")!.state, "live");
  assert.equal(statusesFor("live").find((row) => row.camera_id === "223")!.state, "offline");
}));

test("revisions replace their batch atomically; changed same or older revisions conflict", () => withStore(() => {
  const batch = fixture();
  ingestWorkerBatch(batch, NOW);
  batch.traffic[0].count = 7;
  assert.throws(() => ingestWorkerBatch(batch, NOW), status(409));
  assert.equal(readWorkerStore().traffic[0].count, 4);
  batch.revision = 1;
  ingestWorkerBatch(batch, NOW);
  assert.equal(readWorkerStore().traffic[0].count, 7);
  batch.revision = 0;
  assert.throws(() => ingestWorkerBatch(batch, NOW), status(409));
}));

test("newer heartbeat and cumulative minute snapshots survive delayed old batches", () => withStore(() => {
  const newer = fixture();
  newer.statuses[0].heartbeat_at = "2026-11-07T23:00:35Z";
  newer.traffic[0].count = 9;
  ingestWorkerBatch(newer, NOW);
  const older = fixture();
  ingestWorkerBatch(older, NOW);
  assert.equal(readWorkerStore().statuses[0].heartbeat_at, newer.statuses[0].heartbeat_at);
  assert.equal(readWorkerStore().traffic[0].count, 9);
}));

test("run provenance is immutable and ended runs cannot be resurrected", () => withStore(() => {
  const initial = fixture();
  ingestWorkerBatch(initial, NOW);
  const changed = fixture();
  changed.run.model_version = "different-model";
  assert.throws(() => ingestWorkerBatch(changed, NOW), status(409));
  const ended = fixture();
  ended.run.ended_at = "2026-11-07T23:00:36Z";
  ended.statuses[0].heartbeat_at = ended.run.ended_at;
  ended.statuses[0].state = "offline";
  ingestWorkerBatch(ended, NOW);
  assert.throws(() => ingestWorkerBatch(fixture(), NOW), status(409));
  assert.equal(readWorkerStore().statuses[0].state, "offline");
  assert.equal(readWorkerStore().runs[0].ended_at, ended.run.ended_at);
}));

test("different runs cannot silently overwrite an overlapping camera-minute class", () => withStore(() => {
  ingestWorkerBatch(fixture(), NOW);
  const another = fixture();
  another.run.run_id = "other-run";
  another.traffic[0].run_id = "other-run";
  assert.throws(() => ingestWorkerBatch(another, NOW), status(409));
  assert.equal(readWorkerStore().traffic[0].run_id, "test-run");
}));

test("device provenance may become known after warmup but cannot then change or disappear", () => withStore(() => {
  const initial = fixture();
  initial.run.device = null;
  ingestWorkerBatch(initial, NOW);
  ingestWorkerBatch(fixture(), NOW);
  assert.equal(readWorkerStore().runs[0].device, "test-device");
  const missing = fixture();
  missing.run.device = null;
  assert.throws(() => ingestWorkerBatch(missing, NOW), status(409));
  const changed = fixture();
  changed.run.device = "other-device";
  assert.throws(() => ingestWorkerBatch(changed, NOW), status(409));
}));

test("live, replay, and the synthetic fixture stay separate", () => withStore(() => {
  const replay = fixture("replay");
  ingestWorkerBatch(replay, NOW);
  assert.equal(trafficFor("live").length, 0);
  assert.equal(trafficFor("replay")[0].count, 4);
  assert.equal(trafficFor("synthetic")[0].count, 20);
  const synthetic = fixture("synthetic");
  synthetic.run.run_id = "synthetic-write";
  synthetic.traffic[0].run_id = synthetic.run.run_id;
  ingestWorkerBatch(synthetic, NOW);
  assert.equal(trafficFor("synthetic")[0].count, 20);
  assert.equal(trafficFor("live").length, 0);
}));

test("invalid batches never leave partial updates", () => withStore((path) => {
  const batch = fixture();
  ingestWorkerBatch(batch, NOW);
  const before = readFileSync(path, "utf8");
  const invalid = fixture();
  invalid.statuses[0].camera_id = "223";
  invalid.traffic[0].count = Number.NaN;
  assert.throws(() => ingestWorkerBatch(invalid, NOW), status(400));
  assert.equal(readFileSync(path, "utf8"), before);
}));

test("wire parser rejects malformed enums, UTC dates, negative/fractional/non-finite values and extra fields", () => {
  const cases: Array<(batch: WorkerBatch) => void> = [
    (batch) => { batch.traffic[0].count = Number.POSITIVE_INFINITY; },
    (batch) => { batch.traffic[0].count = -1; },
    (batch) => { batch.traffic[0].count = 1.2; },
    (batch) => { batch.statuses[0].fps = Number.NaN; },
    (batch) => { batch.statuses[0].camera_id = "not-a-camera"; },
    (batch) => { batch.statuses[0].heartbeat_at = "2026-11-07T18:00:00-05:00"; },
    (batch) => { batch.statuses[0].heartbeat_at = "2026-02-31T23:00:00Z"; },
    (batch) => { batch.statuses[0].last_source_timestamp = "2026-11-07T23:00:31Z"; },
    (batch) => { batch.traffic[0].minute = "2026-11-07T23:00:01Z"; },
    (batch) => { batch.traffic[0].minute = "2026-11-07T23:00:00.000001Z"; },
    (batch) => { batch.traffic[0].vehicle_class = "person" as never; },
    (batch) => { batch.traffic[0].mode = "replay"; },
    (batch) => { batch.traffic[0].run_id = "unrelated-run"; },
    (batch) => { Object.assign(batch, { raw_frame: "not permitted" }); },
    (batch) => { delete (batch.statuses[0] as Partial<typeof batch.statuses[0]>).fps; },
    (batch) => { batch.traffic.push({ ...batch.traffic[0], minute: "2026-11-07T23:00:00+00:00" }); },
  ];
  for (const mutate of cases) {
    const batch = fixture();
    mutate(batch);
    assert.throws(() => parseWorkerBatch(batch));
  }
  assert.equal(parseWorkerBatch(fixture()).statuses[0].last_source_timestamp, null);
});

test("unavailable/calibration-invalid emissions cannot carry zero, ranges, or unsupported estimates", () => {
  for (const quality of ["unavailable", "insufficient_evidence", "calibration_invalid"] as const) {
    const batch = fixture();
    batch.emissions[0].quality_state = quality;
    batch.emissions[0].range_high_g = 0;
    assert.throws(() => parseWorkerBatch(batch));
    batch.emissions[0].range_high_g = null;
    batch.emissions[0].estimate_g = 0;
    assert.throws(() => parseWorkerBatch(batch));
  }
  const numeric = fixture();
  Object.assign(numeric.emissions[0], { quality_state: "ok", estimate_g: 1, factor_version: "factor", method_version: "method" });
  assert.throws(() => parseWorkerBatch(numeric), /calibration/);
  numeric.emissions = [];
  numeric.traffic[0].distance_m = 100;
  assert.throws(() => parseWorkerBatch(numeric), /calibration/);
});

test("unconfigured or corrupt persistence fails closed", () => {
  const previous = process.env.EMISSION_LENS_STORE_PATH;
  delete process.env.EMISSION_LENS_STORE_PATH;
  try { assert.throws(() => ingestWorkerBatch(fixture(), NOW), status(503)); }
  finally { if (previous !== undefined) process.env.EMISSION_LENS_STORE_PATH = previous; }
  withStore((path) => {
    writeFileSync(path, "not-json");
    assert.throws(() => readWorkerStore(), status(503));
    assert.throws(() => ingestWorkerBatch(fixture(), NOW), status(503));
    assert.equal(readFileSync(path, "utf8"), "not-json");
  });
});

test("future and expired batches are rejected without persistence", () => withStore(() => {
  assert.throws(() => ingestWorkerBatch(fixture(), new Date("2026-11-07T22:00:00Z")), status(400));
  assert.throws(() => ingestWorkerBatch(fixture(), new Date("2026-11-09T23:00:00Z")), status(400));
  assert.equal(readWorkerStore().batches.length, 0);
}));

test("read cache invalidates on atomic commits and external corruption, and views cannot mutate evidence", () => withStore((path) => {
  ingestWorkerBatch(fixture(), NOW);
  const first = readWorkerStore();
  assert.equal(readWorkerStore(), first);
  assert.throws(() => { first.traffic[0].count = 999; }, TypeError);
  const update = fixture();
  update.statuses[0].heartbeat_at = "2026-11-07T23:00:35Z";
  update.traffic[0].count = 8;
  ingestWorkerBatch(update, NOW);
  assert.notEqual(readWorkerStore(), first);
  assert.equal(readWorkerStore().traffic[0].count, 8);
  writeFileSync(path, "corrupt after a cached read");
  assert.throws(() => readWorkerStore(), status(503));
}));
