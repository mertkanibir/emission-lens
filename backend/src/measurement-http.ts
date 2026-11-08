import { createHash, timingSafeEqual } from "node:crypto";
import type { Mode } from "../../contracts/src/index.ts";
import {
  ingest_measurement_batch,
  read_measurement_evidence,
  read_measurement_window,
  refresh_measurements,
} from "./measurements.ts";
import { IngestError } from "./persistence.ts";

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers });
function authorize(request: Request): Response | null {
  const token = process.env.EMISSION_LENS_WORKER_TOKEN;
  if (!token || token.length < 32)
    return json({ error: "Measurement ingestion is not configured." }, 503);
  const hash = (text: string) => createHash("sha256").update(text).digest();
  return timingSafeEqual(
    hash(request.headers.get("authorization") ?? ""),
    hash(`Bearer ${token}`),
  )
    ? null
    : json({ error: "Unauthorized." }, 401);
}
async function body(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new IngestError("Expected application/json.", 415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 1_048_576))
    throw new IngestError(
      "Request body is too large or has an invalid length.",
      413,
    );
  if (!request.body) throw new IngestError("Expected a JSON body.", 400);
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_048_576) {
        await reader.cancel();
        throw new IngestError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
    try {
      return JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      );
    } catch {
      throw new IngestError("Invalid JSON body.", 400);
    }
  } finally {
    reader.releaseLock();
  }
}
function failure(error: unknown): Response {
  return error instanceof IngestError
    ? json({ error: error.message }, error.status)
    : json({ error: "Measurement operation could not be completed." }, 503);
}
function query(request: Request, allowed: string[]): URLSearchParams {
  const params = new URL(request.url).searchParams;
  if (
    [...params.keys()].some(
      (k) => !allowed.includes(k) || params.getAll(k).length !== 1,
    )
  )
    throw new IngestError("Unsupported or duplicate query parameter.", 400);
  return params;
}
export async function handleMeasurementPost(
  request: Request,
): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const result = await ingest_measurement_batch(await body(request));
    return json(result, result.duplicate ? 200 : 202);
  } catch (error) {
    return failure(error);
  }
}
export async function handleMeasurementGet(
  request: Request,
): Promise<Response> {
  try {
    const params = query(request, ["camera", "mode", "reduce"]);
    const cameraId = params.get("camera") ?? "222",
      mode = (params.get("mode") ?? "live") as Mode;
    const text = params.get("reduce");
    if (text !== null && !/^\d+(?:\.\d+)?$/.test(text))
      throw new IngestError("Invalid reduction percentage.", 400);
    return json(
      read_measurement_window({
        cameraId,
        mode,
        stoppedTimeReductionPct: text === null ? 20 : Number(text),
      }),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function handleMeasurementEvidenceGet(
  request: Request,
): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const params = query(request, ["reference"]);
    return json(read_measurement_evidence(params.get("reference") ?? ""));
  } catch (error) {
    return failure(error);
  }
}
export async function handleMeasurementRefreshPost(
  request: Request,
): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    const value = await body(request);
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length
    )
      throw new IngestError("Refresh requires an empty JSON object.", 400);
    return json(await refresh_measurements());
  } catch (error) {
    return failure(error);
  }
}
