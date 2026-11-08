import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { parseWorkerBatch, type WorkerBatch } from "../../contracts/src/ingest.ts";
import type { CameraStatus, EmissionsMinute, TrafficMinute, WorkerRun } from "@emission-lens/contracts";

export const MAX_STORED_BATCHES = 5000;
export const STORE_RETENTION_MS = 24 * 60 * 60 * 1000;
export const MAX_STORE_BYTES = 32 * 1024 * 1024;

export class IngestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "IngestError";
  }
}

export interface StoredBatch {
  sequence: number;
  accepted_at: string;
  batch: WorkerBatch;
}

export interface WorkerSnapshot {
  schema_version: 1;
  next_sequence: number;
  batches: StoredBatch[];
}

export interface WorkerStore {
  runs: WorkerRun[];
  statuses: CameraStatus[];
  traffic: TrafficMinute[];
  emissions: EmissionsMinute[];
  batches: Array<{ batch_id: string; revision: number; accepted_at: string }>;
}

export function storePath(): string | null {
  const path = process.env.EMISSION_LENS_STORE_PATH;
  if (!path) return null;
  if (!isAbsolute(path)) throw new IngestError("EMISSION_LENS_STORE_PATH must be an absolute path.", 503);
  return path;
}

const empty = (): WorkerSnapshot => ({ schema_version: 1, next_sequence: 0, batches: [] });

/** A corrupt or unreadable configured store fails closed rather than inventing empty history. */
export function readSnapshot(path: string): WorkerSnapshot {
  if (!existsSync(/* turbopackIgnore: true */ path)) return empty();
  try {
    if (statSync(/* turbopackIgnore: true */ path).size > MAX_STORE_BYTES) throw new Error("Snapshot exceeds the local storage limit.");
    const raw = JSON.parse(readFileSync(/* turbopackIgnore: true */ path, "utf8")) as WorkerSnapshot;
    if (raw.schema_version !== 1 || !Number.isSafeInteger(raw.next_sequence) || raw.next_sequence < 0 || !Array.isArray(raw.batches) || raw.batches.length > MAX_STORED_BATCHES) throw new Error("Invalid snapshot.");
    const sequences = new Set<number>();
    const ids = new Set<string>();
    for (const item of raw.batches) {
      if (!Number.isSafeInteger(item.sequence) || item.sequence < 0 || item.sequence >= raw.next_sequence || sequences.has(item.sequence) || !Number.isFinite(Date.parse(item.accepted_at))) throw new Error("Invalid batch ledger.");
      item.batch = parseWorkerBatch(item.batch);
      if (ids.has(item.batch.batch_id)) throw new Error("Duplicate batch receipt.");
      sequences.add(item.sequence);
      ids.add(item.batch.batch_id);
    }
    return raw;
  } catch {
    throw new IngestError("The worker store cannot be read or validated. Preserve it for recovery.", 503);
  }
}

export function trafficKey(row: TrafficMinute): string {
  return `${row.mode}|${row.camera_id}|${Date.parse(row.minute)}|${row.vehicle_class}`;
}

function emissionsKey(row: EmissionsMinute): string {
  return `${row.mode}|${row.camera_id}|${Date.parse(row.minute)}|${row.pollutant}`;
}

/** Newer processing heartbeats win even if an older network retry arrives later. */
export function materialize(snapshot: WorkerSnapshot): WorkerStore {
  const runs = new Map<string, WorkerRun>();
  const statuses = new Map<string, { value: CameraStatus; time: number }>();
  const traffic = new Map<string, { value: TrafficMinute; time: number }>();
  const emissions = new Map<string, { value: EmissionsMinute; time: number }>();
  for (const { batch } of [...snapshot.batches].sort((a, b) => a.sequence - b.sequence)) {
    const prior = runs.get(batch.run.run_id);
    runs.set(batch.run.run_id, { ...batch.run, ended_at: batch.run.ended_at ?? prior?.ended_at ?? null });
    const eventTime = Math.max(...[batch.run.started_at, batch.run.ended_at, ...batch.statuses.map((row) => row.heartbeat_at)].filter((value): value is string => value !== null).map(Date.parse), 0);
    for (const row of batch.statuses) {
      const key = `${row.mode}|${row.camera_id}`;
      const time = Date.parse(row.heartbeat_at ?? batch.run.ended_at ?? batch.run.started_at ?? "1970-01-01T00:00:00Z");
      if (!statuses.has(key) || time >= statuses.get(key)!.time) statuses.set(key, { value: row, time });
    }
    for (const row of batch.traffic) {
      const key = trafficKey(row);
      if (!traffic.has(key) || eventTime >= traffic.get(key)!.time) traffic.set(key, { value: row, time: eventTime });
    }
    for (const row of batch.emissions) {
      const key = emissionsKey(row);
      if (!emissions.has(key) || eventTime >= emissions.get(key)!.time) emissions.set(key, { value: row, time: eventTime });
    }
  }
  return {
    runs: [...runs.values()],
    statuses: [...statuses.values()].map((row) => row.value),
    traffic: [...traffic.values()].map((row) => row.value),
    emissions: [...emissions.values()].map((row) => row.value),
    batches: snapshot.batches.map(({ batch, accepted_at }) => ({ batch_id: batch.batch_id, revision: batch.revision, accepted_at })),
  };
}

