import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { MeasurementBatch } from "../../contracts/src/measurement.ts";
import type { WorkerBatch } from "../../contracts/src/ingest.ts";
import {
  buildPending222Registry,
  buildPendingClassMapping,
  type Pending222Inputs,
} from "../src/pending-222.ts";
import { parseRegistry } from "../src/registry.ts";
import {
  ingest_measurement_batch,
  read_measurement_window,
} from "../src/measurements.ts";
import { handleMeasurementEvidenceGet } from "../src/measurement-http.ts";
import { ingestWorkerBatch } from "../src/ingest.ts";
import { readSnapshot, readWorkerStore } from "../src/persistence.ts";
import { get_emissions_window, get_traffic_window } from "../src/queries.ts";
import { compare_scenario } from "../src/scenario.ts";
import { draft_brief } from "../src/brief.ts";

const NOW = new Date("2026-11-08T03:30:45Z");
function inputs(): Pending222Inputs {
  const read = (path: string) =>
    JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
  return {
    geometry: read("../../config/cameras/222.measurement.json"),
    movement: read("../../evaluation/calibration/222-movement-eastbound.json"),
    correspondences: read(
      "../../evaluation/calibration/222-road-plane-correspondences.json",
    ),
    provenance: { purpose: "controlled pending-approval test only" },
  };
}
function fixture(): MeasurementBatch {
  const source = inputs();
  return {
    measurement_version: "1.0",
    batch_id: randomUUID(),
    revision: 0,
    run: {
      run_id: "controlled-pending-222-replay-test",
      model_version: "controlled-trajectories-no-detector",
      device: "controlled-test",
      started_at: "2026-11-08T03:29:00Z",
      ended_at: null,
      mode: "replay",
    },
    camera_id: "222",
    mode: "replay",
    minute: "2026-11-08T03:30:00Z",
    calibration_version: source.movement.calibration_version,
    mapping_version: null,
    units: { distance: "m", time: "s" },
    timing: {
      basis: "estimated_hls_media_utc",
      clock_method: "hls-min-anchor-v1",
      sessions: [
        {
          session_id: "private-controlled-session",
          anchor_utc: "2026-11-08T03:30:00Z",
        },
      ],
    },
    meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
    observation_ref: null,
    observations: [
      {
        vehicle_class: "car",
        count: 3,
        queue_count: 2,
        coverage: null,
        stopped_vehicle_seconds: null,
      },
    ],
    traversals: [
      {
        session_id: "private-controlled-session",
        traversal_id: "private-controlled-traversal",
        movement_id: "222-eastbound-through",
        completed_at: "2026-11-08T03:30:10Z",
        entry_media_s: 5,
        exit_media_s: 10,
        traversal_time_s: 5,
        stopped_time_s: null,
        vehicle_class: "car",
      },
    ],
    retract: false,
  };
}
async function isolated(work: (path: string) => Promise<void>) {
  const keys = [
    "EMISSION_LENS_STORE_PATH",
    "EMISSION_LENS_REGISTRY_PATH",
    "EMISSION_LENS_WORKER_TOKEN",
  ] as const;
  const previous = keys.map((k) => process.env[k]);
  const folder = mkdtempSync(join(tmpdir(), "222-pending-registry-test-"));
  process.env.EMISSION_LENS_STORE_PATH = join(folder, "store.json");
  process.env.EMISSION_LENS_REGISTRY_PATH = join(folder, "registry.json");
  process.env.EMISSION_LENS_WORKER_TOKEN =
    "controlled-pending-222-token-no-service-access";
  writeFileSync(
    process.env.EMISSION_LENS_REGISTRY_PATH,
    JSON.stringify(buildPending222Registry(inputs())),
  );
  try {
    await work(process.env.EMISSION_LENS_STORE_PATH);
  } finally {
    keys.forEach((k, i) => {
      if (previous[i] === undefined) delete process.env[k];
      else process.env[k] = previous[i];
    });
    rmSync(folder, { recursive: true, force: true });
  }
}

