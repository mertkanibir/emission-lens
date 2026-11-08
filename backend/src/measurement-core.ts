import {
  calibrationFor,
  validateEmissionsMinute,
  validateTrafficMinute,
  VEHICLE_CLASSES,
  type EmissionsMinute,
  type TrafficMinute,
} from "../../contracts/src/index.ts";
import {
  parseMeasurementBatch,
  type MeasurementBatch,
} from "../../contracts/src/measurement.ts";
import {
  estimate_completed_traversals,
  type EstimateInput,
} from "../../emissions/src/index.ts";
import type { ScenarioTraversal } from "../../emissions/src/scenario.ts";
import type { WorkerSnapshot, WorkerStore } from "./persistence.ts";
import type {
  MeasurementDerived,
  StoredMeasurement,
} from "./measurement-types.ts";
import { fingerprint, type LoadedRegistry } from "./registry.ts";

export function privateSource(batch: MeasurementBatch): MeasurementBatch {
  const source = structuredClone(batch);
  const scope = [source.camera_id, source.run.run_id];
  const session = (id: string) => fingerprint([...scope, "session", id]);
  for (const traversal of source.traversals) {
    traversal.traversal_id = fingerprint([
      ...scope,
      traversal.session_id,
      "traversal",
      traversal.traversal_id,
    ]);
    traversal.session_id = session(traversal.session_id);
  }
  for (const item of source.timing.sessions)
    item.session_id = session(item.session_id);
  return source;
}
export function dependencyState(
  source: MeasurementBatch,
  snapshot: WorkerSnapshot,
): { key: string; reasons: string[] } {
  const ref = source.observation_ref;
  if (!ref) return { key: fingerprint(null), reasons: [] };
  const linked = snapshot.batches.find(
    (item) => item.batch.batch_id === ref.batch_id,
  )?.batch;
  const context = linked?.traffic.some(
    (row) =>
      row.camera_id === source.camera_id &&
      row.mode === source.mode &&
      row.run_id === source.run.run_id &&
      Date.parse(row.minute) === Date.parse(source.minute),
  );
  return {
    key: fingerprint(linked ?? null),
    reasons:
      !linked ||
      linked.revision !== ref.revision ||
      linked.run.run_id !== source.run.run_id ||
      linked.run.mode !== source.mode ||
      !context
        ? [
            "The linked observation snapshot is absent, revised or does not cover this camera/run/minute.",
          ]
        : [],
  };
}
export function deriveMeasurement(
  source: MeasurementBatch,
  sourceDigest: string,
  snapshot: WorkerSnapshot,
  registry: LoadedRegistry,
): MeasurementDerived {
  const dependency = dependencyState(source, snapshot);
  const reasons = [...dependency.reasons];
  const candidate = registry.document?.calibrations.find(
    (c) =>
      c.camera_id === source.camera_id &&
      c.version === source.calibration_version,
  );
  const instants = source.traversals.length
    ? source.traversals.map((t) => Date.parse(t.completed_at))
    : [Date.parse(source.minute)];
  const approved =
    !!candidate &&
    candidate.approval.status === "approved" &&
    candidate.approval.modes.includes(source.mode) &&
    candidate.valid_from !== null &&
    instants.every(
      (at) =>
        at >= Date.parse(candidate.valid_from!) &&
        (candidate.valid_to === null || at < Date.parse(candidate.valid_to)),
    );
  if (!approved)
    reasons.push(
      "No server-approved calibration version covers this camera, mode and source time.",
    );
  const movements = candidate?.movements ?? [];
  const distances = source.traversals.map(
    (t) =>
      movements.find((m) => m.movement_id === t.movement_id)?.distance_m ??
      null,
  );
  if (approved && distances.some((d) => d === null))
    reasons.push(
      "A completed traversal references a movement absent from the approved calibration.",
    );
  const physical =
    approved &&
    distances.every((d) => d !== null) &&
    dependency.reasons.length === 0;
  const mapping = registry.document?.mappings.find(
    (m) =>
      m.version === source.mapping_version &&
      m.approval.status === "approved" &&
      m.approval.modes.includes(source.mode),
  );
  if (!mapping)
    reasons.push("No server-approved class mapping version covers this mode.");
  const traversals: ScenarioTraversal[] = physical
    ? source.traversals.map((t, i) => ({
        session_id: t.session_id,
        traversal_id: t.traversal_id,
        completed_at: new Date(t.completed_at).toISOString(),
        vehicle_class: t.vehicle_class,
        distance_m: distances[i]!,
        traversal_time_s: t.traversal_time_s,
        stopped_time_s: t.stopped_time_s,
      }))
    : [];
  const input: EstimateInput = {
    camera_id: source.camera_id,
    minute: source.minute,
    mode: source.mode,
    calibration: physical
      ? candidate!.calibration
      : { ...calibrationFor(source.camera_id), validation_status: "missing" },
    class_mapping: mapping?.mapping ?? null,
    meteorology: source.meteorology,
    traversals,
  };
  const calculation = estimate_completed_traversals(input);
  if (!source.traversals.length) {
    calculation.rows = calculation.rows.map((row) => ({
      ...row,
      estimate_g: null,
      quality_state: "insufficient_evidence",
    }));
    reasons.push(
      "No completed traversals; a queue or an empty cohort is insufficient emissions evidence, not zero.",
    );
  }
  for (const reason of calculation.limitations.slice(5))
    if (!reasons.includes(reason)) reasons.push(reason);
  const traffic: TrafficMinute[] = VEHICLE_CLASSES.flatMap((vehicle_class) => {
    const obs = source.observations.find(
      (o) => o.vehicle_class === vehicle_class,
    );
    const members = source.traversals
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => t.vehicle_class === vehicle_class);
    if (!obs && !members.length) return [];
    const row: TrafficMinute = {
      camera_id: source.camera_id,
      minute: source.minute,
      run_id: source.run.run_id,
      mode: source.mode,
      vehicle_class,
      count: obs?.count ?? null,
      stopped_vehicle_seconds: obs?.stopped_vehicle_seconds ?? null,
      queue_count: obs?.queue_count ?? null,
      queue_length_m: null,
      coverage: obs?.coverage ?? null,
      completed_traversals: members.length || null,
      traversal_time_s: members.length
        ? members.reduce((sum, { t }) => sum + t.traversal_time_s, 0)
        : null,
      distance_m:
        physical && members.length
          ? members.reduce((sum, { i }) => sum + distances[i]!, 0)
          : null,
    };
    validateTrafficMinute(row);
    return [row];
  });
  const emissions = calculation.rows;
  const state = emissions.every((row) => row.quality_state === "ok")
    ? "ready"
    : "unavailable";
  const evidence_ref = fingerprint({
    sourceDigest,
    registry: registry.digest,
    dependency: dependency.key,
    traffic,
    calculation,
  });
  return {
    registry_digest: registry.digest,
    dependency_key: dependency.key,
    evidence_ref,
    reasons,
    state,
    input: physical ? { ...input, traversals } : null,
    calculation,
    traffic,
    emissions,
  };
}
export function sealMeasurement(
  entry: Omit<StoredMeasurement, "data_digest">,
): StoredMeasurement {
  return { ...entry, data_digest: fingerprint(entry) };
}
export function validateStoredMeasurement(
  value: StoredMeasurement,
): StoredMeasurement {
  const { data_digest, ...payload } = value;
  if (
    !/^[a-f0-9]{64}$/.test(data_digest) ||
    fingerprint(payload) !== data_digest
  )
    throw new Error("Invalid measurement integrity.");
  const source = parseMeasurementBatch(value.source);
  if (
    fingerprint(source) !== value.stored_source_digest ||
    !/^[a-f0-9]{64}$/.test(value.source_digest) ||
    !Array.isArray(value.superseded) ||
    value.superseded.length > 64
  )
    throw new Error("Invalid measurement source.");
  for (const row of value.derived.traffic) validateTrafficMinute(row);
  for (const row of value.derived.emissions) validateEmissionsMinute(row);
  if (
    value.derived.emissions.length !== 2 ||
    new Set(value.derived.emissions.map((row) => row.pollutant)).size !== 2
  )
    throw new Error("Both pollutant rows are required.");
  for (const row of [...value.derived.traffic, ...value.derived.emissions])
    if (
      row.camera_id !== source.camera_id ||
      row.minute !== source.minute ||
      row.mode !== source.mode
    )
      throw new Error("Measurement composition context mismatch.");
  return value;
}
export function refreshDerivedMeasurements(
  snapshot: WorkerSnapshot,
  registry: LoadedRegistry,
): WorkerSnapshot {
  const entries = (snapshot.measurement_batches ?? []).map((entry) => {
    const dep = dependencyState(entry.source, snapshot);
    if (
      entry.derived.registry_digest === registry.digest &&
      entry.derived.dependency_key === dep.key
    )
      return entry;
    const { data_digest: _, ...rest } = entry;
    return sealMeasurement({
      ...rest,
      derived: deriveMeasurement(
        entry.source,
        entry.source_digest,
        snapshot,
        registry,
      ),
    });
  });
  return { ...snapshot, measurement_batches: entries };
}
export function visibleDerived(
  entry: StoredMeasurement,
  snapshot: WorkerSnapshot,
  registry: LoadedRegistry,
): MeasurementDerived {
  // Revocation is effective immediately, before an explicit refresh commits.
  if (
    entry.derived.registry_digest === registry.digest &&
    entry.derived.dependency_key === dependencyState(entry.source, snapshot).key
  )
    return entry.derived;
  const reason =
    "Server registry or linked observations changed; refresh this snapshot before using physical quantities.";
  return {
    ...entry.derived,
    state: "unavailable",
    input: null,
    reasons: [...entry.derived.reasons, reason],
    traffic: entry.derived.traffic.map((row) => ({
      ...row,
      distance_m: null,
      queue_length_m: null,
    })),
    emissions: entry.derived.emissions.map((row) => ({
      ...row,
      estimate_g: null,
      range_low_g: null,
      range_high_g: null,
      quality_state: "unavailable",
    })),
  };
}
export function composeMeasurements(
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
