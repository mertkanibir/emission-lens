import assert from "node:assert/strict";
import test from "node:test";
import { estimate_completed_traversals } from "../../emissions/src/index.ts";
import { build_completed_traversal_report, type CompletedTraversalReportInput } from "../src/traversal-report.ts";

/** All calibration, identity and mapping assumptions here are synthetic only. */
const input = (): CompletedTraversalReportInput => ({
  camera_id: "222",
  minute: "2026-11-07T21:00:00Z",
  mode: "synthetic",
  run: { run_id: "synthetic-report-run", model_version: "synthetic-test-detector", device: "synthetic-test-device", started_at: "2026-11-07T20:59:00Z", ended_at: null, mode: "synthetic" },
  calibration: { camera_id: "222", version: "synthetic-test-only", validation_status: "valid", gates: {}, reference_measurements: {}, transform: [] },
  class_mapping: { version: "synthetic-LDA-assumption", evidence: "Test scenario only: assume a car maps to LDA. No live mapping is approved.", classes: { car: [{ emfac_class: "LDA", vmt_share: 1 }] } },
  meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
  traversals: [
    { session_id: "synthetic-session", traversal_id: "one", completed_at: "2026-11-07T21:00:20Z", vehicle_class: "car", distance_m: 100, traversal_time_s: 40, stopped_time_s: 20 },
    { session_id: "synthetic-session", traversal_id: "two", completed_at: "2026-11-07T21:00:40Z", vehicle_class: "car", distance_m: 200, traversal_time_s: 80, stopped_time_s: 30 },
  ],
});

test("report derives completed-cohort traffic and per-traversal estimated emissions without inventing crossings or broader observations", () => {
  const value = input();
  const result = build_completed_traversal_report(value);
  assert.equal(result.stage, "calculation_only");
  assert.equal(result.mode, "synthetic");
  assert.equal(result.traffic.length, 1);
  assert.equal(result.traffic[0].completed_traversals, 2);
  assert.equal(result.traffic[0].traversal_time_s, 120);
  assert.equal(result.traffic[0].distance_m, 300);
  for (const field of ["count", "stopped_vehicle_seconds", "queue_count", "queue_length_m", "coverage"] as const) assert.equal(result.traffic[0][field], null);
  assert.equal(result.emissions.every((row) => row.quality_state === "ok" && row.mode === "synthetic" && row.estimate_g !== null), true);
  assert.deepEqual(result.calculation.rows, estimate_completed_traversals({ ...value, minute: result.minute }).rows);
  assert.equal(result.scenario, null);
  assert.equal(result.provenance.worker_run_id, value.run.run_id);
  assert.equal(result.provenance.class_mapping_version, value.class_mapping!.version);
  assert.equal(result.provenance.calibration_metadata_supported, true);
  assert.match(result.provenance.factor_version, /EMFAC/i);
  assert.equal(result.provenance.completion_time_basis, "supplied_utc_times_not_verified_capture_utc");
});

test("missing or incomplete calibration suppresses distance and emissions while preserving supplied completed counts and time", () => {
  for (const change of [(value: CompletedTraversalReportInput) => { value.calibration.validation_status = "missing"; }, (value: CompletedTraversalReportInput) => { value.calibration.reference_measurements = null; }]) {
    const value = input(); change(value);
    const result = build_completed_traversal_report(value);
    assert.equal(result.traffic[0].completed_traversals, 2);
    assert.equal(result.traffic[0].traversal_time_s, 120);
    assert.equal(result.traffic[0].distance_m, null);
    assert.equal(result.provenance.calibration_metadata_supported, false);
    assert.equal(result.emissions.every((row) => row.quality_state === "calibration_invalid" && row.estimate_g === null), true);
  }
});

test("unknown or unmapped completed classes withhold the full emissions total instead of a partial estimate", () => {
  for (const label of ["unknown", "truck"] as const) {
    const value = input(); value.traversals[1].vehicle_class = label;
    const result = build_completed_traversal_report(value);
    assert.equal(result.traffic.length, 2);
    assert.equal(result.traffic.reduce((sum, row) => sum + row.completed_traversals!, 0), 2);
    assert.equal(result.emissions.every((row) => row.estimate_g === null), true);
    assert.deepEqual(result.calculation.evidence, []);
  }
  const value = input(); value.class_mapping = null;
  assert.equal(build_completed_traversal_report(value).emissions.every((row) => row.estimate_g === null), true);
});

test("empty completed cohort does not fabricate traffic rows or zero emissions", () => {
  const value = input(); value.traversals = [];
  const result = build_completed_traversal_report(value);
  assert.deepEqual(result.traffic, []);
  assert.equal(result.emissions.every((row) => row.quality_state === "insufficient_evidence" && row.estimate_g === null), true);
});

