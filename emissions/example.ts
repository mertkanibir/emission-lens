/** Reproducible arithmetic example. No camera observations or real calibration. */
import { estimate_completed_traversals, get_factor_catalog_status } from "./src/index.ts";

const result = estimate_completed_traversals({
  camera_id: "222",
  minute: "2026-11-07T21:00:00Z",
  mode: "synthetic",
  calibration: {
    camera_id: "222", version: "synthetic-example-only", validation_status: "valid",
    gates: { synthetic: true }, reference_measurements: { synthetic: true }, transform: { synthetic: true },
  },
  class_mapping: {
    version: "synthetic-LDA-assumption",
    evidence: "Arithmetic example only: assume all example cars are EMFAC LDA. Not an approved live class mapping.",
    classes: { car: [{ emfac_class: "LDA", vmt_share: 1 }] },
  },
  meteorology: { temperature_f: 70, relative_humidity_pct: 60 },
  traversals: [{
    session_id: "synthetic-example", traversal_id: "one-mile",
    completed_at: "2026-11-07T21:00:30Z", vehicle_class: "car",
    distance_m: 1609.344, traversal_time_s: 360,
  }],
});

console.log(JSON.stringify({
  purpose: "Synthetic arithmetic example using actual CARB factors; not observed traffic, real calibration, measured emissions, or an accuracy evaluation.",
  expected_identity: "For one vehicle-mile at 10 mph, estimated grams equal the original CARB g/vehicle-mile rate at the 10 mph speed bin.",
  factor_catalog: get_factor_catalog_status(),
  result,
}, null, 2));