test("real candidate evidence is preserved in a pending registry with no mapping or temporal approval", () => {
  const input = inputs(),
    original = structuredClone(input);
  const registry = buildPending222Registry(input);
  assert.deepEqual(input, original);
  assert.deepEqual(parseRegistry(registry), registry);
  const entry = registry.calibrations[0];
  assert.equal(entry.approval.status, "pending");
  assert.equal(entry.approval.reviewed_by, null);
  assert.equal(entry.approval.reviewed_at, null);
  assert.equal(entry.valid_from, null);
  assert.equal(entry.calibration.validation_status, "missing");
  assert.deepEqual(
    entry.calibration.transform,
    input.correspondences.homography,
  );
  assert.equal(entry.movements[0].distance_m, 20);
  assert.equal(registry.mappings.length, 0);
  const references = entry.calibration.reference_measurements as Record<
    string,
    any
  >;
  assert.equal(
    references.pairs.filter((p: any) => p.role === "fit").length,
    10,
  );
  assert.equal(
    references.pairs.filter((p: any) => p.role === "validation").length,
    5,
  );
  assert.ok(
    references.limitations.some((s: string) => s.includes("Left turns")),
  );
});
test("candidate view, gate directions and camera scope cannot silently drift during preparation", () => {
  for (const mutate of [
    (i: Pending222Inputs) => {
      i.geometry.version = "different-view";
    },
    (i: Pending222Inputs) => {
      i.movement.movement.entry_direction = "positive";
    },
    (i: Pending222Inputs) => {
      i.geometry.camera_id = "223";
    },
    (i: Pending222Inputs) => {
      i.geometry.gates = i.geometry.gates.filter(
        (g: any) => g.id !== "count-3",
      );
    },
  ]) {
    const input = inputs();
    mutate(input);
    assert.throws(() => buildPending222Registry(input));
  }
});
test("pending finite calibration keeps count/timing and exact retries but withholds every physical quantity", () =>
  isolated(async (path) => {
    const source = fixture();
    const result = await ingest_measurement_batch(source, NOW);
    assert.equal(result.state, "unavailable");
    assert.ok(
      result.reasons.some((r) => r.includes("No server-approved calibration")),
    );
    assert.ok(
      result.reasons.some((r) =>
        r.includes("No server-approved class mapping"),
      ),
    );
    const first = readSnapshot(path);
    assert.equal((await ingest_measurement_batch(source, NOW)).duplicate, true);
    assert.deepEqual(readSnapshot(path), first);
    const traffic = get_traffic_window({
      cameraId: "222",
      mode: "replay",
      now: NOW,
    });
    assert.equal(traffic.totals.count, 3);
    assert.equal(traffic.totals.completed_traversals, 1);
    assert.equal(traffic.totals.traversal_time_s, 5);
    assert.equal(traffic.totals.distance_m, null);
    assert.equal(traffic.queue_count, 2);
    assert.equal(
      get_emissions_window({ cameraId: "222", mode: "replay", now: NOW })
        .estimate_g_by_pollutant.co2,
      null,
    );
    const scenario = compare_scenario({
      cameraId: "222",
      mode: "replay",
      now: NOW,
      stoppedTimeReductionPct: 20,
    });
    assert.equal(scenario.baseline.average_speed_m_s, null);
    assert.equal(scenario.pollutants.co2.baseline_g, null);
    assert.equal(scenario.pollutants.nox.scenario_g, null);
    assert.equal(scenario.completed_cohort.baseline.stopped_time_s, null);
    assert.equal(
      get_traffic_window({ cameraId: "222", mode: "live", now: NOW }).rows
        .length,
      0,
    );
    const view = read_measurement_window({
      cameraId: "222",
      mode: "replay",
      now: NOW,
    });
    assert.equal(view.registry.state, "configured");
    assert.equal(view.registry.physical_calibration_approved, false);
    const brief = draft_brief({ cameraId: "222", mode: "replay", now: NOW });
    assert.match(brief.text, /temperature 70 °F; relative humidity 60%/);
    for (const publicValue of [view, scenario, brief]) {
      const text = JSON.stringify(publicValue);
      assert.ok(!text.includes("session_id"));
      assert.ok(!text.includes("traversal_id"));
      assert.ok(!text.includes(path));
    }
    const reference = result.evidence_ref;
    const url = `http://localhost/api/measurements/evidence?reference=${reference}`;
    assert.equal(
      (await handleMeasurementEvidenceGet(new Request(url))).status,
      401,
    );
    const response = await handleMeasurementEvidenceGet(
      new Request(url, {
        headers: {
          Authorization: `Bearer ${process.env.EMISSION_LENS_WORKER_TOKEN}`,
        },
      }),
    );
    assert.equal(response.status, 200);
    const evidence = await response.json();
    assert.equal(evidence.current, true);
    assert.equal(evidence.approved_input, null);
    assert.equal(evidence.source.traversals[0].stopped_time_s, null);
    assert.notEqual(
      evidence.source.traversals[0].traversal_id,
      "private-controlled-traversal",
    );
    // A local valid flag and a finite matrix still do not override pending approval.
    const registry = buildPending222Registry(inputs());
    registry.calibrations[0].calibration.validation_status = "valid";
    writeFileSync(
      process.env.EMISSION_LENS_REGISTRY_PATH!,
      JSON.stringify(registry),
    );
    await ingest_measurement_batch(source, NOW);
    assert.equal(readWorkerStore().traffic[0].distance_m, null);
    assert.equal(
      readWorkerStore().emissions.every((r) => r.estimate_g === null),
      true,
    );
  }));
