import type { MeasurementBatch } from "@emission-lens/contracts";

/** Controlled integration data only. Never install this registry on the real server. */
export function controlledRegistry() {
  const approval = {
    status: "approved",
    reviewed_by: "Mert",
    reviewed_at: "2026-11-07T19:00:00Z",
    evidence_refs: ["synthetic-frontend-integration-only-not-field-evidence"],
    modes: ["synthetic"],
  };
  return {
    registry_version: "1.0",
    revision: "synthetic-frontend-integration-only-v1",
    calibrations: [{
      camera_id: "222",
      version: "synthetic-frontend-calibration-v1",
      approval,
      valid_from: "2026-11-07T19:00:00Z",
      valid_to: null,
      calibration: {
        camera_id: "222",
        version: "synthetic-frontend-calibration-v1",
        validation_status: "valid",
        gates: { entry: { synthetic_only: true }, exit: { synthetic_only: true } },
        reference_measurements: { source: "synthetic test reference; not a measured road" },
        transform: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      },
      movements: [{ movement_id: "test-entry-to-exit", entry_gate_id: "entry", exit_gate_id: "exit", distance_m: 1609.344, distance_units: "m", evidence_refs: ["synthetic-one-mile-assumption-only"] }],
    }],
    mappings: [{
      version: "synthetic-frontend-LDA-assumption-v1",
      approval,
      region: "Los Angeles (SC)",
      calendar_year: 2026,
      mapping: {
        version: "synthetic-frontend-LDA-assumption-v1",
        evidence: "Synthetic integration arithmetic: assume one car is LDA. Not an approved production mixture.",
        classes: { car: [{ emfac_class: "LDA", vmt_share: 1 }] },
      },
    }],
  };
}

/** The fixed sample clock is explicit; this payload never selects live/replay. */
export function controlledMeasurement(): MeasurementBatch {
  return {
    measurement_version: "1.0",
    batch_id: "00000000-0000-4000-8000-000000000222",
    revision: 0,
    run: {
      run_id: "synthetic-frontend-integration-only",
      model_version: "synthetic-integration-no-detector-run",
      device: "synthetic-test-only",
      started_at: "2026-11-07T19:58:30Z",
      ended_at: "2026-11-07T20:04:45Z",
      mode: "synthetic",
    },
    camera_id: "222",
    mode: "synthetic",
    minute: "2026-11-07T20:04:00Z",
    calibration_version: "synthetic-frontend-calibration-v1",
    mapping_version: "synthetic-frontend-LDA-assumption-v1",
    units: { distance: "m", time: "s" },
    timing: { basis: "estimated_hls_media_utc", clock_method: "hls-min-anchor-v1", sessions: [{ session_id: "synthetic-private-session", anchor_utc: "2026-11-07T19:58:30Z" }] },
    meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
    observation_ref: null,
    observations: [{ vehicle_class: "car", count: 1, stopped_vehicle_seconds: 180, queue_count: 1, coverage: 1 }],
    traversals: [{ session_id: "synthetic-private-session", traversal_id: "synthetic-private-traversal", movement_id: "test-entry-to-exit", completed_at: "2026-11-07T20:04:30Z", entry_media_s: 0, exit_media_s: 360, traversal_time_s: 360, stopped_time_s: 180, vehicle_class: "car" }],
    retract: false,
  };
}
