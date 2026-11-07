import { createHash } from "node:crypto";
import { parseWorkerBatch, type WorkerBatch } from "../../contracts/src/ingest.ts";
import { IngestError, materialize, MAX_STORED_BATCHES, STORE_RETENTION_MS, storePath, trafficKey, withStoreLock } from "./persistence.ts";

export { IngestError, readWorkerStore } from "./persistence.ts";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

const digest = (value: WorkerBatch): string => createHash("sha256").update(canonical(value)).digest("hex");

export interface IngestReceipt {
  batch_id: string;
  revision: number;
  duplicate: boolean;
  accepted_at: string;
}

export function ingestWorkerBatch(value: unknown, now = new Date()): IngestReceipt {
  let batch: WorkerBatch;
  try { batch = parseWorkerBatch(value); } catch (error) {
    throw new IngestError(error instanceof Error ? error.message : "Invalid worker batch.", 400);
  }
  const path = storePath();
  if (!path) throw new IngestError("Worker persistence is not configured.", 503);
  const nowMs = now.getTime();
  const eventTimes = [batch.run.started_at, batch.run.ended_at, ...batch.statuses.flatMap((row) => [row.heartbeat_at, row.last_source_timestamp]), ...batch.traffic.map((row) => row.minute), ...batch.emissions.map((row) => row.minute)].filter((value): value is string => value !== null).map(Date.parse);
  if (eventTimes.some((time) => time > nowMs + 5 * 60_000)) throw new IngestError("Worker timestamps exceed the allowed five-minute clock skew.", 400);
  if (eventTimes.length === 0 || Math.max(...eventTimes) < nowMs - STORE_RETENTION_MS) throw new IngestError("Batch has no event inside the 24-hour local retention window.", 400);
  if (batch.run.ended_at !== null && batch.statuses.some((row) => row.state !== "offline")) throw new IngestError("An ended run must publish offline camera statuses.", 400);
  return withStoreLock<IngestReceipt>(path, (snapshot) => {
    const retained = snapshot.batches.filter((row) => Date.parse(row.accepted_at) >= nowMs - STORE_RETENTION_MS);
    const previous = retained.find((row) => row.batch.batch_id === batch.batch_id);
    if (previous) {
      if (batch.revision < previous.batch.revision) throw new IngestError("Batch revision is older than its stored revision.", 409);
      if (batch.revision === previous.batch.revision) {
        if (digest(batch) !== digest(previous.batch)) throw new IngestError("A stored batch revision cannot change content.", 409);
        return { snapshot, result: { batch_id: batch.batch_id, revision: batch.revision, duplicate: true, accepted_at: previous.accepted_at } };
      }
      if (batch.run.run_id !== previous.batch.run.run_id) throw new IngestError("A batch revision cannot change its worker run.", 409);
    }
    const current = materialize({ ...snapshot, batches: retained });
    const previousRun = current.runs.find((row) => row.run_id === batch.run.run_id);
    if (previousRun && (["mode", "model_version", "started_at"] as const).some((key) => previousRun[key] !== batch.run[key])) throw new IngestError("Worker run provenance cannot change.", 409);
    if (previousRun?.device !== undefined && previousRun.device !== null && previousRun.device !== batch.run.device) throw new IngestError("An established worker device cannot change or become unavailable.", 409);
    if (previousRun?.ended_at !== null && previousRun?.ended_at !== undefined && previousRun.ended_at !== batch.run.ended_at) throw new IngestError("A completed worker run cannot be reopened or change its end time.", 409);
    for (const row of batch.traffic) {
      if (current.traffic.some((stored) => trafficKey(stored) === trafficKey(row) && stored.run_id !== row.run_id)) throw new IngestError("A camera-minute class already belongs to another worker run. Do not overwrite overlapping observations.", 409);
    }
    const accepted_at = now.toISOString();
    const entry = { sequence: previous?.sequence ?? snapshot.next_sequence, accepted_at, batch };
    const next = retained.filter((row) => row.batch.batch_id !== batch.batch_id).concat(entry).sort((a, b) => Date.parse(a.accepted_at) - Date.parse(b.accepted_at)).slice(-MAX_STORED_BATCHES).sort((a, b) => a.sequence - b.sequence);
    return {
      snapshot: { schema_version: 1, next_sequence: previous ? snapshot.next_sequence : snapshot.next_sequence + 1, batches: next },
      result: { batch_id: batch.batch_id, revision: batch.revision, duplicate: false, accepted_at },
    };
  });
}
