import { createHash, timingSafeEqual } from "node:crypto";
import { ingestWorkerBatch, IngestError } from "./ingest.ts";

const MAX_BODY_BYTES = 1_048_576;
const HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function json(value: unknown, status: number): Response {
  return Response.json(value, { status, headers: HEADERS });
}

/** Authentication and bounded parsing happen before any store mutation. */
export async function handleWorkerPost(request: Request): Promise<Response> {
  const token = process.env.EMISSION_LENS_WORKER_TOKEN;
  if (!token || token.length < 32) return json({ error: "Worker ingestion is not configured." }, 503);
  const supplied = request.headers.get("authorization") ?? "";
  const digest = (text: string) => createHash("sha256").update(text).digest();
  if (!timingSafeEqual(digest(supplied), digest(`Bearer ${token}`))) {
    return json({ error: "Unauthorized." }, 401);
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "Expected application/json." }, 415);
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) {
    return json({ error: "Request body is too large or has an invalid length." }, 413);
  }
  if (!request.body) return json({ error: "Expected a JSON body." }, 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return json({ error: "Request body is too large." }, 413);
      }
      chunks.push(value);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    } catch {
      return json({ error: "Invalid JSON body." }, 400);
    }
    const result = ingestWorkerBatch(parsed);
    return json(result, result.duplicate ? 200 : 202);
  } catch (error) {
    if (error instanceof IngestError) return json({ error: error.message }, error.status);
    // Storage paths, bearer tokens and submitted records never enter a response.
    return json({ error: "Worker batch could not be stored." }, 503);
  } finally {
    reader.releaseLock();
  }
}
