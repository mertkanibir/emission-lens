import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  parseMeasurementBatch,
  type MeasurementBatch,
} from "../../contracts/src/measurement.ts";
import { type WorkerBatch } from "../../contracts/src/ingest.ts";
import { draft_brief } from "../src/brief.ts";
import { ingestWorkerBatch } from "../src/ingest.ts";
import {
  handleMeasurementEvidenceGet,
  handleMeasurementGet,
  handleMeasurementPost,
  handleMeasurementRefreshPost,
} from "../src/measurement-http.ts";
import {
  ingest_measurement_batch,
  read_measurement_window,
  refresh_measurements,
} from "../src/measurements.ts";
import {
  IngestError,
  readSnapshot,
  readWorkerStore,
} from "../src/persistence.ts";
import { get_emissions_window, get_traffic_window } from "../src/queries.ts";
import {
  parseRegistry,
  registryStatus,
  loadRegistry,
} from "../src/registry.ts";
import { compare_scenario } from "../src/scenario.ts";
import factors from "../../emissions/data/la-2026/factors.json";

const NOW = new Date("2026-11-07T20:05:00Z");
const TOKEN = "controlled-test-token-not-a-service-credential-0000";
function registry() {
  const approval = {
    status: "approved",
    reviewed_by: "Mert",
    reviewed_at: "2026-11-07T19:00:00Z",
    evidence_refs: ["synthetic-test-only"],
    modes: ["synthetic"],
  };
  return {
    registry_version: "1.0",
    revision: "synthetic-only-v1",
    calibrations: [
      {
        camera_id: "222",
        version: "test-cal",
        approval: structuredClone(approval),
        valid_from: "2026-11-07T19:00:00Z",
        valid_to: null as string | null,
        calibration: {
          camera_id: "222",
          version: "test-cal",
          validation_status: "valid",
          gates: { entry: { synthetic: true }, exit: { synthetic: true } },
          reference_measurements: { source: "synthetic-only" },
          transform: [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
          ],
        },
        movements: [
          {
            movement_id: "test-movement",
            entry_gate_id: "entry",
            exit_gate_id: "exit",
            distance_m: 1609.344,
            distance_units: "m",
            evidence_refs: ["synthetic-mile-only"],
          },
        ],
      },
    ],
    mappings: [
      {
        version: "test-mix",
        approval: structuredClone(approval),
        region: "Los Angeles (SC)",
        calendar_year: 2026,
        mapping: {
          version: "test-mix",
          evidence:
            "Synthetic arithmetic assumes LDA, not a production mapping.",
          classes: { car: [{ emfac_class: "LDA", vmt_share: 1 }] },
        },
      },
    ],
  };
}
function batch(): MeasurementBatch {
  return {
    measurement_version: "1.0",
    batch_id: randomUUID(),
    revision: 0,
    run: {
      run_id: "synthetic-measurement-test",
      model_version: "test-only",
      device: "test-only",
      started_at: "2026-11-07T19:58:00Z",
      ended_at: null,
      mode: "synthetic",
    },
    camera_id: "222",
    mode: "synthetic",
    minute: "2026-11-07T20:04:00Z",
    calibration_version: "test-cal",
    mapping_version: "test-mix",
    units: { distance: "m", time: "s" },
    timing: {
      basis: "estimated_hls_media_utc",
      clock_method: "hls-min-anchor-v1",
      sessions: [
        {
          session_id: "private-session-test",
          anchor_utc: "2026-11-07T19:58:30Z",
        },
      ],
    },
    meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
    observation_ref: null,
    observations: [
      {
        vehicle_class: "car",
        count: 3,
        stopped_vehicle_seconds: 900,
        queue_count: 4,
        coverage: 0.5,
      },
    ],
    traversals: [
      {
        session_id: "private-session-test",
        traversal_id: "private-traversal-test",
        movement_id: "test-movement",
        completed_at: "2026-11-07T20:04:30Z",
        entry_media_s: 0,
        exit_media_s: 360,
        traversal_time_s: 360,
        stopped_time_s: 180,
        vehicle_class: "car",
      },
    ],
    retract: false,
  };
}
async function isolated(
  work: (state: {
    path: string;
    registryPath: string;
    install: (value: unknown) => void;
  }) => Promise<void>,
) {
  const keys = [
    "EMISSION_LENS_STORE_PATH",
    "EMISSION_LENS_REGISTRY_PATH",
    "EMISSION_LENS_WORKER_TOKEN",
  ] as const;
  const previous = keys.map((k) => process.env[k]);
  const dir = mkdtempSync(join(tmpdir(), "emission-measurement-test-"));
  const path = join(dir, "snapshot.json"),
    registryPath = join(dir, "registry.json");
  process.env.EMISSION_LENS_STORE_PATH = path;
  process.env.EMISSION_LENS_REGISTRY_PATH = registryPath;
  process.env.EMISSION_LENS_WORKER_TOKEN = TOKEN;
  const install = (value: unknown) =>
    writeFileSync(registryPath, JSON.stringify(value));
  install(registry());
  try {
    await work({ path, registryPath, install });
  } finally {
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
    rmSync(dir, { recursive: true, force: true });
  }
}
const code = (status: number) => (error: unknown) =>
  error instanceof IngestError && error.status === status;
