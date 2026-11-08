import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { WorkerBatch } from "../../contracts/src/ingest.ts";
import { handleWorkerPost } from "../src/http.ts";
import { ingestWorkerBatch } from "../src/ingest.ts";
import { IngestError, readWorkerStore, withStoreLock } from "../src/persistence.ts";

function fixture(): WorkerBatch {
  const now = new Date();
  const runId = randomUUID();
  return {
    contract_version: "1.1", batch_id: randomUUID(), revision: 0,
    run: { run_id: runId, model_version: "synthetic-reliability-fixture", device: "synthetic", started_at: now.toISOString(), ended_at: null, mode: "synthetic" },
    statuses: [], emissions: [],
    traffic: [{
      camera_id: "222", minute: new Date(Math.floor(now.getTime() / 60_000) * 60_000).toISOString(),
      run_id: runId, vehicle_class: "car", mode: "synthetic", count: 4,
      completed_traversals: null, stopped_vehicle_seconds: null, traversal_time_s: null,
      distance_m: null, queue_count: null, queue_length_m: null, coverage: null,
    }],
  };
}

async function withStore(work: (path: string) => Promise<void> | void) {
  const previousPath = process.env.EMISSION_LENS_STORE_PATH;
  const previousToken = process.env.EMISSION_LENS_WORKER_TOKEN;
  const directory = mkdtempSync(join(tmpdir(), "emission-reliability-"));
  const path = join(directory, "worker.json");
  process.env.EMISSION_LENS_STORE_PATH = path;
  try {
    await work(path);
  } finally {
    if (previousPath === undefined) delete process.env.EMISSION_LENS_STORE_PATH; else process.env.EMISSION_LENS_STORE_PATH = previousPath;
    if (previousToken === undefined) delete process.env.EMISSION_LENS_WORKER_TOKEN; else process.env.EMISSION_LENS_WORKER_TOKEN = previousToken;
    rmSync(directory, { recursive: true, force: true });
  }
}

async function lockOwner(): Promise<ChildProcess> {
  const child = spawn(process.execPath, ["-e", "process.send('ready'); setInterval(() => {}, 1000)"], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  try {
    await Promise.race([
      once(child, "message"),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Lock-owner process did not start.")), 5000);
        timer.unref();
        child.once("message", () => clearTimeout(timer));
      }),
    ]);
    assert.equal(typeof child.pid, "number");
    return child;
  } catch (error) {
    child.kill("SIGKILL");
    throw error;
  }
}

async function stopOwner(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  await exited;
}

function independentCount(): number {
  const moduleUrl = new URL("../src/persistence.ts", import.meta.url).href;
  const code = `import { readWorkerStore } from ${JSON.stringify(moduleUrl)}; process.stdout.write(JSON.stringify(readWorkerStore().traffic[0].count));`;
  const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], { encoding: "utf8", timeout: 10_000 });
  assert.equal(child.status, 0, "Independent reader should load a complete valid snapshot.");
  return JSON.parse(child.stdout) as number;
}

test("an old lock owned by a live process stays intact; a confirmed crashed owner can be recovered", { timeout: 15_000 }, () => withStore(async (path) => {
  const batch = fixture();
  ingestWorkerBatch(batch);
  const before = readFileSync(path, "utf8");
  const owner = await lockOwner();
  const lock = `${path}.lock`;
  const lockContents = JSON.stringify({ pid: owner.pid });
  writeFileSync(lock, lockContents);
  const stale = new Date(Date.now() - 60_000);
  utimesSync(lock, stale, stale);
  try {
    assert.throws(() => ingestWorkerBatch({ ...batch, revision: 1 }), (error: unknown) => error instanceof IngestError && error.status === 503);
    assert.equal(readFileSync(path, "utf8"), before);
    assert.equal(readFileSync(lock, "utf8"), lockContents);
    assert.equal(independentCount(), 4, "Writer contention must not prevent committed reads.");
    await stopOwner(owner);
    assert.throws(() => process.kill(owner.pid!, 0), (error: unknown) => (error as NodeJS.ErrnoException).code === "ESRCH");
    const updated = structuredClone(batch);
    updated.revision = 1;
    updated.traffic[0].count = 7;
    ingestWorkerBatch(updated);
    assert.equal(independentCount(), 7);
    assert.equal(existsSync(lock), false);
  } finally {
    await stopOwner(owner);
  }
}));

