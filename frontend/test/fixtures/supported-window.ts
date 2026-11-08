import type { MeasurementWindowView, TrafficWindow } from "@emission-lens/backend";
import type { TrafficMinute } from "@emission-lens/contracts";

/** In-memory public display shapes only; no registry, camera or service is installed. */
export function supportedWindow(): MeasurementWindowView {
  return {
    camera_id: "222", mode: "replay", from: "2026-11-08T03:00:00Z", to: "2026-11-08T04:00:00Z",
    registry: { state: "configured", revision: "display-test", calibration_version: "display-calibration", mapping_versions: ["display-mapping"], physical_calibration_approved: true },
    minutes: [{
      minute: "2026-11-08T03:58:00Z", batch_id: "display-supported", revision: 0, state: "ready", reasons: [],
      timing_basis: "estimated_hls_media_utc", meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
      calibration_version: "display-calibration", mapping_version: "display-mapping", evidence_ref: "display-reference", traffic: [],
      emissions: (["co2", "nox"] as const).map((pollutant) => ({
        camera_id: "222", mode: "replay", minute: "2026-11-08T03:58:00+00:00", pollutant,
        estimate_g: pollutant === "co2" ? 35.741459375498366 : 0.0065337364924251285,
        range_low_g: null, range_high_g: null, factor_version: "display-factor", method_version: "display-method", quality_state: "ok",
      })),
    }],
    scenario: {
      available: false,
      pollutants: { co2: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null }, nox: { baseline_g: null, scenario_g: null, change_g: null, change_pct: null } },
      completed_cohort: { count: null, baseline: { distance_m: null, traversal_time_s: null, stopped_time_s: null }, scenario: { distance_m: null, traversal_time_s: null, stopped_time_s: null } },
      evidence_refs: [], assumptions: [], limitations: [],
    }, evidence_refs: [], limitations: [],
  };
}

export function queueRow(queue_count: number | null, minute = "2026-11-08T03:58:00Z"): TrafficMinute {
  return { camera_id: "222", mode: "replay", minute, run_id: null, vehicle_class: "car", count: 1, completed_traversals: null, stopped_vehicle_seconds: null, traversal_time_s: null, distance_m: null, queue_count, queue_length_m: null, coverage: null };
}

export function queueWindow(rows: TrafficMinute[]): TrafficWindow {
  return { camera_id: "222", mode: "replay", from: "2026-11-08T03:00:00Z", to: "2026-11-08T04:00:00Z", rows, queue_count: null, queue_length_m: null, totals: { count: null, completed_traversals: null, stopped_vehicle_seconds: null, traversal_time_s: null, distance_m: null, coverage: null }, note: "Display fixture only." };
}