const read = () =>
  read_measurement_window({
    cameraId: "222",
    mode: "synthetic",
    now: NOW,
    stoppedTimeReductionPct: 20,
  });
const request = (value: unknown, authenticated = true) =>
  new Request("http://localhost/api/measurements", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: JSON.stringify(value),
  });
const evidenceRequest = (reference: string) =>
  handleMeasurementEvidenceGet(
    new Request(
      `http://localhost/api/measurements/evidence?reference=${reference}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    ),
  );

// These approvals exist only in a temporary synthetic namespace; no camera is activated.
test("authenticated ingest persists one atomic source/traffic/pollutant/evidence snapshot and binds scenarios and briefs", () =>
  isolated(async ({ path }) => {
    const source = batch(),
      result = await ingest_measurement_batch(source, NOW);
    assert.equal(result.state, "ready");
    assert.equal(result.duplicate, false);
    const saved = readSnapshot(path);
    assert.equal(saved.measurement_batches!.length, 1);
    assert.equal(saved.batches.length, 0);
    assert.equal(saved.measurement_batches![0].derived.emissions.length, 2);
    const bytes = readFileSync(path, "utf8");
    assert.ok(!bytes.includes("private-session-test"));
    assert.ok(!bytes.includes("private-traversal-test"));
    const co2 = factors.factors.find(
      (r) =>
        r.vehicle_class === "LDA" &&
        r.pollutant === "co2" &&
        r.speed_bin_mph === 10 &&
        r.temperature_f === 70 &&
        r.relative_humidity_pct === 60,
    )!.source_g_per_vehicle_mile;
    const nextCo2 = factors.factors.find(
      (r) =>
        r.vehicle_class === "LDA" &&
        r.pollutant === "co2" &&
        r.speed_bin_mph === 15 &&
        r.temperature_f === 70 &&
        r.relative_humidity_pct === 60,
    )!.source_g_per_vehicle_mile;
    const traffic = get_traffic_window({
      cameraId: "222",
      mode: "synthetic",
      now: NOW,
    });
    assert.equal(traffic.totals.count, 3);
    assert.equal(traffic.totals.stopped_vehicle_seconds, 900);
    assert.equal(traffic.totals.distance_m, 1609.344);
    const emissions = get_emissions_window({
      cameraId: "222",
      mode: "synthetic",
      now: NOW,
    });
    assert.ok(Math.abs(emissions.estimate_g_by_pollutant.co2! - co2) < 1e-8);
    const view = read();
    assert.equal(view.minutes.length, 1);
    assert.equal(view.scenario.completed_cohort.count, 1);
    assert.equal(view.scenario.completed_cohort.baseline.stopped_time_s, 180);
    assert.equal(view.scenario.completed_cohort.scenario.traversal_time_s, 324);
    assert.ok(
      Math.abs(view.scenario.pollutants.co2.scenario_g! - nextCo2) < 1e-8,
    );
    assert.equal(view.scenario.pollutants.co2.change_g, nextCo2 - co2);
    assert.equal(view.scenario.pollutants.nox.scenario_g !== null, true);
    const scenario = compare_scenario({
      cameraId: "222",
      mode: "synthetic",
      now: NOW,
      stoppedTimeReductionPct: 20,
    });
    assert.deepEqual(scenario.pollutants, view.scenario.pollutants);
    assert.equal(scenario.scenario.traversal_time_s, 324);
    const brief = draft_brief({ cameraId: "222", mode: "synthetic", now: NOW });
    assert.match(brief.text, /Estimated CO2: baseline/);
    assert.match(brief.text, /Estimated NOx: baseline/);
    assert.ok(brief.evidence_references.includes(result.evidence_ref));
    const publicJson = JSON.stringify([view, scenario, brief]);
    assert.ok(!publicJson.includes("session_id"));
    assert.ok(!publicJson.includes("traversal_id"));
    assert.ok(!publicJson.includes(path));
    assert.equal(
      get_traffic_window({ cameraId: "222", mode: "live", now: NOW }).totals
        .count,
      null,
    );
    assert.equal(
      get_traffic_window({ cameraId: "222", mode: "replay", now: NOW }).totals
        .count,
      null,
    );
  }));
test("exact source retries are idempotent; corrections, minute moves and retractions replace all dependents", () =>
  isolated(async ({ path }) => {
    const source = batch();
    await ingest_measurement_batch(source, NOW);
    const before = readFileSync(path, "utf8");
    assert.equal(
      (await ingest_measurement_batch(structuredClone(source), NOW)).duplicate,
      true,
    );
    assert.equal(readFileSync(path, "utf8"), before);
    const changed = structuredClone(source);
    changed.observations[0].count = 9;
    await assert.rejects(ingest_measurement_batch(changed, NOW), code(409));
    assert.equal(readFileSync(path, "utf8"), before);
    changed.revision = 1;
    changed.minute = "2026-11-07T20:03:00Z";
    changed.timing.sessions[0].anchor_utc = "2026-11-07T19:57:30Z";
    changed.traversals[0].completed_at = "2026-11-07T20:03:30Z";
    const correction = await ingest_measurement_batch(changed, NOW);
    assert.notEqual(
      correction.evidence_ref,
      readSnapshot(path).measurement_batches![0].superseded[0].source_digest,
    );
    assert.deepEqual(
      read().minutes.map((m) => m.minute),
      ["2026-11-07T20:03:00.000Z"],
    );
    assert.equal(readWorkerStore().traffic[0].count, 9);
    assert.equal(
      readSnapshot(path).measurement_batches![0].superseded.length,
      1,
    );
    await assert.rejects(ingest_measurement_batch(source, NOW), code(409));
    changed.revision = 2;
    changed.retract = true;
    changed.traversals = [];
    changed.observations = [];
    await ingest_measurement_batch(changed, NOW);
    assert.deepEqual(read().minutes, []);
    assert.equal(read().scenario.pollutants.co2.baseline_g, null);
    assert.equal(readWorkerStore().traffic.length, 0);
    assert.equal(
      get_traffic_window({ cameraId: "222", mode: "synthetic", now: NOW })
        .totals.count,
      null,
    );
  }));
test("overlapping runs/batches conflict, retracted ownership can be replaced, and run provenance is immutable", () =>
  isolated(async () => {
    const source = batch();
    await ingest_measurement_batch(source, NOW);
    const overlap = batch();
    await assert.rejects(ingest_measurement_batch(overlap, NOW), code(409));
    overlap.run.run_id = "restarted-run";
    await assert.rejects(ingest_measurement_batch(overlap, NOW), code(409));
    const provenance = structuredClone(source);
    provenance.revision = 1;
    provenance.run.model_version = "changed";
    await assert.rejects(ingest_measurement_batch(provenance, NOW), code(409));
    const retract = {
      ...source,
      revision: 1,
      retract: true,
      traversals: [],
      observations: [],
    };
    await ingest_measurement_batch(retract, NOW);
    await ingest_measurement_batch(overlap, NOW);
    assert.equal(read().minutes.length, 1);
  }));
test("server approval is mode/time/version scoped and missing or malformed registries preserve observations", () =>
  isolated(async ({ install, registryPath }) => {
    const source = batch();
    delete process.env.EMISSION_LENS_REGISTRY_PATH;
    await ingest_measurement_batch(source, NOW);
    assert.equal(read().registry.state, "missing");
    assert.equal(read().minutes[0].traffic[0].count, 3);
    assert.equal(read().scenario.pollutants.co2.baseline_g, null);
    process.env.EMISSION_LENS_REGISTRY_PATH = registryPath;
    const doc = registry();
    doc.calibrations[0].approval.modes = ["live"];
    install(doc);
    await refresh_measurements(NOW);
    assert.equal(read().registry.physical_calibration_approved, false);
    assert.equal(read().scenario.pollutants.co2.baseline_g, null);
    doc.calibrations[0].approval.modes = ["synthetic"];
    doc.calibrations[0].valid_to = "2026-11-07T20:00:00Z";
    install(doc);
    await refresh_measurements(NOW);
    assert.equal(read().registry.physical_calibration_approved, false);
    assert.equal(read().minutes[0].traffic[0].distance_m, null);
    writeFileSync(registryPath, "not-json");
    assert.equal(read().registry.state, "invalid");
    assert.equal(read().minutes[0].traffic[0].queue_count, 4);
    assert.equal(
      read().minutes[0].emissions.every((r) => r.estimate_g === null),
      true,
    );
  }));
test("revocation immediately invalidates cached rows and scenarios; exact source retry refreshes only server derivation", () =>
  isolated(async ({ install }) => {
    const source = batch();
    const initial = await ingest_measurement_batch(source, NOW);
    const cached = readWorkerStore();
    assert.equal(cached.emissions[0].quality_state, "ok");
    const revoked = registry();
    revoked.revision = "revoked";
    revoked.calibrations[0].approval.status = "rejected";
    install(revoked);
    assert.notEqual(readWorkerStore(), cached);
    assert.equal(
      readWorkerStore().emissions.every((r) => r.estimate_g === null),
      true,
    );
    assert.equal(readWorkerStore().traffic[0].distance_m, null);
    assert.equal(read().scenario.pollutants.co2.baseline_g, null);
    const result = await ingest_measurement_batch(source, NOW);
    assert.equal(result.duplicate, true);
    assert.notEqual(result.evidence_ref, initial.evidence_ref);
    assert.equal(result.state, "unavailable");
    install(registry());
    assert.equal((await refresh_measurements(NOW)).refreshed, 1);
    assert.equal(read().scenario.available, true);
    assert.equal(readWorkerStore().traffic[0].count, 3);
  }));
test("linked legacy observations survive completion replacement, and observation revisions invalidate and refresh physics atomically", () =>
  isolated(async ({ path }) => {
    const source = batch();
    const legacy: WorkerBatch = {
      contract_version: "1.1",
      batch_id: randomUUID(),
      revision: 0,
      run: source.run,
      statuses: [],
      traffic: [
        {
          camera_id: "222",
          minute: source.minute,
          mode: source.mode,
          run_id: source.run.run_id,
          vehicle_class: "car",
          count: 7,
          stopped_vehicle_seconds: 1200,
          queue_count: 2,
          queue_length_m: null,
          coverage: 0.4,
          completed_traversals: null,
          traversal_time_s: null,
          distance_m: null,
        },
      ],
      emissions: [],
    };
    ingestWorkerBatch(legacy, NOW);
    source.observations = [];
    source.observation_ref = { batch_id: legacy.batch_id, revision: 0 };
    await ingest_measurement_batch(source, NOW);
    assert.equal(readWorkerStore().traffic[0].count, 7);
    assert.equal(readWorkerStore().traffic[0].completed_traversals, 1);
    assert.equal(readWorkerStore().emissions[0].quality_state, "ok");
    legacy.revision = 1;
    legacy.traffic[0].count = 8;
    ingestWorkerBatch(legacy, NOW);
    const invalid = readSnapshot(path).measurement_batches![0].derived;
    assert.equal(invalid.state, "unavailable");
    assert.equal(
      invalid.emissions.every((e) => e.estimate_g === null),
      true,
    );
    assert.equal(readWorkerStore().traffic[0].count, 8);
    assert.equal(read().scenario.available, false);
    source.revision = 1;
    source.observation_ref.revision = 1;
    await ingest_measurement_batch(source, NOW);
    assert.equal(read().scenario.available, true);
    source.revision = 2;
    source.retract = true;
    source.traversals = [];
    await ingest_measurement_batch(source, NOW);
    assert.equal(readWorkerStore().traffic[0].count, 8);
    assert.equal(readWorkerStore().traffic[0].completed_traversals, null);
    assert.equal(readWorkerStore().emissions.length, 0);
  }));
test("advancing observation generations retire old evidence and current HTTP evidence equals a fresh snapshot reload", () =>
  isolated(async ({ path }) => {
    const source = batch();
    const observed: WorkerBatch = {
      contract_version: "1.1",
      batch_id: randomUUID(),
      revision: 0,
      run: source.run,
      statuses: [],
      traffic: [{
        camera_id: source.camera_id, minute: source.minute, mode: source.mode,
        run_id: source.run.run_id, vehicle_class: "car", count: 3,
        stopped_vehicle_seconds: 900, queue_count: 4, queue_length_m: null,
        coverage: 0.5, completed_traversals: null, traversal_time_s: null,
        distance_m: null,
      }],
      emissions: [],
    };
    ingestWorkerBatch(observed, NOW);
    source.observations = [];
    source.observation_ref = { batch_id: observed.batch_id, revision: 0 };
    const first = await ingest_measurement_batch(source, NOW);
    assert.equal((await evidenceRequest(first.evidence_ref)).status, 200);

    // A linked worker revision rederives measurements in the same atomic write.
    // Frozen references are not durable aliases to a newer evidence generation.
    observed.revision++;
    observed.traffic[0].count = 4;
    ingestWorkerBatch(observed, NOW);
    assert.equal((await evidenceRequest(first.evidence_ref)).status, 404);
    const intermediate = await (await evidenceRequest(read().evidence_refs[0])).json();
    assert.equal(intermediate.current, true);
    assert.equal(intermediate.approved_input, null);
    assert.ok(intermediate.calculation.rows.every((row: { estimate_g: number | null }) => row.estimate_g === null));

    source.revision++;
    source.observation_ref.revision = observed.revision;
    const next = await ingest_measurement_batch(source, NOW);
    const publicResponse = await handleMeasurementGet(new Request(
      "http://localhost/api/measurements?camera=222&mode=synthetic&reduce=20",
    ));
    const publicView = await publicResponse.json();
    assert.deepEqual(publicView.evidence_refs, [next.evidence_ref]);
    const http = await evidenceRequest(next.evidence_ref);
    assert.equal(http.status, 200);
    assert.equal(http.headers.get("cache-control"), "no-store");
    const current = await http.json();
    assert.equal(current.current, true);
    assert.equal(current.source.observation_ref.revision, observed.revision);
    assert.equal(current.approved_input.traversals.length, 1);
    assert.deepEqual(current.source, readSnapshot(path).measurement_batches![0].source);
    const frozenPath = path + ".frozen";
    writeFileSync(frozenPath, readFileSync(path), { mode: 0o600 });
    const moduleUrl = new URL("../src/measurements.ts", import.meta.url).href;
    const child = spawnSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
      `import {read_measurement_evidence,read_measurement_window} from ${JSON.stringify(moduleUrl)};
       console.log(JSON.stringify({evidence:read_measurement_evidence(process.argv[1]),view:read_measurement_window({cameraId:"222",mode:"synthetic",stoppedTimeReductionPct:20})}));`,
      next.evidence_ref,
    ], { env: { ...process.env, EMISSION_LENS_STORE_PATH: frozenPath }, encoding: "utf8" });
    assert.equal(child.status, 0, child.stderr);
    const reloaded = JSON.parse(child.stdout);
    assert.deepEqual(reloaded.evidence, current);
    assert.deepEqual(reloaded.view, publicView);

    // A matching revision alone cannot approve evidence from another camera.
    observed.revision++;
    observed.traffic[0].camera_id = "223";
    ingestWorkerBatch(observed, NOW);
    source.revision++;
    source.observation_ref.revision = observed.revision;
    const wrongSource = await ingest_measurement_batch(source, NOW);
    const invalid = await (await evidenceRequest(wrongSource.evidence_ref)).json();
    assert.equal(invalid.current, true);
    assert.equal(invalid.approved_input, null);
    assert.ok(invalid.calculation.rows.every((row: { estimate_g: number | null }) => row.estimate_g === null));
    assert.equal(read().scenario.available, false);
  }));

test("authenticated stale evidence cannot make revoked or unapproved physics current", () =>
  isolated(async ({ install }) => {
    const source = batch();
    const initial = await ingest_measurement_batch(source, NOW);
    const revoked = registry();
    revoked.calibrations[0].approval.status = "rejected";
    install(revoked);
    const stale = await (await evidenceRequest(initial.evidence_ref)).json();
    assert.equal(stale.current, false);
    assert.equal(read().scenario.available, false);
    await refresh_measurements(NOW);
    assert.equal((await evidenceRequest(initial.evidence_ref)).status, 404);
    const unavailable = await (await evidenceRequest(read().evidence_refs[0])).json();
    assert.equal(unavailable.current, true);
    assert.equal(unavailable.approved_input, null);
    assert.ok(unavailable.calculation.rows.every((row: { estimate_g: number | null }) => row.estimate_g === null));
    const unapproved = registry();
    unapproved.calibrations[0].approval.status = "pending";
    install(unapproved);
    await refresh_measurements(NOW);
    const pending = await (await evidenceRequest(read().evidence_refs[0])).json();
    assert.equal(pending.approved_input, null);
    assert.equal(read().scenario.pollutants.co2.baseline_g, null);
    assert.equal(read().scenario.pollutants.co2.scenario_g, null);
  }));

test("missing linked stop evidence withholds nonzero scenarios, never subtracts general minute stopped seconds", () =>
  isolated(async () => {
    const source = batch();
    source.traversals[0].stopped_time_s = null;
    await ingest_measurement_batch(source, NOW);
    assert.notEqual(read().scenario.pollutants.co2.baseline_g, null);
    assert.equal(read().scenario.pollutants.co2.scenario_g, null);
    assert.equal(
      read().scenario.completed_cohort.scenario.traversal_time_s,
      null,
    );
    const zero = read_measurement_window({
      cameraId: "222",
      mode: "synthetic",
      now: NOW,
      stoppedTimeReductionPct: 0,
    });
    assert.equal(
      zero.scenario.pollutants.co2.baseline_g,
      zero.scenario.pollutants.co2.scenario_g,
    );
  }));

test("explicit complete-minute selection labels its cohort and preserves zero, unavailable minutes and default-hour nulls", () =>
  isolated(async ({ path }) => {
    const source = batch();
    source.traversals[0].stopped_time_s = 0;
    await ingest_measurement_batch(source, NOW);
    const selection = { cameraId: "222", mode: "synthetic" as const, now: NOW,
      from: "2026-11-07T20:04:00+00:00", to: "2026-11-07T20:05:00Z", stoppedTimeReductionPct: 20 };
    const selected = read_measurement_window(selection);
    assert.equal(selected.scope, "explicit_window");
    assert.equal(selected.from, "2026-11-07T20:04:00.000Z");
    assert.equal(selected.to, "2026-11-07T20:05:00.000Z");
    assert.equal(selected.scenario.completed_cohort.count, 1);
    assert.equal(selected.scenario.completed_cohort.baseline.stopped_time_s, 0);
    assert.equal(selected.scenario.pollutants.co2.change_g, 0);
    assert.ok(selected.scenario.pollutants.co2.baseline_g! > 0);
    assert.ok(selected.limitations.some((text) => /not the reporting hour/.test(text)));
    assert.ok(selected.scenario.assumptions.some((text) => /end exclusive/.test(text)));

    const missingMinute = read_measurement_window({ ...selection, from: "2026-11-07T20:03:00Z" });
    assert.equal(missingMinute.minutes.length, 1);
    assert.equal(missingMinute.scenario.completed_cohort.count, null);
    assert.equal(missingMinute.scenario.pollutants.co2.baseline_g, null);
    assert.equal(missingMinute.scenario.pollutants.co2.scenario_g, null);
    assert.ok(missingMinute.limitations.some((text) => /1 selected minute/.test(text)));
    const empty = read_measurement_window({ ...selection, from: "2026-11-07T20:02:00Z", to: "2026-11-07T20:03:00Z" });
    assert.equal(empty.scenario.pollutants.co2.baseline_g, null);
    assert.equal(empty.scenario.completed_cohort.count, null);

    const unknown = structuredClone(source);
    unknown.batch_id = randomUUID();
    unknown.minute = "2026-11-07T20:03:00Z";
    unknown.timing.sessions[0].anchor_utc = "2026-11-07T19:57:30Z";
    unknown.traversals[0].completed_at = "2026-11-07T20:03:30Z";
    unknown.traversals[0].traversal_id = "separate-unmapped-candidate";
    unknown.traversals[0].vehicle_class = "unknown";
    await ingest_measurement_batch(unknown, NOW);
    const full = read();
    assert.equal(full.scope, "reporting_hour");
    assert.equal(full.minutes.length, 2);
    assert.equal(full.scenario.pollutants.co2.baseline_g, null);
    assert.equal(full.scenario.pollutants.co2.scenario_g, null);
    const includesUnknown = read_measurement_window({ ...selection, from: "2026-11-07T20:03:00Z" });
    assert.equal(includesUnknown.minutes.length, 2);
    assert.equal(includesUnknown.scenario.pollutants.co2.baseline_g, null);
    assert.equal(includesUnknown.scenario.pollutants.co2.scenario_g, null);
    assert.equal(read_measurement_window(selection).scenario.pollutants.co2.change_g, 0);
    const query = new URLSearchParams({ camera: "222", mode: "synthetic", reduce: "20", from: selection.from, to: selection.to });
    const before = readFileSync(path);
    const response = await handleMeasurementGet(new Request("http://localhost/api/measurements?" + query));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), read_measurement_window(selection));
    assert.deepEqual(readFileSync(path), before);
    const live = read_measurement_window({ ...selection, mode: "live" });
    assert.equal(live.minutes.length, 0);
    assert.equal(live.scenario.pollutants.co2.baseline_g, null);
  }));

test("explicit selection rejects partial, future, overlong, expired and malformed ranges without changing evidence", () =>
  isolated(async ({ path, install }) => {
    await ingest_measurement_batch(batch(), NOW);
    const before = readFileSync(path);
    const invalid: Array<{ from?: string; to?: string }> = [
      { from: "2026-11-07T20:04:00Z" }, { to: "2026-11-07T20:05:00Z" },
      { from: "", to: "2026-11-07T20:05:00Z" },
      { from: "2026-11-07T20:04:01Z", to: "2026-11-07T20:05:00Z" },
      { from: "2026-11-07T20:04:00.000001Z", to: "2026-11-07T20:05:00Z" },
      { from: "2026-11-07T15:04:00-05:00", to: "2026-11-07T20:05:00Z" },
      { from: "2026-11-07T20:05:00Z", to: "2026-11-07T20:05:00Z" },
      { from: "2026-11-07T20:05:00Z", to: "2026-11-07T20:04:00Z" },
      { from: "2026-11-07T20:04:00Z", to: "2026-11-07T20:06:00Z" },
      { from: "2026-11-07T19:04:00Z", to: "2026-11-07T20:05:00Z" },
      { from: "2026-11-06T20:04:00Z", to: "2026-11-06T20:05:00Z" },
    ];
    for (const range of invalid) {
      assert.throws(() => read_measurement_window({ cameraId: "222", mode: "synthetic", now: NOW, ...range }), code(400));
      const query = new URLSearchParams({ camera: "222", mode: "synthetic", ...range });
      assert.equal((await handleMeasurementGet(new Request("http://localhost/api/measurements?" + query))).status, 400);
    }
    assert.equal((await handleMeasurementGet(new Request(
      "http://localhost/api/measurements?camera=222&mode=synthetic&from=2026-11-07T20:04:00Z&from=2026-11-07T20:03:00Z&to=2026-11-07T20:05:00Z",
    ))).status, 400);
    const valid = { cameraId: "222", mode: "synthetic" as const, now: NOW, from: "2026-11-07T20:04:00Z", to: "2026-11-07T20:05:00Z" };
    assert.equal(read_measurement_window({ ...valid, from: "2026-11-07T19:05:00Z" }).scope, "explicit_window");
    assert.equal(read_measurement_window({ ...valid, from: "2026-11-06T20:05:00Z", to: "2026-11-06T20:06:00Z" }).minutes.length, 0);
    const pending = registry();
    pending.calibrations[0].approval.status = "pending";
    install(pending);
    assert.equal(read_measurement_window(valid).scenario.pollutants.co2.baseline_g, null);
    assert.equal(read_measurement_window(valid).scenario.pollutants.co2.scenario_g, null);
    assert.deepEqual(readFileSync(path), before);
  }));
test("unknown classes, movements and empty cohorts never become partial or zero grams", () =>
  isolated(async () => {
    const source = batch();
    source.traversals[0].vehicle_class = "unknown";
    await ingest_measurement_batch(source, NOW);
    assert.equal(read().scenario.pollutants.co2.baseline_g, null);
    source.revision++;
    source.traversals[0].vehicle_class = "car";
    source.traversals[0].movement_id = "unapproved-movement";
    await ingest_measurement_batch(source, NOW);
    assert.equal(read().minutes[0].traffic[0].distance_m, null);
    source.revision++;
    source.traversals = [];
    await ingest_measurement_batch(source, NOW);
    assert.equal(
      read().minutes[0].emissions.every(
        (r) =>
          r.quality_state === "insufficient_evidence" && r.estimate_g === null,
      ),
      true,
    );
    assert.equal(read().minutes[0].traffic[0].count, 3);
  }));
test("parser rejects unsupported approval/distance/identity fields and inconsistent timing before any mutation", () =>
  isolated(async ({ path }) => {
    const source = batch();
    await ingest_measurement_batch(source, NOW);
    const before = readFileSync(path, "utf8");
    const cases: Array<(b: MeasurementBatch) => void> = [
      (b) => Object.assign(b, { calibration_valid: true }),
      (b) => Object.assign(b.traversals[0], { distance_m: 10 }),
      (b) => {
        b.units.distance = "px" as never;
      },
      (b) => {
        b.traversals[0].exit_media_s = 350;
      },
      (b) => {
        b.traversals[0].completed_at = "2026-11-07T20:04:31Z";
      },
      (b) => {
        b.traversals[0].stopped_time_s = 361;
      },
      (b) => {
        b.traversals.push(structuredClone(b.traversals[0]));
      },
      (b) => {
        b.timing.sessions = [];
      },
      (b) => {
        b.retract = true;
      },
      (b) => {
        b.observations[0].coverage = NaN;
      },
      (b) => {
        b.traversals[0].vehicle_class = "person" as never;
      },
    ];
    for (const mutate of cases) {
      const bad = batch();
      mutate(bad);
      assert.throws(() => parseMeasurementBatch(bad));
      await assert.rejects(ingest_measurement_batch(bad, NOW), code(400));
      assert.equal(readFileSync(path, "utf8"), before);
    }
  }));
test("registry validation rejects fake units/reviews/mixtures/singular matrices and preserves homography scale", () => {
  for (const scale of [1, 1e-8, -1e8]) {
    const doc = registry();
    doc.calibrations[0].calibration.transform =
      doc.calibrations[0].calibration.transform.map((row) =>
        row.map((v) => v * scale),
      );
    assert.doesNotThrow(() => parseRegistry(doc));
  }
  for (const mutate of [
    (d: ReturnType<typeof registry>) => {
      d.calibrations[0].calibration.transform = [
        [1, 2, 3],
        [1, 2, 3],
        [0, 0, 1],
      ];
    },
    (d: ReturnType<typeof registry>) => {
      d.calibrations[0].movements[0].distance_units = "px";
    },
    (d: ReturnType<typeof registry>) => {
      d.calibrations[0].approval.evidence_refs = [];
    },
    (d: ReturnType<typeof registry>) => {
      d.mappings[0].mapping.classes.car[0].vmt_share = 0.5;
    },
    (d: ReturnType<typeof registry>) => {
      d.calibrations.push(structuredClone(d.calibrations[0]));
    },
  ]) {
    const doc = registry();
    mutate(doc);
    assert.throws(() => parseRegistry(doc));
  }
});
test("corrupt measurement evidence fails closed rather than serving cached numerical values", () =>
  isolated(async ({ path }) => {
    await ingest_measurement_batch(batch(), NOW);
    const saved = JSON.parse(readFileSync(path, "utf8"));
    saved.measurement_batches[0].derived.emissions[0].estimate_g = 0;
    writeFileSync(path, JSON.stringify(saved));
    assert.throws(() => readWorkerStore(), code(503));
    assert.throws(read, code(503));
  }));
test("HTTP handlers authenticate private operations, enforce body/query bounds and return public summaries without identities", () =>
  isolated(async () => {
    assert.equal(
      (await handleMeasurementPost(request(batch(), false))).status,
      401,
    );
    const invalid = batch();
    Object.assign(invalid, { distance_m: 42 });
    assert.equal((await handleMeasurementPost(request(invalid))).status, 400);
    const large = new Request("http://localhost/api/measurements", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: '"' + "x".repeat(1_048_576) + '"',
    });
    assert.equal((await handleMeasurementPost(large)).status, 413);
    const source = batch();
    await ingest_measurement_batch(source, NOW);
    const summary = await handleMeasurementGet(
      new Request(
        "http://localhost/api/measurements?camera=222&mode=synthetic&reduce=20",
      ),
    );
    assert.equal(summary.status, 200);
    assert.equal(summary.headers.get("cache-control"), "no-store");
    const publicText = await summary.text();
    assert.ok(!publicText.includes("session_id"));
    const reference = read().evidence_refs[0];
    assert.equal(
      (
        await handleMeasurementEvidenceGet(
          new Request(
            `http://localhost/api/measurements/evidence?reference=${reference}`,
          ),
        )
      ).status,
      401,
    );
    const evidence = await handleMeasurementEvidenceGet(
      new Request(
        `http://localhost/api/measurements/evidence?reference=${reference}`,
        { headers: { Authorization: `Bearer ${TOKEN}` } },
      ),
    );
    assert.equal(evidence.status, 200);
    const value = await evidence.json();
    assert.equal(value.current, true);
    assert.equal(value.calculation.evidence.length, 1);
    assert.equal(
      (
        await handleMeasurementGet(
          new Request(
            "http://localhost/api/measurements?camera=222&reduce=bad",
          ),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await handleMeasurementGet(
          new Request(
            "http://localhost/api/measurements?camera=222&camera=223",
          ),
        )
      ).status,
      400,
    );
    const refreshRequest = new Request(
      "http://localhost/api/measurements/refresh",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: '{"approval":true}',
      },
    );
    assert.equal(
      (await handleMeasurementRefreshPost(refreshRequest)).status,
      400,
    );
  }));