test("an existing recovery claim is preserved and stale-lock reaping fails closed", { timeout: 15_000 }, () => withStore(async (path) => {
  const batch = fixture();
  ingestWorkerBatch(batch);
  const before = readFileSync(path, "utf8");
  const deadOwner = await lockOwner();
  await stopOwner(deadOwner);
  const lock = `${path}.lock`;
  const recovery = `${lock}.recovery`;
  const lockContents = JSON.stringify({ pid: deadOwner.pid });
  const recoveryContents = JSON.stringify({ pid: process.pid });
  writeFileSync(lock, lockContents);
  writeFileSync(recovery, recoveryContents);
  const stale = new Date(Date.now() - 60_000);
  utimesSync(lock, stale, stale);
  try {
    assert.throws(() => ingestWorkerBatch({ ...batch, revision: 1 }), (error: unknown) => error instanceof IngestError && error.status === 503);
    assert.equal(readFileSync(lock, "utf8"), lockContents);
    assert.equal(readFileSync(recovery, "utf8"), recoveryContents);
    assert.equal(readFileSync(path, "utf8"), before);
  } finally {
    // This test created and owns this recovery claim.
    rmSync(recovery);
  }
  ingestWorkerBatch({ ...batch, revision: 1 });
  assert.equal(existsSync(lock), false);
  assert.equal(existsSync(recovery), false);
}));

test("two stale-lock reapers cannot remove a newly acquired live writer lock", { timeout: 15_000 }, () => withStore(async (path) => {
  ingestWorkerBatch(fixture());
  const deadOwner = await lockOwner();
  await stopOwner(deadOwner);
  const lock = `${path}.lock`;
  writeFileSync(lock, JSON.stringify({ pid: deadOwner.pid }));
  const stale = new Date(Date.now() - 60_000);
  utimesSync(lock, stale, stale);
  const moduleUrl = new URL("../src/persistence.ts", import.meta.url).href;
  const marker = `${path}.writing`;
  const entered = `${path}.entered`;
  const checked = `${path}.checked`;
  const code = `
    import { withStoreLock } from ${JSON.stringify(moduleUrl)};
    import { existsSync, openSync, closeSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
    import { randomUUID } from 'node:crypto';
    const settings = JSON.parse(process.argv[1]);
    const waitUntil = (condition) => {
      const deadline = Date.now() + 5000;
      while (!condition()) {
        if (Date.now() >= deadline) throw new Error('Synthetic interleaving timed out.');
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
      }
    };
    if (settings.name === 'B') {
      const actualKill = process.kill.bind(process);
      const actualNow = Date.now.bind(Date);
      let paused = false;
      Date.now = () => {
        if (paused && existsSync(settings.entered) && existsSync(settings.path + '.lock')) {
          const owner = JSON.parse(readFileSync(settings.path + '.lock', 'utf8'));
          if (owner.pid === Number(readFileSync(settings.entered, 'utf8'))) {
            writeFileSync(settings.checked, 'rechecked new live-owner age');
          }
        }
        return actualNow();
      };
      process.kill = (pid, signal) => {
        if (pid === settings.deadPid && !paused) {
          paused = true;
          process.send('probing');
          waitUntil(() => existsSync(settings.entered));
        }
        return actualKill(pid, signal);
      };
    }
    try {
      withStoreLock(settings.path, (snapshot) => {
        const marker = openSync(settings.marker, 'wx');
        try {
          if (settings.name === 'A') {
            writeFileSync(settings.entered, String(process.pid));
            waitUntil(() => existsSync(settings.checked));
          }
          const template = structuredClone(snapshot.batches[0]);
          template.sequence = snapshot.next_sequence++;
          template.batch.batch_id = randomUUID();
          template.accepted_at = new Date().toISOString();
          snapshot.batches.push(template);
          return { snapshot, result: undefined };
        } finally {
          closeSync(marker);
          unlinkSync(settings.marker);
        }
      });
    } catch (error) { process.stderr.write(error.name + ': ' + error.message); process.exitCode = 1; }
  `;
  const startWriter = (name: string) => {
    const settings = JSON.stringify({ name, path, deadPid: deadOwner.pid, marker, entered, checked });
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code, settings], { stdio: ["ignore", "ignore", "pipe", "ipc"] });
    let errors = "";
    child.stderr?.on("data", (chunk) => { errors += chunk.toString(); });
    const done = once(child, "exit");
    return { child, done, errors: () => errors };
  };
  const secondReaper = startWriter("B");
  let firstReaper: ReturnType<typeof startWriter> | undefined;
  try {
    const [message] = await once(secondReaper.child, "message");
    assert.equal(message, "probing");
    firstReaper = startWriter("A");
    const exits = await Promise.all([firstReaper.done, secondReaper.done]);
    assert.deepEqual(exits.map(([code]) => code), [0, 0], `A: ${firstReaper.errors()}; B: ${secondReaper.errors()}`);
    assert.equal(existsSync(checked), true, "The second reaper must examine the new live owner.");
    assert.equal(readWorkerStore().batches.length, 3, "Both serialized updates must be retained.");
    assert.equal(existsSync(lock), false);
    assert.equal(existsSync(`${lock}.recovery`), false);
    assert.equal(existsSync(marker), false);
  } finally {
    await stopOwner(secondReaper.child);
    if (firstReaper) await stopOwner(firstReaper.child);
  }
}));

