import { SYNTHETIC_AS_OF, type Mode } from "../../contracts/src/index.ts";
import { parseMeasurementBatch } from "../../contracts/src/measurement.ts";
import { composeMeasurements, deriveMeasurement, sealMeasurement } from "./measurement-core.ts";
import { fingerprint, parseRegistry, type LoadedRegistry } from "./registry.ts";
import type { WorkerSnapshot, WorkerStore } from "./persistence.ts";

/** Fictional, deterministic inputs; never persisted or available to live/replay. */
let cached: { snapshot: WorkerSnapshot; registry: LoadedRegistry; store: WorkerStore } | undefined;
export function richSyntheticEnabled(mode: Mode): boolean {
  return mode === "synthetic" && process.env.EMISSION_LENS_SYNTHETIC_DEMO === "rich";
}

export function richSyntheticDemo() {
  if (cached) return cached;
  const end = Date.parse(SYNTHETIC_AS_OF), start = end - 3_600_000;
  const approval = { status: "approved", reviewed_by: "Mert", reviewed_at: "2026-11-07T19:00:00Z", evidence_refs: ["fictional-synthetic-demo-only-no-field-approval"], modes: ["synthetic"] };
  const document = parseRegistry({
    registry_version: "1.0", revision: "synthetic-rich-demo-v1",
    calibrations: ["222", "223"].map(camera_id => ({
      camera_id, version: `synthetic-demo-${camera_id}`, approval,
      valid_from: "2026-11-07T19:00:00Z", valid_to: new Date(end + 60_000).toISOString(),
      calibration: { camera_id, version: `synthetic-demo-${camera_id}`, validation_status: "valid", gates: { entry: { synthetic: true }, exit: { synthetic: true } }, reference_measurements: { source: "fictional demo distances only" }, transform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
      movements: [{ movement_id: "fictional-demo-movement", entry_gate_id: "entry", exit_gate_id: "exit", distance_m: camera_id === "222" ? 80 : 60, distance_units: "m", evidence_refs: ["fictional-demo-only"] }],
    })),
    mappings: [{ version: "synthetic-demo-fleet", approval, region: "Los Angeles (SC)", calendar_year: 2026,
      mapping: { version: "synthetic-demo-fleet", evidence: "Fictional demonstration fleet; no real vehicle fuel or fleet inference.", classes: { car: [{ emfac_class: "LDA", vmt_share: 1 }], truck: [{ emfac_class: "LHDT2", vmt_share: 1 }], bus: [{ emfac_class: "UBUS", vmt_share: 1 }], motorcycle: [{ emfac_class: "MCY", vmt_share: 1 }] } } }],
  });
  const registry: LoadedRegistry = { state: "configured", document, digest: fingerprint(document) };
  const snapshot: WorkerSnapshot = { schema_version: 1, next_sequence: 120, batches: [], measurement_batches: [] };
  const classes = ["car", "truck", "bus", "motorcycle"] as const;
  for (const [cameraIndex, camera_id] of ["222", "223"].entries()) {
    for (let minuteIndex = 0; minuteIndex < 60; minuteIndex++) {
      const at = start + minuteIndex * 60_000, minute = new Date(at).toISOString();
      const phase = (Math.sin(minuteIndex / 7 + cameraIndex) + 1) / 2;
      const counts = [Math.round(12 + 22 * phase + cameraIndex * 4), 2 + minuteIndex % 5, minuteIndex % 4 === 0 ? 2 : 1, minuteIndex % 3];
      const traversals = classes.flatMap((vehicle_class, classIndex) => Array.from({ length: Math.max(0, counts[classIndex] - (classIndex === 0 ? 3 : 0)) }, (_, j) => {
        const stopped = Math.round(2 + phase * 15 + (j % 4) * 1.5);
        const duration = stopped + 8 + classIndex;
        const exit = minuteIndex * 60 + 40 + j / 10;
        return { session_id: `fictional-demo-${camera_id}`, traversal_id: `fictional-${minuteIndex}-${classIndex}-${j}`, movement_id: "fictional-demo-movement", completed_at: new Date(start + exit * 1000).toISOString(), entry_media_s: exit - duration, exit_media_s: exit, traversal_time_s: duration, stopped_time_s: stopped, vehicle_class };
      }));
      const raw = parseMeasurementBatch({
        measurement_version: "1.0", batch_id: `d0000000-0000-4000-8000-${String(cameraIndex * 60 + minuteIndex).padStart(12, "0")}`, revision: 0,
        run: { run_id: `fictional-synthetic-demo-${camera_id}`, mode: "synthetic", model_version: "fictional-demo-no-inference", device: null, started_at: new Date(start - 60_000).toISOString(), ended_at: SYNTHETIC_AS_OF },
        camera_id, mode: "synthetic", minute, calibration_version: `synthetic-demo-${camera_id}`, mapping_version: "synthetic-demo-fleet", units: { distance: "m", time: "s" },
        timing: { basis: "estimated_hls_media_utc", clock_method: "hls-min-anchor-v1", sessions: [{ session_id: `fictional-demo-${camera_id}`, anchor_utc: new Date(start).toISOString() }] },
        meteorology: { temperature_f: 70, relative_humidity_pct: 60 }, observation_ref: null,
        observations: classes.map((vehicle_class, classIndex) => ({ vehicle_class, count: counts[classIndex], stopped_vehicle_seconds: Math.round(counts[classIndex] * (4 + phase * 18)), queue_count: classIndex === 0 ? Math.round(2 + 10 * phase) : null, coverage: 1 })),
        traversals, retract: false,
      });
      const digest = fingerprint(raw);
      snapshot.measurement_batches!.push(sealMeasurement({ sequence: cameraIndex * 60 + minuteIndex, accepted_at: SYNTHETIC_AS_OF, source_digest: digest, stored_source_digest: digest, source: raw, derived: deriveMeasurement(raw, digest, snapshot, registry), superseded: [] }));
    }
  }
  const store = composeMeasurements({ runs: [], statuses: [], traffic: [], emissions: [], batches: [], measurement_batches: [] }, snapshot, registry);
  return cached = { snapshot, registry, store };
}