test("mixed meteorology remains explicit per minute and in scenario/brief assumptions", () =>
  isolated(async () => {
    const first = batch();
    await ingest_measurement_batch(first, NOW);
    const second = batch();
    second.minute = "2026-11-07T20:03:00Z";
    second.timing.sessions[0].anchor_utc = "2026-11-07T19:57:30Z";
    second.traversals[0].completed_at = "2026-11-07T20:03:30Z";
    second.traversals[0].traversal_id = "another-private-traversal";
    second.meteorology.temperature_f = 80;
    await ingest_measurement_batch(second, NOW);
    const view = read();
    assert.deepEqual(
      view.minutes.map((m) => m.meteorology.temperature_f),
      [80, 70],
    );
    assert.ok(
      view.scenario.assumptions.some((s) =>
        s.includes("temperature 80 °F; relative humidity 60%"),
      ),
    );
    assert.ok(
      view.scenario.assumptions.some((s) =>
        s.includes("temperature 70 °F; relative humidity 60%"),
      ),
    );
    const brief = draft_brief({ cameraId: "222", mode: "synthetic", now: NOW });
    assert.match(brief.text, /temperature 80 °F; relative humidity 60%/);
    assert.match(brief.text, /temperature 70 °F; relative humidity 60%/);
  }));