let cachedRead: { path: string; signature: string; value: WorkerStore } | undefined;

function immutable(store: WorkerStore): WorkerStore {
  // All materialized records are flat. Freezing prevents one reader changing another's cache.
  for (const collection of [store.runs, store.statuses, store.traffic, store.emissions, store.batches]) {
    for (const row of collection) Object.freeze(row);
    Object.freeze(collection);
  }
  return Object.freeze(store);
}

export function readWorkerStore(): WorkerStore {
  const path = storePath();
  if (!path) return immutable(materialize(empty()));
  try {
    if (!existsSync(/* turbopackIgnore: true */ path)) {
      cachedRead = undefined;
      return immutable(materialize(empty()));
    }
    const stat = statSync(/* turbopackIgnore: true */ path, { bigint: true });
    const signature = `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
    if (cachedRead?.path === path && cachedRead.signature === signature) return cachedRead.value;
    const value = immutable(materialize(readSnapshot(path)));
    cachedRead = { path, signature, value };
    return value;
  } catch (error) {
    cachedRead = undefined;
    if (error instanceof IngestError) throw error;
    throw new IngestError("The worker store cannot be read. Preserve it for recovery.", 503);
  }
}

function writerIsAbandoned(lock: string): boolean {
  try {
    const owner = JSON.parse(readFileSync(/* turbopackIgnore: true */ lock, "utf8")) as { pid: number };
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || statSync(/* turbopackIgnore: true */ lock).mtimeMs >= Date.now() - 30_000) return false;
    try { process.kill(owner.pid, 0); } catch (probe) {
      return (probe as NodeJS.ErrnoException).code === "ESRCH";
    }
  } catch { /* A writer may still be creating or releasing the lock. */ }
  return false;
}

/** Serialize reapers, then check the CURRENT owner again before removing a lock. */
function recoverAbandonedWriter(lock: string): boolean {
  if (!writerIsAbandoned(lock)) return false;
  const recovery = `${lock}.recovery`;
  let recoveryFd: number;
  try {
    recoveryFd = openSync(/* turbopackIgnore: true */ recovery, "wx", 0o600);
  } catch {
    // Recovery claims are never reaped automatically: a crashed recovery needs
    // operator review, rather than risking removal of another active claim.
    return false;
  }
  try {
    writeFileSync(recoveryFd, JSON.stringify({ pid: process.pid }));
    if (!writerIsAbandoned(lock)) return false;
    unlinkSync(/* turbopackIgnore: true */ lock);
    return true;
  } catch {
    return false;
  } finally {
    closeSync(recoveryFd);
    unlinkSync(/* turbopackIgnore: true */ recovery);
  }
}

/** Local POSIX store: exclusive writer, fsynced private file, then atomic rename. */
export function withStoreLock<T>(path: string, update: (snapshot: WorkerSnapshot) => { snapshot: WorkerSnapshot; result: T }): T {
  mkdirSync(/* turbopackIgnore: true */ dirname(path), { recursive: true, mode: 0o700 });
  const lock = `${path}.lock`;
  const deadline = Date.now() + 2000;
  let lockFd: number | undefined;
  while (lockFd === undefined) {
    try {
      lockFd = openSync(/* turbopackIgnore: true */ lock, "wx", 0o600);
      writeFileSync(lockFd, JSON.stringify({ pid: process.pid }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw new IngestError("Worker store is not writable.", 503);
      if (recoverAbandonedWriter(lock)) continue;
      if (Date.now() >= deadline) throw new IngestError("Worker store is busy; retry this batch unchanged.", 503);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
    }
  }
  let temporary: string | undefined;
  try {
    const { snapshot, result } = update(readSnapshot(path));
    const serialized = JSON.stringify(snapshot);
    if (Buffer.byteLength(serialized) > MAX_STORE_BYTES) throw new IngestError("Worker store reached its 32 MiB local capacity. Archive or rotate the store before retrying.", 507);
    temporary = `${path}.${randomUUID()}.tmp`;
    const fd = openSync(/* turbopackIgnore: true */ temporary, "wx", 0o600);
    try { writeFileSync(fd, serialized); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(/* turbopackIgnore: true */ temporary, /* turbopackIgnore: true */ path);
    temporary = undefined;
    const directory = openSync(/* turbopackIgnore: true */ dirname(path), "r");
    try { fsyncSync(directory); } finally { closeSync(directory); }
    return result;
  } catch (error) {
    if (error instanceof IngestError) throw error;
    throw new IngestError("Worker store could not commit this batch; retry unchanged.", 503);
  } finally {
    if (temporary && existsSync(/* turbopackIgnore: true */ temporary)) unlinkSync(/* turbopackIgnore: true */ temporary);
    closeSync(lockFd);
    unlinkSync(/* turbopackIgnore: true */ lock);
  }
}
