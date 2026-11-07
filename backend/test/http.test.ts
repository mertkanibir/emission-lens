import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { handleWorkerPost } from "../src/http.ts";
import { displayedState } from "../src/queries.ts";
import { readWorkerStore } from "../src/persistence.ts";

const TOKEN = "test-only-worker-token-with-more-than-32-characters";

test("authenticated HTTP ingestion persists once; invalid and unauthorized requests leave history intact", async () => {
  const root = mkdtempSync(join(tmpdir(), "emission-http-"));
  const priorPath = process.env.EMISSION_LENS_STORE_PATH;
  const priorToken = process.env.EMISSION_LENS_WORKER_TOKEN;
  process.env.EMISSION_LENS_STORE_PATH = join(root, "store.json");
  process.env.EMISSION_LENS_WORKER_TOKEN = TOKEN;
  const now = new Date().toISOString();
  const batch = {
    contract_version: "1.1", batch_id: randomUUID(), revision: 0,
    run: { run_id: randomUUID(), model_version: "test-only", device: "cpu", started_at: now, ended_at: null, mode: "live" },
    statuses: [{ camera_id: "222", heartbeat_at: now, last_source_timestamp: null, processing_delay_ms: null, fps: 5, state: "live", mode: "live" }],
    traffic: [], emissions: [],
  };
  const request = (body: string, auth = TOKEN, contentType = "application/json") => new Request("http://localhost/api/worker", {
    method: "POST", headers: { authorization: `Bearer ${auth}`, "content-type": contentType }, body,
  });
  try {
    assert.equal((await handleWorkerPost(request(JSON.stringify(batch), "wrong"))).status, 401);
    assert.equal(readWorkerStore().batches.length, 0);
    assert.equal((await handleWorkerPost(request("{}", TOKEN, "text/plain"))).status, 415);
    assert.equal((await handleWorkerPost(request("{"))).status, 400);
    const accepted = await handleWorkerPost(request(JSON.stringify(batch)));
    assert.equal(accepted.status, 202);
    assert.equal(accepted.headers.get("cache-control"), "no-store");
    assert.equal((await accepted.json()).duplicate, false);
    assert.equal((await handleWorkerPost(request(JSON.stringify(batch)))).status, 200);
    assert.equal(readWorkerStore().batches.length, 1);
    assert.equal(readWorkerStore().statuses[0].last_source_timestamp, null);
    const changed = structuredClone(batch); changed.statuses[0].fps = 1;
    assert.equal((await handleWorkerPost(request(JSON.stringify(changed)))).status, 409);
    assert.equal(readWorkerStore().statuses[0].fps, 5);
    assert.equal((await handleWorkerPost(request(" ".repeat(1_048_577)))).status, 413);
    assert.equal(readWorkerStore().batches.length, 1);
    delete process.env.EMISSION_LENS_WORKER_TOKEN;
    assert.equal((await handleWorkerPost(request(JSON.stringify(batch)))).status, 503);
  } finally {
    if (priorPath === undefined) delete process.env.EMISSION_LENS_STORE_PATH; else process.env.EMISSION_LENS_STORE_PATH = priorPath;
    if (priorToken === undefined) delete process.env.EMISSION_LENS_WORKER_TOKEN; else process.env.EMISSION_LENS_WORKER_TOKEN = priorToken;
    rmSync(root, { recursive: true, force: true });
  }
});

test("processing freshness is independent of unavailable capture UTC and ages safely", () => {
  const status = { camera_id: "222", heartbeat_at: "2026-11-07T23:00:00Z", last_source_timestamp: null, processing_delay_ms: null, fps: 5, state: "live" as const, mode: "live" as const };
  assert.equal(displayedState(status, "2026-11-07T23:00:10Z"), "live");
  assert.equal(displayedState(status, "2026-11-07T23:03:00Z"), "degraded");
  assert.equal(displayedState(status, "2026-11-07T22:50:00Z"), "degraded");
  assert.equal(displayedState({ ...status, state: "offline" }, "2026-11-07T23:00:10Z"), "offline");
});
