/** Prepare private pending or supplied-owner-approved artifacts, never an active environment. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseRegistry, canonical } from "../src/registry.ts";
import {
  buildPending222Registry,
  buildPendingClassMapping,
} from "../src/pending-222.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
function option(name: string): string {
  const at = args.indexOf(name);
  if (at < 0 || !args[at + 1] || args[at + 1].startsWith("--"))
    throw new Error(`Required: ${name}.`);
  return args[at + 1];
}
const directory = option("--directory"),
  sourceConfig = option("--traversal-config"),
  python = option("--python");
const allowed = new Set([
  "--directory",
  "--traversal-config",
  "--python",
  "--mapping-proposal",
  "--approved-registry",
]);
if (
  args.length % 2 ||
  args.some((value, index) => index % 2 === 0 && !allowed.has(value)) ||
  new Set(args.filter((_, index) => index % 2 === 0)).size !==
    args.length / 2 ||
  !isAbsolute(directory) ||
  !isAbsolute(sourceConfig)
)
  throw new Error(
    "Use explicit, non-repeated options and absolute profile/source paths.",
  );
const approvedPath = args.includes("--approved-registry")
  ? option("--approved-registry")
  : null;
if (approvedPath && !isAbsolute(approvedPath))
  throw new Error("Approved registry path must be absolute.");
const approvedRaw = approvedPath ? readFileSync(approvedPath) : null;
const approvedRegistry = approvedRaw
  ? parseRegistry(JSON.parse(approvedRaw.toString("utf8")))
  : null;
const mappingPath = args.includes("--mapping-proposal")
  ? option("--mapping-proposal")
  : null;
if (mappingPath && !isAbsolute(mappingPath))
  throw new Error("Mapping proposal path must be absolute.");
const mappingRaw = mappingPath ? readFileSync(mappingPath) : null;
const mappingProposal = mappingRaw
  ? buildPendingClassMapping(JSON.parse(mappingRaw.toString("utf8")))
  : null;
const files = {
  geometry: join(root, "config/cameras/222.measurement.json"),
  movement: join(root, "evaluation/calibration/222-movement-eastbound.json"),
  correspondences: join(
    root,
    "evaluation/calibration/222-road-plane-correspondences.json",
  ),
  extracted_config: sourceConfig,
};
const raw = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(path)]),
);
const data = Object.fromEntries(
  Object.entries(raw).map(([key, body]) => [
    key,
    JSON.parse(body.toString("utf8")),
  ]),
);
const sha = (body: Buffer | string) =>
  createHash("sha256").update(body).digest("hex");
const hashes = Object.fromEntries(
  Object.entries(raw).map(([key, body]) => [key, sha(body)]),
);
const crlfHash = sha(
  raw.geometry.toString("utf8").replace(/\r\n/g, "\n").replace(/\n/g, "\r\n"),
);
const declared = data.movement.view_sha256;
if (declared !== hashes.geometry && declared !== crlfHash)
  throw new Error(
    "Current geometry differs from the declared candidate beyond LF/CRLF representation; review before preparing.",
  );
const attachment = data.extracted_config;
const proposed = data.movement.movement;
const local = attachment.movements?.[0];
if (
  attachment.view_version !== data.geometry.version ||
  attachment.calibration_version !== data.movement.calibration_version ||
  (!approvedRegistry && attachment.mapping_version !== null) ||
  attachment.stop_observation !== null ||
  attachment.movements?.length !== 1 ||
  local?.movement_id !== data.movement.movement_id ||
  local.distance_m !== data.movement.distance_m ||
  ["entry_gate_id", "exit_gate_id", "entry_direction", "exit_direction"].some(
    (k) => local[k] !== proposed[k],
  )
)
  throw new Error(
    "Extracted attachment differs from the scoped null-mapping/null-stop movement.",
  );
if (approvedRegistry) {
  const calibration = approvedRegistry.calibrations.find(
    (row) =>
      row.camera_id === "222" && row.version === attachment.calibration_version,
  );
  const mapping = approvedRegistry.mappings.find(
    (row) => row.version === attachment.mapping_version,
  );
  const movement = calibration?.movements.find(
    (row) => row.movement_id === local.movement_id,
  );
  if (
    !calibration ||
    calibration.approval.status !== "approved" ||
    !mapping ||
    mapping.approval.status !== "approved" ||
    !movement ||
    movement.entry_gate_id !== local.entry_gate_id ||
    movement.exit_gate_id !== local.exit_gate_id ||
    movement.distance_m !== data.movement.distance_m ||
    canonical(calibration.calibration.transform) !==
      canonical(data.correspondences.homography)
  )
    throw new Error(
      "Supplied approval does not match this calibration, movement or requested mapping.",
    );
  for (const gateId of [local.entry_gate_id, local.exit_gate_id]) {
    const sourceGate = (calibration.calibration.gates as Record<string, any>)[
      gateId
    ];
    const viewGate = data.geometry.gates.find(
      (row: Record<string, any>) => row.id === gateId,
    );
    if (
      !sourceGate ||
      canonical(sourceGate.start) !== canonical(viewGate?.start) ||
      canonical(sourceGate.end) !== canonical(viewGate?.end)
    )
      throw new Error("Approved registry gates differ from the current view.");
  }
  if (
    mappingProposal &&
    canonical(mapping.mapping.classes) !==
      canonical(mappingProposal.mapping.classes)
  )
    throw new Error(
      "Approved mapping differs from the retained class proposal.",
    );
}
const validated = spawnSync(
  python,
  [
    "-c",
    `
import json,math,sys
from worker.metrics import MetricsConfig
from worker.publish import TraversalBridge
from worker.calibration import validate_homography, project_road_point
payload=json.load(sys.stdin)
g=MetricsConfig.from_dict(payload["geometry"]);raw=payload["config"]
run={"run_id":"222-pending-configuration-check-only","model_version":"configuration-only-no-inference","device":None,"started_at":"2026-11-08T03:00:00Z","ended_at":None,"mode":"replay"}
bridge=TraversalBridge.from_config(raw,g,run)
source=payload["correspondences"];matrix=validate_homography(source["homography"])
residuals={}
for role in ["fit","validation"]:
 values=[]
 for pair in source["pairs"]:
  if pair["role"]==role:
   out=project_road_point(matrix,tuple(pair["image_px"]))
   values.append(math.dist(out,tuple(pair["ground_m"])))
 residuals[role]={"pairs":len(values),"rms_m":math.sqrt(sum(v*v for v in values)/len(values)),"max_m":max(values)}
print(json.dumps({"valid":bridge is not None,"view_version":g.version,"residuals_recomputed_from_retained_rounded_points":residuals,"diagnostic":bridge.diagnostic()}))
`,
  ],
  {
    cwd: root,
    encoding: "utf8",
    input: JSON.stringify({
      geometry: data.geometry,
      config: attachment,
      correspondences: data.correspondences,
    }),
  },
);
if (validated.status !== 0)
  throw new Error(
    `Private configuration validation failed: ${validated.stderr.slice(0, 1500)}`,
  );
const validation = JSON.parse(validated.stdout);
const provenance = {
  source_commit: "3fc1110",
  source_file_sha256: hashes,
  declared_view_sha256: declared,
  local_crlf_representation_sha256: crlfHash,
  view_hash_match:
    declared === hashes.geometry
      ? "exact_bytes"
      : "lf_crlf_representation_only",
  config_source:
    "Extracted attachment text from Carter; not claimed byte-identical to original Gmail attachment.",
  source_message_reference:
    "Retained separately with the private extracted attachment.",
  source_attachment_name: "222-traversals.json",
};
const registry =
  approvedRegistry ??
  buildPending222Registry({
    geometry: data.geometry,
    movement: data.movement,
    correspondences: data.correspondences,
    provenance,
  });
const outputs: Record<string, Buffer | string> = {
  "registry.json": approvedRaw ?? JSON.stringify(registry, null, 2) + "\n",
  "geometry.json": raw.geometry,
  "traversals.json": raw.extracted_config,
};
if (mappingProposal)
  outputs["mapping-proposal.json"] =
    JSON.stringify(
      {
        state: approvedRegistry
          ? "owner_approved_modeling_assumption_basis"
          : "pending_review_not_active_mapping",
        source: mappingPath,
        source_raw_sha256: sha(mappingRaw!),
        record:
          approvedRegistry?.mappings.find(
            (row) => row.version === attachment.mapping_version,
          ) ?? mappingProposal,
        original_proposal: JSON.parse(mappingRaw!.toString("utf8")),
        limitations: [
          "Image-instance counts do not independently establish unique traversal/VMT shares.",
          "Visual pickup/box-truck classes do not establish EMFAC weight categories.",
          "Car and bus weights are explicit assumptions, not measured regional VMT.",
          "No Tesla/unknown/fine-tuned-class aliases or EV discount are supplied.",
        ],
      },
      null,
      2,
    ) + "\n";
const manifest = {
  profile_version: "1.0",
  camera_id: "222",
  state: approvedRegistry
    ? "prepared_owner_approved_not_active_original_server"
    : "prepared_pending_not_active_server_configuration",
  registry_approval: approvedRegistry ? "source_approved" : "pending",
  supplied_registry_source: approvedPath,
  supplied_registry_extracted_sha256: approvedRaw ? sha(approvedRaw) : null,
  supplied_approval_metadata: registry.calibrations.map((row) => row.approval),
  class_mapping: attachment.mapping_version,
  unapplied_mapping_proposal: approvedRegistry
    ? null
    : (mappingProposal?.version ?? null),
  stopped_time_support: null,
  meteorology: {
    ...attachment.meteorology,
    basis: "proposed_fixed_assumption_not_observed_weather",
  },
  sources: files,
  provenance,
  validation,
  prepared_file_sha256: Object.fromEntries(
    Object.entries(outputs).map(([name, body]) => [name, sha(body)]),
  ),
  limitations: data.movement.limitations,
};
outputs["manifest.json"] = JSON.stringify(manifest, null, 2) + "\n";
mkdirSync(directory, { recursive: true, mode: 0o700 });
for (const [name, body] of Object.entries(outputs)) {
  const path = join(directory, name);
  if (existsSync(path)) {
    if (!readFileSync(path).equals(Buffer.from(body)))
      throw new Error(
        "Existing profile differs; use a new private directory instead of overwriting review/runtime state.",
      );
  } else writeFileSync(path, body, { flag: "wx", mode: 0o600 });
}
console.log(
  JSON.stringify(
    {
      directory,
      approval: approvedRegistry ? "source_approved" : "pending",
      mapping: attachment.mapping_version,
      stopped_time_support: null,
      geometry_raw_sha256: hashes.geometry,
      declared_geometry_byte_match: provenance.view_hash_match,
      validation,
    },
    null,
    2,
  ),
);
