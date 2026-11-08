import assert from "node:assert/strict";
import test from "node:test";
import { composeMeasurements } from "../src/measurement-core.ts";
import { fingerprint } from "../src/registry.ts";
import type { StoredMeasurement } from "../src/measurement-types.ts";
import type { TrafficMinute, EmissionsMinute } from "../../contracts/src/index.ts";

// Frozen linear reference protects ordering and overlay semantics during indexing changes.
import {visibleDerived} from "../src/measurement-core.ts";
import type {WorkerStore,WorkerSnapshot}from"../src/persistence.ts";
import type {LoadedRegistry}from"../src/registry.ts";
function referenceComposition(
  store: WorkerStore,
  snapshot: WorkerSnapshot,
  registry: LoadedRegistry,
): WorkerStore {
  for (const entry of [...(snapshot.measurement_batches ?? [])].sort(
    (a, b) => a.sequence - b.sequence,
  )) {
    const source = entry.source;
    const prior = store.runs.find((r) => r.run_id === source.run.run_id);
    if (!prior) store.runs.push(source.run);
    else {
      const index = store.runs.indexOf(prior);
      store.runs[index] = {
        ...source.run,
        device: prior.device ?? source.run.device,
        ended_at: source.run.ended_at ?? prior.ended_at,
      };
    }
    if (source.retract) continue;
    const derived = visibleDerived(entry, snapshot, registry);
    const matches = (r: { camera_id: string; minute: string; mode: string }) =>
      r.camera_id === source.camera_id &&
      r.mode === source.mode &&
      Date.parse(r.minute) === Date.parse(source.minute);
    // Measurement owns traversal/physical columns; independent observation columns survive.
    store.traffic = store.traffic.map((row) =>
      matches(row)
        ? {
            ...row,
            completed_traversals: null,
            traversal_time_s: null,
            distance_m: null,
            queue_length_m: null,
          }
        : row,
    );
    for (const row of derived.traffic) {
      const index = store.traffic.findIndex(
        (r) => matches(r) && r.vehicle_class === row.vehicle_class,
      );
      if (index < 0) store.traffic.push(row);
      else {
        const old = store.traffic[index];
        store.traffic[index] = {
          ...row,
          count: row.count ?? old.count,
          stopped_vehicle_seconds:
            row.stopped_vehicle_seconds ?? old.stopped_vehicle_seconds,
          queue_count: row.queue_count ?? old.queue_count,
          coverage: row.coverage ?? old.coverage,
        };
      }
    }
    store.emissions = store.emissions
      .filter((row) => !matches(row))
      .concat(derived.emissions);
  }
  store.measurement_batches = (snapshot.measurement_batches ?? []).map(
    ({ source, accepted_at }) => ({
      batch_id: source.batch_id,
      revision: source.revision,
      mode: source.mode,
      accepted_at,
    }),
  );
  return store;
}


const minute = "2026-11-08T14:00:00Z";
const registry: LoadedRegistry = { state: "configured", digest: "approved-fixture", document: null };
function traffic(camera_id: string, mode: "live" | "replay", vehicle_class: "car" | "truck", count: number | null, spelling = minute): TrafficMinute {
  return { camera_id, mode, minute: spelling, run_id: "fixture-run", vehicle_class, count, stopped_vehicle_seconds: count, queue_count: count, coverage: count === null ? null : 1, completed_traversals: 2, traversal_time_s: 20, distance_m: 40, queue_length_m: 3 };
}
function emission(camera_id: string, mode: "live" | "replay", estimate: number): EmissionsMinute {
  return { camera_id, mode, minute, pollutant: "co2", estimate_g: estimate, range_low_g: estimate, range_high_g: estimate, quality_state: "ok" } as EmissionsMinute;
}
function entry(sequence: number, camera_id: string, mode: "live" | "replay", rows: TrafficMinute[], emissions: EmissionsMinute[], retract = false): StoredMeasurement {
  return {
    sequence, accepted_at: "2026-11-08T14:02:00Z", source_digest: `digest-${sequence}`,
    stored_source_digest: `stored-${sequence}`, data_digest: `data-${sequence}`, superseded: [],
    source: {
      batch_id: `batch-${sequence}`, revision: sequence, camera_id, mode, minute,
      run: { run_id: "fixture-run", mode, model_version: "fixture", device: "new-device", started_at: minute, ended_at: sequence === 4 ? "2026-11-08T14:01:00Z" : null },
      observation_ref: null, retract,
    } as StoredMeasurement["source"],
    derived: { registry_digest: registry.digest, dependency_key: fingerprint(null), evidence_ref: `evidence-${sequence}`, reasons: [], state: "ready", input: null, calculation: {} as StoredMeasurement["derived"]["calculation"], traffic: rows, emissions },
  };
}
function fixture() {
  const base: WorkerStore = {
    runs: [{ run_id: "fixture-run", mode: "live", model_version: "fixture", device: "original-device", started_at: minute, ended_at: null }], statuses: [], batches: [], measurement_batches: [],
    traffic: [traffic("222", "live", "car", 7, "2026-11-08T14:00:00.000Z"), traffic("223", "live", "car", 9), traffic("222", "replay", "car", 11), traffic("222", "live", "truck", 4)],
    emissions: [emission("222", "live", 1), emission("223", "live", 2), emission("222", "replay", 3)],
  };
  // Receipt array order deliberately differs from overlay sequence order.
  const snapshot: WorkerSnapshot = { schema_version: 1, next_sequence: 5, batches: [], measurement_batches: [
    entry(3, "222", "live", [traffic("222", "live", "car", null)], [emission("222", "live", 30)]),
    entry(1, "222", "live", [traffic("222", "live", "car", null), traffic("222", "live", "truck", 0)], [emission("222", "live", 10)]),
    entry(4, "223", "live", [], [], true),
    entry(2, "223", "live", [traffic("223", "live", "truck", 5)], [emission("223", "live", 20)]),
  ] };
  return { base, snapshot };
}
for (const revoked of [false, true]) {
  test(`indexed composition preserves complete overlay result${revoked ? " after registry revocation" : ""}`, () => {
    const { base, snapshot } = fixture();
    const activeRegistry = revoked ? { ...registry, digest: "revoked-fixture" } : registry;
    const expected = referenceComposition(structuredClone(base), snapshot, activeRegistry);
    const actual = composeMeasurements(structuredClone(base), snapshot, activeRegistry);
    assert.deepEqual(actual, expected);
    assert.equal(JSON.stringify(actual), JSON.stringify(expected), "preserve exact array and property order");
    assert.equal(actual.traffic[0].count, 7, "null observation preserves independent count");
    assert.equal(actual.traffic[3].count, 0, "supported zero replaces prior count");
    assert.equal(actual.traffic[3].distance_m, null, "later cohort clears stale physical fields for other classes");
    assert.deepEqual(actual.traffic[2], base.traffic[2], "replay remains independent from live");
    assert.equal(actual.runs[0].device, "original-device");
    assert.equal(actual.runs[0].ended_at, "2026-11-08T14:01:00Z", "retraction retains run closure");
    assert.deepEqual(actual.measurement_batches.map(row => row.batch_id), ["batch-3", "batch-1", "batch-4", "batch-2"]);
    assert.deepEqual(actual.emissions.map(row => row.camera_id), ["222", "223", "222"], "filter then append preserves interleaved emission order");
    if (revoked) assert.ok(actual.emissions.slice(1).every(row => row.estimate_g === null && row.quality_state === "unavailable"));
  });
}