test("measurement and legacy windows share an exclusive upper minute boundary", () =>
  isolated(async () => {
    const source = batch();
    source.minute = "2026-11-07T20:05:00Z";
    source.timing.sessions[0].anchor_utc = "2026-11-07T19:59:30Z";
    source.traversals[0].completed_at = "2026-11-07T20:05:30Z";
    await ingest_measurement_batch(source, NOW);
    assert.equal(readWorkerStore().traffic.length, 1);
    assert.equal(read().minutes.length, 0);
    assert.equal(
      get_traffic_window({ cameraId: "222", mode: "synthetic", now: NOW }).rows
        .length,
      0,
    );
    assert.equal(
      get_emissions_window({ cameraId: "222", mode: "synthetic", now: NOW })
        .rows.length,
      0,
    );
  }));
test("equivalent UTC spellings preserve independent legacy classes in the composed public minute", () =>
  isolated(async () => {
    const source = batch();
    const legacy: WorkerBatch = {
      contract_version: "1.1",
      batch_id: randomUUID(),
      revision: 0,
      run: source.run,
      statuses: [],
      traffic: [
        {
          camera_id: "222",
          minute: "2026-11-07T20:04:00+00:00",
          mode: source.mode,
          run_id: source.run.run_id,
          vehicle_class: "bus",
          count: 2,
          stopped_vehicle_seconds: null,
          queue_count: null,
          queue_length_m: null,
          coverage: null,
          completed_traversals: null,
          traversal_time_s: null,
          distance_m: null,
        },
      ],
      emissions: [],
    };
    ingestWorkerBatch(legacy, NOW);
    await ingest_measurement_batch(source, NOW);
    assert.equal(
      read().minutes[0].traffic.find((r) => r.vehicle_class === "bus")!.count,
      2,
    );
    assert.equal(
      get_traffic_window({ cameraId: "222", mode: "synthetic", now: NOW })
        .totals.count,
      5,
    );
  }));