test("optional shorter-stop report recalculates individual traversals and keeps hypothetical emissions separate", () => {
  const value = input(); value.stopped_time_reduction_pct = 50;
  const result = build_completed_traversal_report(value);
  assert.ok(result.scenario);
  assert.equal(result.scenario.hypothetical, true);
  assert.deepEqual(result.scenario.traversals.map((row) => row.scenario_traversal_time_s), [30, 65]);
  assert.deepEqual(result.emissions, result.calculation.rows);
  assert.deepEqual(result.emissions, result.scenario.baseline.rows);
  assert.equal(result.scenario.scenario.rows.every((row) => row.estimate_g !== null), true);
  assert.equal(result.traffic[0].traversal_time_s, 120);
  assert.equal(result.traffic[0].stopped_vehicle_seconds, null);
  assert.equal(result.provenance.scenario_method_version, result.scenario.method_version);
});

test("missing per-traversal stopped evidence withholds only the requested scenario", () => {
  const value = input(); delete value.traversals[1].stopped_time_s; value.stopped_time_reduction_pct = 20;
  const result = build_completed_traversal_report(value);
  assert.equal(result.emissions.every((row) => row.estimate_g !== null), true);
  assert.equal(result.scenario!.scenario.rows.every((row) => row.estimate_g === null), true);
});

test("UTC normalization preserves the input and the report accepts a separate configured camera", () => {
  const value = input();
  value.minute = "2026-11-07T21:00:00+00:00";
  value.traversals[0].completed_at = "2026-11-07T21:00:20+00:00";
  value.camera_id = "223"; value.calibration.camera_id = "223";
  value.stopped_time_reduction_pct = 0;
  const original = structuredClone(value);
  const result = build_completed_traversal_report(value);
  assert.equal(result.minute, "2026-11-07T21:00:00.000Z");
  assert.equal(result.traffic[0].camera_id, "223");
  assert.equal(result.scenario!.traversals[0].completed_at, "2026-11-07T21:00:20.000Z");
  assert.deepEqual(value, original);
  result.provenance.meteorology.temperature_f = 60;
  result.run.run_id = "changed-output-only";
  assert.deepEqual(value, original);
});

test("mode, camera, run and timestamp mismatches reject the report rather than changing context", () => {
  const changes: Array<(value: CompletedTraversalReportInput) => void> = [
    (value) => { value.run.mode = "live"; },
    (value) => { value.mode = "unknown" as never; value.run.mode = value.mode; },
    (value) => { value.camera_id = "999"; },
    (value) => { value.calibration.camera_id = "223"; },
    (value) => { value.run.run_id = ""; },
    (value) => { value.run.ended_at = "2026-11-07T20:58:00Z"; },
    (value) => { value.minute = "2026-11-07T21:00:01Z"; },
    (value) => { value.minute = "2026-11-07T21:00:00.000001Z"; },
    (value) => { value.traversals[0].completed_at = "2026-11-07T21:01:00Z"; },
    (value) => { value.traversals[0].completed_at = "2026-11-07T20:59:59Z"; },
    (value) => { value.traversals[0].completed_at = "2026-11-07T16:00:20-05:00"; },
    (value) => { value.traversals[0].completed_at = "2026-02-31T21:00:20Z"; },
    (value) => { value.traversals[0].vehicle_class = "person" as never; },
    (value) => { delete (value.calibration as Partial<typeof value.calibration>).gates; },
    (value) => { value.meteorology.temperature_f = NaN; },
  ];
  for (const change of changes) {
    const value = input(); change(value);
    assert.throws(() => build_completed_traversal_report(value));
  }
});

test("duplicate identities and malformed traversal dimensions are rejected even when calibration is unavailable", () => {
  const duplicate = input(); duplicate.calibration.validation_status = "missing"; duplicate.traversals.push({ ...duplicate.traversals[0] });
  assert.throws(() => build_completed_traversal_report(duplicate), /Duplicate/);
  duplicate.traversals[2].session_id = "different-synthetic-session";
  assert.equal(build_completed_traversal_report(duplicate).traffic[0].completed_traversals, 3);
  for (const field of ["distance_m", "traversal_time_s"] as const) {
    for (const number of [0, -1, NaN, Infinity]) {
      const value = input(); value.calibration.validation_status = "missing"; value.traversals[0][field] = number;
      assert.throws(() => build_completed_traversal_report(value), /positive finite/);
    }
  }
});

test("invalid stopped components are never treated as all-observed stopped seconds", () => {
  for (const number of [-1, NaN, Infinity, 41]) {
    const value = input(); value.traversals[0].stopped_time_s = number;
    assert.throws(() => build_completed_traversal_report(value), /stopped time/);
  }
});

test("report copies declared record fields rather than forwarding incidental producer data", () => {
  const value = input();
  Object.assign(value.run, { private_transport_value: "must-not-be-copied" });
  Object.assign(value.traversals[0], { frame_payload: "must-not-be-copied" });
  Object.assign(value.meteorology, { incidental_source_value: "must-not-be-copied" });
  assert.doesNotMatch(JSON.stringify(build_completed_traversal_report(value)), /must-not-be-copied/);
});
