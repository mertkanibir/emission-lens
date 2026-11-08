import { cameraById, sumStrict, type Mode } from "../../contracts/src/index.ts";
import {
  parseMeasurementBatch,
  type MeasurementBatch,
} from "../../contracts/src/measurement.ts";
import {
  compare_completed_traversal_scenario,
  type CompletedTraversalScenario,
} from "../../emissions/src/scenario.ts";
import { reportingWindow } from "./clock.ts";
import {
  dependencyState,
  deriveMeasurement,
  privateSource,
  refreshDerivedMeasurements,
  sealMeasurement,
  visibleDerived,
} from "./measurement-core.ts";
import type {
  MeasurementPollutantComparison,
  MeasurementScenarioView,
  MeasurementWindowView,
  StoredMeasurement,
} from "./measurement-types.ts";
import {
  IngestError,
  materialize,
  readSnapshot,
  STORE_RETENTION_MS,
  storePath,
  withStoreLock,
  type WorkerSnapshot,
} from "./persistence.ts";
import { fingerprint, loadRegistry, registryStatus } from "./registry.ts";

/** Async transaction boundary; the local compatibility reads remain synchronous. */
export interface MeasurementRepository {
  read(): Promise<WorkerSnapshot>;
  transact<T>(
    update: (snapshot: WorkerSnapshot) => {
      snapshot: WorkerSnapshot;
      result: T;
    },
  ): Promise<T>;
}
export function localMeasurementRepository(): MeasurementRepository {
  const path = storePath();
  if (!path)
    throw new IngestError("Measurement persistence is not configured.", 503);
  return {
    read: async () => readSnapshot(path),
    transact: async (update) => withStoreLock(path, update),
  };
}
export interface MeasurementReceipt {
  batch_id: string;
  revision: number;
  duplicate: boolean;
  accepted_at: string;
  evidence_ref: string;
  state: "ready" | "unavailable";
  reasons: string[];
}
const empty = (): WorkerSnapshot => ({
  schema_version: 1,
  next_sequence: 0,
  batches: [],
});
function localSnapshot(): WorkerSnapshot {
  const path = storePath();
  return path ? readSnapshot(path) : empty();
}
function receipt(
  entry: StoredMeasurement,
  duplicate: boolean,
): MeasurementReceipt {
  return {
    batch_id: entry.source.batch_id,
    revision: entry.source.revision,
    duplicate,
    accepted_at: entry.accepted_at,
    evidence_ref: entry.derived.evidence_ref,
    state: entry.source.retract ? "unavailable" : entry.derived.state,
    reasons: entry.source.retract
      ? ["Measurement snapshot retracted."]
      : entry.derived.reasons,
  };
}
function validateRun(source: MeasurementBatch, snapshot: WorkerSnapshot): void {
  const previous = materialize(snapshot).runs.find(
    (run) => run.run_id === source.run.run_id,
  );
  if (
    previous &&
    (["mode", "model_version", "started_at"] as const).some(
      (key) => previous[key] !== source.run[key],
    )
  )
    throw new IngestError("Worker run provenance cannot change.", 409);
  if (
    previous?.device !== null &&
    previous?.device !== undefined &&
    previous.device !== source.run.device
  )
    throw new IngestError("An established worker device cannot change.", 409);
  if (
    previous?.ended_at !== null &&
    previous?.ended_at !== undefined &&
    previous.ended_at !== source.run.ended_at
  )
    throw new IngestError(
      "An ended run cannot reopen or change end time.",
      409,
    );
}
export async function ingest_measurement_batch(
  value: unknown,
  now = new Date(),
  repository = localMeasurementRepository(),
): Promise<MeasurementReceipt> {
  let source: MeasurementBatch;
  try {
    source = parseMeasurementBatch(value);
  } catch {
    throw new IngestError(
      "Invalid measurement envelope. Check the versioned schema, timing, units and required fields.",
      400,
    );
  }
  const instant = Date.parse(source.minute);
  if (
    instant > now.getTime() + 5 * 60_000 ||
    instant < now.getTime() - STORE_RETENTION_MS
  )
    throw new IngestError(
      "Measurement minute is outside the 24-hour retention / five-minute skew window.",
      400,
    );
  if (
    [
      source.run.started_at,
      source.run.ended_at,
      ...source.timing.sessions.map((s) => s.anchor_utc),
      ...source.traversals.map((t) => t.completed_at),
    ].some((t) => t !== null && Date.parse(t) > now.getTime() + 5 * 60_000)
  )
    throw new IngestError(
      "Measurement timestamps exceed the five-minute clock skew.",
      400,
    );
  const sourceDigest = fingerprint(source);
  return repository.transact((snapshot) => {
    const registry = loadRegistry();
    const retained = (snapshot.measurement_batches ?? []).filter(
      (e) => Date.parse(e.accepted_at) >= now.getTime() - STORE_RETENTION_MS,
    );
    snapshot = { ...snapshot, measurement_batches: retained };
    if (snapshot.batches.some((e) => e.batch.batch_id === source.batch_id))
      throw new IngestError(
        "Batch identity already belongs to worker ingestion.",
        409,
      );
    const previous = retained.find(
      (e) => e.source.batch_id === source.batch_id,
    );
    if (previous) {
      if (source.revision < previous.source.revision)
        throw new IngestError(
          "Measurement revision is older than its stored revision.",
          409,
        );
      if (source.revision === previous.source.revision) {
        if (sourceDigest !== previous.source_digest)
          throw new IngestError(
            "A stored measurement revision cannot change content.",
            409,
          );
        const refreshed = refreshDerivedMeasurements(snapshot, registry);
        return {
          snapshot: refreshed,
          result: receipt(
            refreshed.measurement_batches!.find(
              (e) => e.source.batch_id === source.batch_id,
            )!,
            true,
          ),
        };
      }
      if (
        source.camera_id !== previous.source.camera_id ||
        source.mode !== previous.source.mode ||
        source.run.run_id !== previous.source.run.run_id
      )
        throw new IngestError(
          "Measurement revisions cannot change camera, mode or run.",
          409,
        );
    }
    validateRun(source, snapshot);
    if (!source.retract) {
      if (
        retained.some(
          (e) =>
            e !== previous &&
            !e.source.retract &&
            e.source.camera_id === source.camera_id &&
            e.source.mode === source.mode &&
            e.source.minute === source.minute,
        )
      )
        throw new IngestError(
          "This camera/mode/minute already belongs to another measurement snapshot. Resolve overlap explicitly.",
          409,
        );
      if (
        snapshot.batches.some((e) =>
          e.batch.traffic.some(
            (row) =>
              row.camera_id === source.camera_id &&
              row.mode === source.mode &&
              Date.parse(row.minute) === instant &&
              row.run_id !== source.run.run_id,
          ),
        )
      )
        throw new IngestError(
          "This camera-minute has observations from another run. Do not combine restart overlap.",
          409,
        );
    }
    const storedSource = privateSource(source);
    if (!source.retract) {
      const identities = new Set(
        storedSource.traversals.map((t) => `${t.session_id}|${t.traversal_id}`),
      );
      if (
        retained.some(
          (e) =>
            e !== previous &&
            !e.source.retract &&
            e.source.camera_id === source.camera_id &&
            e.source.mode === source.mode &&
            e.source.run.run_id === source.run.run_id &&
            e.source.traversals.some((t) =>
              identities.has(`${t.session_id}|${t.traversal_id}`),
            ),
        )
      )
        throw new IngestError(
          "A completed traversal already belongs to another active snapshot. Retract or correct that snapshot first.",
          409,
        );
    }
    const superseded = previous
      ? [
          ...previous.superseded,
          {
            revision: previous.source.revision,
            source_digest: previous.source_digest,
            accepted_at: previous.accepted_at,
          },
        ].slice(-64)
      : [];
    const entry = sealMeasurement({
      sequence: previous?.sequence ?? snapshot.next_sequence,
      accepted_at: now.toISOString(),
      source_digest: sourceDigest,
      stored_source_digest: fingerprint(storedSource),
      source: storedSource,
      derived: deriveMeasurement(
        storedSource,
        sourceDigest,
        snapshot,
        registry,
      ),
      superseded,
    });
    const next = retained.filter((e) => e !== previous).concat(entry);
    if (next.length > 1000)
      throw new IngestError(
        "Measurement store reached its retained snapshot capacity.",
        507,
      );
    const updated = refreshDerivedMeasurements(
      {
        ...snapshot,
        next_sequence: previous
          ? snapshot.next_sequence
          : snapshot.next_sequence + 1,
        measurement_batches: next,
      },
      registry,
    );
    return {
      snapshot: updated,
      result: receipt(
        updated.measurement_batches!.find(
          (e) => e.source.batch_id === source.batch_id,
        )!,
        false,
      ),
    };
  });
}
export async function refresh_measurements(
  now = new Date(),
  repository = localMeasurementRepository(),
): Promise<{ refreshed: number; registry_state: string }> {
  return repository.transact((snapshot) => {
    const registry = loadRegistry();
    const retained = {
      ...snapshot,
      measurement_batches: (snapshot.measurement_batches ?? []).filter(
        (e) => Date.parse(e.accepted_at) >= now.getTime() - STORE_RETENTION_MS,
      ),
    };
    const next = refreshDerivedMeasurements(retained, registry);
    const refreshed = (next.measurement_batches ?? []).filter(
      (e, i) => e !== retained.measurement_batches[i],
    ).length;
    return {
      snapshot: next,
      result: { refreshed, registry_state: registry.state },
    };
  });
}
function nullComparison(): MeasurementPollutantComparison {
  return {
    baseline_g: null,
    scenario_g: null,
    change_g: null,
    change_pct: null,
  };
}
export function read_measurement_window(input: {
  cameraId: string;
  mode: Mode;
  now?: Date;
  stoppedTimeReductionPct?: number;
}): MeasurementWindowView {
  if (
    !cameraById(input.cameraId) ||
    !["live", "replay", "synthetic"].includes(input.mode)
  )
    throw new IngestError("Unknown camera or mode.", 400);
  const reduction = input.stoppedTimeReductionPct ?? 20;
  if (!Number.isFinite(reduction) || reduction < 0 || reduction > 100)
    throw new IngestError(
      "Stopped-time reduction must be between 0 and 100.",
      400,
    );
  const { from, to } = reportingWindow(input.mode, input.now);
  const snapshot = localSnapshot(),
    registry = loadRegistry();
  const entries = (snapshot.measurement_batches ?? [])
    .filter(
      (e) =>
        !e.source.retract &&
        e.source.camera_id === input.cameraId &&
        e.source.mode === input.mode &&
        Date.parse(e.source.minute) >= Date.parse(from) &&
        Date.parse(e.source.minute) < Date.parse(to),
    )
    .sort((a, b) => Date.parse(a.source.minute) - Date.parse(b.source.minute));
  const derived = entries.map((e) => visibleDerived(e, snapshot, registry));
  const store = materialize(snapshot);
  const minutes = entries.map((entry, i) => ({
    minute: entry.source.minute,
    batch_id: entry.source.batch_id,
    revision: entry.source.revision,
    state: derived[i].state,
    reasons: derived[i].reasons,
    timing_basis: entry.source.timing.basis,
    meteorology: { ...entry.source.meteorology },
    calibration_version: entry.source.calibration_version,
    mapping_version: entry.source.mapping_version,
    evidence_ref: derived[i].evidence_ref,
    traffic: store.traffic.filter(
      (row) =>
        row.camera_id === input.cameraId &&
        row.mode === input.mode &&
        Date.parse(row.minute) === Date.parse(entry.source.minute),
    ),
    emissions: derived[i].emissions,
  }));
  const scenarios: Array<CompletedTraversalScenario | null> = derived.map(
    (d) =>
      d.input
        ? compare_completed_traversal_scenario({
            ...d.input,
            stopped_time_reduction_pct: reduction,
          })
        : null,
  );
  const pollutants = { co2: nullComparison(), nox: nullComparison() };
  for (const pollutant of ["co2", "nox"] as const) {
    const baseline = sumStrict(
      derived.map((d) => {
        const r = d.emissions.find((r) => r.pollutant === pollutant);
        return r?.quality_state === "ok" ? r.estimate_g : null;
      }),
    );
    const scenario = sumStrict(
      scenarios.map((s) => {
        const r = s?.scenario.rows.find((r) => r.pollutant === pollutant);
        return r?.quality_state === "ok" ? r.estimate_g : null;
      }),
    );
    const change =
      baseline !== null && scenario !== null ? scenario - baseline : null;
    pollutants[pollutant] = {
      baseline_g: baseline,
      scenario_g: scenario,
      change_g: change,
      change_pct:
        change !== null && baseline !== null && baseline !== 0
          ? (change / baseline) * 100
          : null,
    };
  }
  const evidence_refs = entries.map((e) => e.derived.evidence_ref);
  const count = entries.length
    ? entries.reduce((n, e) => n + e.source.traversals.length, 0)
    : null;
  const allTraversals = entries.flatMap((e) => e.source.traversals);
  const duration =
    entries.length && allTraversals.length
      ? allTraversals.reduce((n, t) => n + t.traversal_time_s, 0)
      : null;
  const stopped = sumStrict(allTraversals.map((t) => t.stopped_time_s));
  const distance = sumStrict(
    derived.map((d) =>
      d.input && d.input.traversals.length
        ? d.input.traversals.reduce((n, t) => n + t.distance_m, 0)
        : null,
    ),
  );
  const nextDurations = scenarios.flatMap((s) =>
    s ? s.traversals.map((t) => t.scenario_traversal_time_s) : [null],
  );
  const nextDuration = nextDurations.some((t) => t !== null && t <= 0)
    ? null
    : sumStrict(nextDurations);
  const limitations = [
    ...new Set([
      ...derived.flatMap((d) => d.reasons),
      ...scenarios.flatMap((s) => s?.limitations ?? []),
      "Timing uses a session anchor plus media time; it is estimated source UTC, not verified capture UTC.",
      "Crossing counts and general observation-minute stopped seconds are separate from this completed cohort.",
      "No accepted camera calibration or class mix is supplied by this software itself.",
    ]),
  ];
  if (!entries.length)
    limitations.unshift(
      "No retained completed-traversal measurement snapshots in this window.",
    );
  const scenario: MeasurementScenarioView = {
    available:
      pollutants.co2.scenario_g !== null && pollutants.nox.scenario_g !== null,
    pollutants,
    completed_cohort: {
      count,
      baseline: {
        distance_m: distance,
        traversal_time_s: duration,
        stopped_time_s: stopped,
      },
      scenario: {
        distance_m: distance,
        traversal_time_s: nextDuration,
        stopped_time_s:
          stopped === null ? null : stopped * (1 - reduction / 100),
      },
    },
    evidence_refs,
    assumptions: [
      `Hypothetical stopped-time reduction: ${reduction}%.`,
      ...entries.map(
        (entry) =>
          `Retained assumptions for ${entry.source.minute}: temperature ${entry.source.meteorology.temperature_f} °F; relative humidity ${entry.source.meteorology.relative_humidity_pct}%. Calibration ${entry.source.calibration_version ?? "unavailable"}; class mapping ${entry.source.mapping_version ?? "unavailable"}.`,
      ),
      "Original completed cohort, movement distances, visual-class mixture, meteorology and RUNEX factor catalog held constant.",
      "Each vehicle is recalculated before summing; signed differences may increase emissions.",
      "No extra idle process, EV discount or statistical confidence interval.",
    ],
    limitations,
  };
  return {
    camera_id: input.cameraId,
    mode: input.mode,
    from,
    to,
    registry: registryStatus(registry, input.cameraId, input.mode, input.now),
    minutes,
    scenario,
    evidence_refs,
    limitations,
  };
}
/** Private evidence is available only behind the authenticated handler. */
export function read_measurement_evidence(reference: string): unknown {
  if (!/^[a-f0-9]{64}$/.test(reference))
    throw new IngestError("Invalid evidence reference.", 400);
  const snapshot = localSnapshot(),
    registry = loadRegistry();
  const entry = snapshot.measurement_batches?.find(
    (e) => e.derived.evidence_ref === reference,
  );
  if (!entry) throw new IngestError("Evidence reference is not retained.", 404);
  return {
    evidence_ref: reference,
    current:
      !entry.source.retract &&
      entry.derived.registry_digest === registry.digest &&
      entry.derived.dependency_key ===
        dependencyState(entry.source, snapshot).key,
    source: entry.source,
    source_digest: entry.source_digest,
    registry_digest: entry.derived.registry_digest,
    dependency_key: entry.derived.dependency_key,
    accepted_at: entry.accepted_at,
    superseded: entry.superseded,
    calculation: entry.derived.calculation,
    approved_input: entry.derived.input,
  };
}
