/** Preparation only: evidence presence and arithmetic never confer approval. */
import { parseRegistry, type RegistryDocument } from "./registry.ts";

export interface Pending222Inputs {
  geometry: Record<string, any>;
  movement: Record<string, any>;
  correspondences: Record<string, any>;
  provenance: Record<string, unknown>;
}

export function buildPending222Registry(
  input: Pending222Inputs,
): RegistryDocument {
  const { geometry, movement, correspondences, provenance } =
    structuredClone(input);
  if (
    [geometry.camera_id, movement.camera_id, correspondences.camera_id].some(
      (id) => id !== "222",
    )
  )
    throw new Error("The pending profile is scoped to camera 222.");
  if (
    geometry.version !== movement.view_version ||
    typeof movement.calibration_version !== "string"
  )
    throw new Error("Candidate view/calibration references disagree.");
  if (
    movement.movement_id !== "222-eastbound-through" ||
    movement.movement?.entry_gate_id !== "count-3" ||
    movement.movement?.exit_gate_id !== "count-1" ||
    movement.movement?.entry_direction !== "negative" ||
    movement.movement?.exit_direction !== "negative"
  )
    throw new Error(
      "The proposed 222 movement does not match the reviewed handoff scope.",
    );
  if (
    !Array.isArray(geometry.gates) ||
    !Array.isArray(correspondences.pairs) ||
    !Array.isArray(correspondences.homography) ||
    !Array.isArray(movement.limitations)
  )
    throw new Error("Candidate calibration evidence is incomplete.");
  const gates = Object.fromEntries(
    geometry.gates.map((gate: Record<string, unknown>) => [
      gate.id,
      { ...gate, coordinate_units: "normalized_image" },
    ]),
  );
  if (!gates["count-3"] || !gates["count-1"])
    throw new Error(
      "Candidate movement gates are absent from the current view.",
    );
  const evidence = [
    "evaluation/calibration/222-movement-eastbound.json",
    "evaluation/calibration/222-road-plane-correspondences.json",
    "config/cameras/222.measurement.json",
  ];
  // The source's local valid/accepted assertions are retained as provenance only.
  // Both server approval and its temporal validity remain explicitly unset.
  return parseRegistry({
    registry_version: "1.0",
    revision: `222-pending-${movement.calibration_version}`,
    calibrations: [
      {
        camera_id: "222",
        version: movement.calibration_version,
        approval: {
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          evidence_refs: evidence,
          modes: ["replay", "live"],
        },
        valid_from: null,
        valid_to: null,
        calibration: {
          camera_id: "222",
          version: movement.calibration_version,
          validation_status: "missing",
          gates,
          reference_measurements: {
            status: "candidate_not_accepted",
            image_size_px: [1280, 720],
            transform_units: correspondences.transform,
            aerial_source: correspondences.aerial_source,
            aerial_request: correspondences.aerial_request,
            aerial_center_latlon: correspondences.aerial_center_latlon,
            mercator_scale_cos_lat: correspondences.mercator_scale_cos_lat,
            pairs: correspondences.pairs,
            reported_summary: correspondences.summary,
            proposed_movement: movement,
            provenance,
            limitations: movement.limitations,
          },
          transform: correspondences.homography,
        },
        movements: [
          {
            movement_id: movement.movement_id,
            entry_gate_id: movement.movement.entry_gate_id,
            exit_gate_id: movement.movement.exit_gate_id,
            distance_m: movement.distance_m,
            distance_units: "m",
            evidence_refs: evidence,
          },
        ],
      },
    ],
    mappings: [],
  });
}

/** Adapt Carter's proposal to the existing strict mapping shape, never approve it. */
export function buildPendingClassMapping(source: Record<string, any>) {
  if (
    source.region !== "Los Angeles (SC)" ||
    source.calendar_year !== 2026 ||
    !source.basis ||
    typeof source.basis !== "object" ||
    Array.isArray(source.basis) ||
    ["car", "truck", "bus", "motorcycle", "ev"].some(
      (key) =>
        typeof source.basis[key] !== "string" || !source.basis[key].trim(),
    ) ||
    typeof source.applies_to !== "string"
  )
    throw new Error(
      "The mapping proposal must retain its scope and assumptions.",
    );
  const document = parseRegistry({
    registry_version: "1.0",
    revision: "mapping-proposal-validation-only",
    calibrations: [],
    mappings: [
      {
        version: source.version,
        approval: {
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          evidence_refs: ["evaluation/calibration/class-mapping-v1.json"],
          modes: ["replay", "live"],
        },
        region: source.region,
        calendar_year: source.calendar_year,
        mapping: {
          version: source.version,
          evidence:
            "Scenario assumptions, pending review: evaluation/calibration/class-mapping-v1.json. Car/bus mixes assumed; truck fractions use image-label instances, not validated unique-vehicle VMT. Fuel-aggregated factors; no extra EV discount.",
          classes: structuredClone(source.classes),
        },
      },
    ],
  });
  return document.mappings[0];
}