test("independent readers see the old committed snapshot until a complete atomic replacement", () => withStore((path) => {
  ingestWorkerBatch(fixture());
  assert.equal(independentCount(), 4);
  withStoreLock(path, (snapshot) => {
    snapshot.batches[0].batch.revision = 1;
    snapshot.batches[0].batch.traffic[0].count = 9;
    assert.equal(independentCount(), 4, "An in-progress update must not expose staged data.");
    return { snapshot, result: undefined };
  });
  assert.equal(independentCount(), 9);
}));

test("a failed store transaction preserves committed bytes and releases its own lock", () => withStore((path) => {
  ingestWorkerBatch(fixture());
  const before = readFileSync(path, "utf8");
  assert.throws(() => withStoreLock(path, () => { throw new Error("Synthetic transaction failure."); }), (error: unknown) => error instanceof IngestError && error.status === 503);
  assert.equal(readFileSync(path, "utf8"), before);
  assert.equal(existsSync(`${path}.lock`), false);
  assert.deepEqual(readdirSync(join(path, "..")).sort(), ["worker.json"]);
  assert.equal(independentCount(), 4);
}));

async function close(server: Server) {
  if (!server.listening) return;
  const closed = once(server, "close");
  server.close();
  server.closeAllConnections();
  await closed;
}

test("losing the HTTP acknowledgement after durable commit does not duplicate a retried batch", { timeout: 10_000 }, () => withStore(async () => {
  process.env.EMISSION_LENS_WORKER_TOKEN = "synthetic-reliability-token-with-at-least-32-characters";
  const batch = fixture();
  let dropAcknowledgement = true;
  const server = createServer(async (incoming, outgoing) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const request = new Request("http://localhost/api/worker", {
        method: "POST", headers: { authorization: incoming.headers.authorization ?? "", "content-type": incoming.headers["content-type"] ?? "" },
        body: Buffer.concat(chunks),
      });
      const response = await handleWorkerPost(request);
      if (dropAcknowledgement) {
        dropAcknowledgement = false;
        assert.equal(response.status, 202);
        outgoing.destroy(); // The batch is committed, but the client sees a network failure.
        return;
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      outgoing.end(await response.text());
    } catch {
      outgoing.destroy();
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/worker`;
  const options = {
    method: "POST", headers: { authorization: `Bearer ${process.env.EMISSION_LENS_WORKER_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(batch), signal: AbortSignal.timeout(3000),
  };
  try {
    await assert.rejects(fetch(endpoint, options));
    assert.equal(readWorkerStore().batches.length, 1);
    const retried = await fetch(endpoint, { ...options, signal: AbortSignal.timeout(3000) });
    assert.equal(retried.status, 200);
    assert.equal((await retried.json()).duplicate, true);
    assert.equal(readWorkerStore().batches.length, 1);
    assert.equal(readWorkerStore().traffic[0].count, 4);
  } finally {
    await close(server);
  }
}));
