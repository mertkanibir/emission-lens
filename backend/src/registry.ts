import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  cameraById,
  type CameraCalibration,
  type Mode,
} from "../../contracts/src/index.ts";
import { exactObject, boundedText } from "../../contracts/src/measurement.ts";
import { validateUtcTimestamp } from "../../contracts/src/validate.ts";
import {
  validate_class_mapping,
  type ClassMapping,
} from "../../emissions/src/index.ts";
import { asOf } from "./clock.ts";

export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
export const fingerprint = (value: unknown): string =>
  createHash("sha256").update(canonical(value)).digest("hex");
export interface Approval {
  status: "approved" | "pending" | "rejected";
  reviewed_by: "Mert" | "Carter" | null;
  reviewed_at: string | null;
  evidence_refs: string[];
  modes: Mode[];
}
export interface RegistryMovement {
  movement_id: string;
  entry_gate_id: string;
  exit_gate_id: string;
  distance_m: number;
  distance_units: "m";
  evidence_refs: string[];
}
export interface RegistryCalibration {
  camera_id: string;
  version: string;
  approval: Approval;
  valid_from: string | null;
  valid_to: string | null;
  calibration: CameraCalibration;
  movements: RegistryMovement[];
}
export interface RegistryMapping {
  version: string;
  approval: Approval;
  region: "Los Angeles (SC)";
  calendar_year: 2026;
  mapping: ClassMapping;
}
export interface RegistryDocument {
  registry_version: "1.0";
  revision: string;
  calibrations: RegistryCalibration[];
  mappings: RegistryMapping[];
}
export interface LoadedRegistry {
  state: "missing" | "invalid" | "configured";
  digest: string;
  document: RegistryDocument | null;
}
export interface MeasurementRegistryStatus {
  state: LoadedRegistry["state"];
  revision: string | null;
  calibration_version: string | null;
  mapping_versions: string[];
  physical_calibration_approved: boolean;
}
const modes: Mode[] = ["live", "replay", "synthetic"];
function references(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new Error("Invalid registry references.");
  for (const ref of value) boundedText(ref, "evidence reference");
}
function approval(value: unknown): Approval {
  const a = exactObject(
    value,
    ["status", "reviewed_by", "reviewed_at", "evidence_refs", "modes"],
    "approval",
  );
  if (
    !["approved", "pending", "rejected"].includes(a.status as string) ||
    !["Mert", "Carter", null].includes(a.reviewed_by as string | null)
  )
    throw new Error("Invalid approval.");
  validateUtcTimestamp(a.reviewed_at, "reviewed_at", true);
  references(a.evidence_refs);
  if (
    !Array.isArray(a.modes) ||
    a.modes.length > 3 ||
    a.modes.some((m) => !modes.includes(m)) ||
    new Set(a.modes).size !== a.modes.length
  )
    throw new Error("Invalid approval modes.");
  if (
    a.status === "approved" &&
    (!a.reviewed_by ||
      !a.reviewed_at ||
      !a.evidence_refs.length ||
      !a.modes.length)
  )
    throw new Error("Approval requires explicit review evidence.");
  return a as unknown as Approval;
}
function metadata(value: unknown): boolean {
  return (
    value !== null && typeof value === "object" && Object.keys(value).length > 0
  );
}
function validTransform(value: unknown): boolean {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some(
      (r) =>
        !Array.isArray(r) ||
        r.length !== 3 ||
        r.some((v) => typeof v !== "number" || !Number.isFinite(v)),
    )
  )
    return false;
  const scale = Math.max(...(value as number[][]).flat().map(Math.abs));
  if (scale === 0) return false;
  const [a, b, c] = (value as number[][]).map((row) =>
    row.map((v) => v / scale),
  );
  const det =
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0]);
  return Number.isFinite(det) && det !== 0;
}
export function parseRegistry(value: unknown): RegistryDocument {
  const doc = exactObject(
    value,
    ["registry_version", "revision", "calibrations", "mappings"],
    "registry",
  );
  if (doc.registry_version !== "1.0")
    throw new Error("Unsupported registry version.");
  boundedText(doc.revision, "revision");
  if (
    !Array.isArray(doc.calibrations) ||
    doc.calibrations.length > 100 ||
    !Array.isArray(doc.mappings) ||
    doc.mappings.length > 100
  )
    throw new Error("Invalid registry collections.");
  const seen = new Set<string>();
  for (const value of doc.calibrations) {
    const row = exactObject(
      value,
      [
        "camera_id",
        "version",
        "approval",
        "valid_from",
        "valid_to",
        "calibration",
        "movements",
      ],
      "calibration entry",
    );
    if (typeof row.camera_id !== "string" || !cameraById(row.camera_id))
      throw new Error("Unknown registry camera.");
    boundedText(row.version, "version");
    const key = `c|${row.camera_id}|${row.version}`;
    if (seen.has(key)) throw new Error("Duplicate calibration version.");
    seen.add(key);
    const a = approval(row.approval);
    validateUtcTimestamp(row.valid_from, "valid_from", true);
    validateUtcTimestamp(row.valid_to, "valid_to", true);
    if (
      row.valid_to !== null &&
      (row.valid_from === null ||
        Date.parse(row.valid_to as string) <=
          Date.parse(row.valid_from as string))
    )
      throw new Error("Invalid calibration interval.");
    const cal = exactObject(
      row.calibration,
      [
        "camera_id",
        "version",
        "gates",
        "reference_measurements",
        "transform",
        "validation_status",
      ],
      "calibration",
    );
    if (
      cal.camera_id !== row.camera_id ||
      cal.version !== row.version ||
      !["valid", "invalid", "missing"].includes(cal.validation_status as string)
    )
      throw new Error("Calibration identity mismatch.");
    if (
      a.status === "approved" &&
      (row.valid_from === null ||
        cal.validation_status !== "valid" ||
        !metadata(cal.gates) ||
        Array.isArray(cal.gates) ||
        !metadata(cal.reference_measurements) ||
        !validTransform(cal.transform))
    )
      throw new Error("Approved calibration requires supported metadata.");
    if (!Array.isArray(row.movements) || row.movements.length > 100)
      throw new Error("Invalid calibration movements.");
    const movements = new Set<string>();
    for (const value of row.movements) {
      const m = exactObject(
        value,
        [
          "movement_id",
          "entry_gate_id",
          "exit_gate_id",
          "distance_m",
          "distance_units",
          "evidence_refs",
        ],
        "movement",
      );
      for (const field of [
        "movement_id",
        "entry_gate_id",
        "exit_gate_id",
      ] as const)
        boundedText(m[field], field);
      references(m.evidence_refs);
      if (
        movements.has(m.movement_id as string) ||
        m.entry_gate_id === m.exit_gate_id ||
        m.distance_units !== "m" ||
        typeof m.distance_m !== "number" ||
        !Number.isFinite(m.distance_m) ||
        m.distance_m <= 0 ||
        m.distance_m > 100_000 ||
        !m.evidence_refs.length
      )
        throw new Error("Invalid movement distance or evidence.");
      if (
        a.status === "approved" &&
        (!Object.hasOwn(cal.gates as object, m.entry_gate_id as string) ||
          !Object.hasOwn(cal.gates as object, m.exit_gate_id as string))
      )
        throw new Error("Movement references unknown gate.");
      movements.add(m.movement_id as string);
    }
    if (a.status === "approved" && !movements.size)
      throw new Error("Approval requires a movement.");
  }
  for (const value of doc.mappings) {
    const row = exactObject(
      value,
      ["version", "approval", "region", "calendar_year", "mapping"],
      "mapping entry",
    );
    boundedText(row.version, "version");
    approval(row.approval);
    const key = `m|${row.version}`;
    if (seen.has(key)) throw new Error("Duplicate mapping version.");
    seen.add(key);
    const mapping = exactObject(
      row.mapping,
      ["version", "evidence", "classes"],
      "class mapping",
    );
    boundedText(mapping.version, "mapping version");
    boundedText(mapping.evidence, "mapping evidence");
    if (
      mapping.version !== row.version ||
      row.region !== "Los Angeles (SC)" ||
      row.calendar_year !== 2026
    )
      throw new Error("Mapping scope mismatch.");
    validate_class_mapping(mapping as unknown as ClassMapping);
    if (
      !mapping.classes ||
      typeof mapping.classes !== "object" ||
      Array.isArray(mapping.classes)
    )
      throw new Error("Invalid mapping classes.");
    for (const values of Object.values(mapping.classes)) {
      if (!Array.isArray(values) || values.length > 12)
        throw new Error("Invalid mixture.");
      for (const item of values)
        exactObject(item, ["emfac_class", "vmt_share"], "mixture");
    }
  }
  return structuredClone(doc) as unknown as RegistryDocument;
}
export function loadRegistry(): LoadedRegistry {
  const path = process.env.EMISSION_LENS_REGISTRY_PATH;
  if (!path)
    return {
      state: "missing",
      digest: fingerprint("unconfigured"),
      document: null,
    };
  if (!isAbsolute(path))
    return {
      state: "invalid",
      digest: fingerprint("invalid-path"),
      document: null,
    };
  let raw: string;
  try {
    if (statSync(/* turbopackIgnore: true */ path).size > 1_048_576)
      throw new Error();
    raw = readFileSync(/* turbopackIgnore: true */ path, "utf8");
  } catch {
    return {
      state: "invalid",
      digest: fingerprint("unreadable-registry"),
      document: null,
    };
  }
  try {
    const document = parseRegistry(JSON.parse(raw));
    return { state: "configured", digest: fingerprint(document), document };
  } catch {
    return { state: "invalid", digest: fingerprint(raw), document: null };
  }
}
export function registryStatus(
  registry: LoadedRegistry,
  cameraId: string,
  mode: Mode,
  now = new Date(),
): MeasurementRegistryStatus {
  const at = Date.parse(asOf(mode, now));
  const approved =
    registry.document?.calibrations.filter(
      (c) =>
        c.camera_id === cameraId &&
        c.approval.status === "approved" &&
        c.approval.modes.includes(mode) &&
        c.valid_from !== null &&
        at >= Date.parse(c.valid_from) &&
        (c.valid_to === null || at < Date.parse(c.valid_to)),
    ) ?? [];
  return {
    state: registry.state,
    revision: registry.document?.revision ?? null,
    calibration_version: approved.length === 1 ? approved[0].version : null,
    mapping_versions:
      registry.document?.mappings
        .filter(
          (m) =>
            m.approval.status === "approved" && m.approval.modes.includes(mode),
        )
        .map((m) => m.version) ?? [],
    physical_calibration_approved: approved.length > 0,
  };
}
export function get_measurement_registry_status(
  cameraId: string,
  mode: Mode,
): MeasurementRegistryStatus {
  return registryStatus(loadRegistry(), cameraId, mode);
}