test("completed identities cannot migrate to another batch/minute before old ownership is retracted", () =>
  isolated(async () => {
    const source = batch();
    await ingest_measurement_batch(source, NOW);
    const moved = batch();
    moved.minute = "2026-11-07T20:03:00Z";
    moved.timing.sessions[0].anchor_utc = "2026-11-07T19:57:30Z";
    moved.traversals[0].completed_at = "2026-11-07T20:03:30Z";
    await assert.rejects(ingest_measurement_batch(moved, NOW), code(409));
    const otherCamera = structuredClone(moved);
    otherCamera.batch_id = randomUUID();
    otherCamera.camera_id = "223";
    await ingest_measurement_batch(otherCamera, NOW);
    const otherRun = structuredClone(moved);
    otherRun.batch_id = randomUUID();
    otherRun.run.run_id = "separate-run";
    await ingest_measurement_batch(otherRun, NOW);
    otherRun.revision++;
    otherRun.retract = true;
    otherRun.observations = [];
    otherRun.traversals = [];
    await ingest_measurement_batch(otherRun, NOW);
    source.revision++;
    source.retract = true;
    source.observations = [];
    source.traversals = [];
    await ingest_measurement_batch(source, NOW);
    await ingest_measurement_batch(moved, NOW);
    assert.equal(read().minutes.length, 1);
  }));

test("measurement-only multi-minute runs retain established device and final end metadata", () =>
  isolated(async () => {
    const initial = batch();
    initial.run.device = null;
    await ingest_measurement_batch(initial, NOW);
    const next = batch();
    next.run.device = "verified-test-device";
    next.minute = "2026-11-07T20:03:00Z";
    next.traversals[0].traversal_id = "next-private-traversal";
    next.timing.sessions[0].anchor_utc = "2026-11-07T19:57:30Z";
    next.traversals[0].completed_at = "2026-11-07T20:03:30Z";
    await ingest_measurement_batch(next, NOW);
    assert.equal(readWorkerStore().runs[0].device, "verified-test-device");
    const changed = structuredClone(initial);
    changed.batch_id = randomUUID();
    changed.run.device = "changed-device";
    await assert.rejects(ingest_measurement_batch(changed, NOW), code(409));
    next.revision++;
    next.run.ended_at = "2026-11-07T20:04:55Z";
    await ingest_measurement_batch(next, NOW);
    assert.equal(readWorkerStore().runs[0].ended_at, next.run.ended_at);
    changed.run.device = "verified-test-device";
    await assert.rejects(ingest_measurement_batch(changed, NOW), code(409));
  }));