test("linked independent counts survive pending completion evidence and its retraction", () =>
  isolated(async () => {
    const source = fixture();
    source.observations = [];
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
          mode: "replay",
          run_id: source.run.run_id,
          vehicle_class: "car",
          count: 4,
          queue_count: 1,
          stopped_vehicle_seconds: null,
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
    source.observation_ref = { batch_id: legacy.batch_id, revision: 0 };
    await ingest_measurement_batch(source, NOW);
    assert.equal(readWorkerStore().traffic[0].count, 4);
    assert.equal(readWorkerStore().traffic[0].traversal_time_s, 5);
    source.revision = 1;
    source.retract = true;
    source.traversals = [];
    await ingest_measurement_batch(source, NOW);
    assert.equal(readWorkerStore().traffic[0].count, 4);
    assert.equal(readWorkerStore().traffic[0].completed_traversals, null);
    assert.equal(readWorkerStore().emissions.length, 0);
  }));

test("new class proposal fits supported weights but remains unapplied and pending", async () => {
  const proposal = JSON.parse(
    readFileSync(
      new URL(
        "../../evaluation/calibration/class-mapping-v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const original = structuredClone(proposal),
    entry = buildPendingClassMapping(proposal);
  assert.deepEqual(proposal, original);
  assert.equal(entry.approval.status, "pending");
  assert.equal(entry.approval.reviewed_at, null);
  assert.equal(entry.approval.reviewed_by, null);
  assert.deepEqual(entry.mapping.classes, proposal.classes);
  assert.deepEqual(Object.keys(entry.mapping.classes).sort(), [
    "bus",
    "car",
    "motorcycle",
    "truck",
  ]);
  assert.equal(entry.mapping.classes.unknown, undefined);
  assert.equal(entry.mapping.classes.tesla, undefined);
  assert.equal(entry.mapping.classes.pickup, undefined);
  assert.match(entry.mapping.evidence, /pending review/);
  assert.match(entry.mapping.evidence, /not validated unique-vehicle VMT/);
  const registry = buildPending222Registry(inputs());
  assert.deepEqual(registry.mappings, []);
  const broken = structuredClone(proposal);
  broken.classes.truck[0].vmt_share = 0.4;
  assert.throws(() => buildPendingClassMapping(broken));
});

test("profile CLI rejects approved movement gate-pair drift before preparing files", () => {
  const folder = mkdtempSync(join(tmpdir(), "222-approved-scope-test-"));
  try {
    const source = inputs();
    const registry = buildPending222Registry(source);
    const approval = {
      status: "approved" as const,
      reviewed_by: "Carter" as const,
      reviewed_at: NOW.toISOString(),
      evidence_refs: ["controlled approval fixture only; not field evidence"],
      modes: ["replay" as const],
    };
    registry.calibrations[0].approval = approval;
    registry.calibrations[0].valid_from = "2026-11-07T00:00:00Z";
    registry.calibrations[0].calibration.validation_status = "valid";
    const proposal = JSON.parse(
      readFileSync(
        new URL(
          "../../evaluation/calibration/class-mapping-v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const mapping = buildPendingClassMapping(proposal);
    mapping.approval = approval;
    registry.mappings = [mapping];
    const config = {
      view_version: source.geometry.version,
      calibration_version: source.movement.calibration_version,
      mapping_version: mapping.version,
      stop_observation: null,
      movements: [
        {
          ...source.movement.movement,
          movement_id: source.movement.movement_id,
          distance_m: source.movement.distance_m,
        },
      ],
    };
    const configPath = join(folder, "traversals.json");
    const registryPath = join(folder, "registry.json");
    writeFileSync(configPath, JSON.stringify(config));
    for (const [index, gates] of [
      ["count-1", "count-3"], // Reversed pair, unchanged ID/distance/endpoints.
      ["count-2", "count-1"], // Another gate exists in this same image view.
    ].entries()) {
      const candidate = structuredClone(registry);
      Object.assign(candidate.calibrations[0].movements[0], {
        entry_gate_id: gates[0],
        exit_gate_id: gates[1],
      });
      writeFileSync(registryPath, JSON.stringify(parseRegistry(candidate)));
      const outputPath = join(folder, `profile-${index}`);
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          "tsx",
          fileURLToPath(
            new URL("../scripts/prepare-222-profile.ts", import.meta.url),
          ),
          "--directory",
          outputPath,
          "--traversal-config",
          configPath,
          "--approved-registry",
          registryPath,
          "--python",
          join(folder, "must-not-run-python"),
        ],
        { encoding: "utf8", timeout: 10_000 },
      );
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /Supplied approval does not match this calibration, movement or requested mapping/,
      );
      assert.equal(existsSync(outputPath), false);
    }
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
