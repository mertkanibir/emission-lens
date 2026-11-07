import { createHash, timingSafeEqual } from "node:crypto";
import { cameraById } from "@emission-lens/contracts";
import { validateUtcTimestamp } from "../../contracts/src/validate.ts";

const MAX_BODY_BYTES = 512 * 1024;
const MAX_JPEG_BYTES = 350 * 1024;
const FRAME_TTL_MS = 60_000;
const FUTURE_SKEW_MS = 30_000;
const HEADERS = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
const STORE_KEY = Symbol.for("emission-lens.preview-store.v1");

export interface PreviewFrame {
  camera_id: string;
  mode: "live" | "replay";
  run_id: string;
  session: number;
  sequence: number;
  received_at: string;
  processed_at: string;
  jpeg_base64: string;
}

interface StoredFrame {
  frame: PreviewFrame;
  expires_at: number;
  timer: ReturnType<typeof setTimeout>;
}

class PreviewError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function store(): Map<string, StoredFrame> {
  const shared = globalThis as unknown as Record<symbol, Map<string, StoredFrame> | undefined>;
  return shared[STORE_KEY] ??= new Map<string, StoredFrame>();
}

function key(cameraId: string, mode: PreviewFrame["mode"]): string { return `${mode}|${cameraId}`; }

function purge(now: number): void {
  for (const [id, value] of store()) {
    if (value.expires_at <= now) { clearTimeout(value.timer); store().delete(id); }
  }
}

function parse(value: unknown, now: number): PreviewFrame {
  const fields = ["camera_id", "mode", "run_id", "session", "sequence", "received_at", "processed_at", "jpeg_base64"];
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new PreviewError("Expected a preview object.", 400);
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((name) => !fields.includes(name)) || fields.some((name) => !Object.hasOwn(raw, name))) throw new PreviewError("Preview has missing or unsupported fields.", 400);
  if (typeof raw.camera_id !== "string" || !cameraById(raw.camera_id)) throw new PreviewError("Unknown camera.", 400);
  if (raw.mode !== "live" && raw.mode !== "replay") throw new PreviewError("Preview mode must be live or replay.", 400);
  if (typeof raw.run_id !== "string" || raw.run_id.length === 0 || raw.run_id.length > 256 || /[\u0000-\u001f]/.test(raw.run_id)) throw new PreviewError("Invalid worker run.", 400);
  if (!Number.isSafeInteger(raw.session) || (raw.session as number) < 1 || !Number.isSafeInteger(raw.sequence) || (raw.sequence as number) < 1) throw new PreviewError("Session and sequence must be positive safe integers.", 400);
  try {
    validateUtcTimestamp(raw.received_at, "received_at");
    validateUtcTimestamp(raw.processed_at, "processed_at");
  } catch { throw new PreviewError("Preview timestamps must be valid UTC.", 400); }
  const received = Date.parse(raw.received_at as string);
  const processed = Date.parse(raw.processed_at as string);
  if (processed < received || processed > now + FUTURE_SKEW_MS || received > now + FUTURE_SKEW_MS) throw new PreviewError("Invalid preview time order or future clock skew.", 400);
  if (received <= now - FRAME_TTL_MS || processed <= now - FRAME_TTL_MS) throw new PreviewError("Preview is too old.", 400);
  if (typeof raw.jpeg_base64 !== "string" || raw.jpeg_base64.length === 0 || raw.jpeg_base64.length > Math.ceil(MAX_JPEG_BYTES / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw.jpeg_base64)) throw new PreviewError("Expected a bounded base64 JPEG.", 400);
  const jpeg = Buffer.from(raw.jpeg_base64, "base64");
  // Validate the bounded encoding and JPEG framing; image decoding is left to the browser.
  if (jpeg.length < 5 || jpeg.length > MAX_JPEG_BYTES || jpeg[0] !== 0xff || jpeg[1] !== 0xd8 || jpeg[2] !== 0xff || jpeg[jpeg.length - 2] !== 0xff || jpeg[jpeg.length - 1] !== 0xd9 || jpeg.toString("base64") !== raw.jpeg_base64) throw new PreviewError("Expected JPEG framing and canonical base64.", 400);
  return Object.freeze({
    camera_id: raw.camera_id, mode: raw.mode, run_id: raw.run_id,
    session: raw.session as number, sequence: raw.sequence as number,
    received_at: raw.received_at as string, processed_at: raw.processed_at as string,
    jpeg_base64: raw.jpeg_base64,
  });
}

/** Keep only the latest same-frame overlay per camera/mode, in this server process. */
export function storePreviewFrame(value: unknown, now = Date.now()): { duplicate: boolean; expires_at: string } {
  purge(now);
  const frame = parse(value, now);
  const id = key(frame.camera_id, frame.mode);
  const previous = store().get(id);
  if (previous) {
    const old = previous.frame;
    if (old.run_id === frame.run_id) {
      if (frame.session === old.session && frame.sequence === old.sequence) {
        if (JSON.stringify(frame) !== JSON.stringify(old)) throw new PreviewError("An existing preview sequence cannot change content.", 409);
        return { duplicate: true, expires_at: new Date(previous.expires_at).toISOString() };
      }
      if (frame.session < old.session || (frame.session === old.session && frame.sequence < old.sequence) || Date.parse(frame.processed_at) < Date.parse(old.processed_at)) throw new PreviewError("Preview sequence is older than the current frame.", 409);
    } else if (Date.parse(frame.processed_at) <= Date.parse(old.processed_at)) {
      throw new PreviewError("Another run has a newer preview.", 409);
    }
    clearTimeout(previous.timer);
  }
  const expires_at = Math.min(now + FRAME_TTL_MS, Date.parse(frame.received_at) + FRAME_TTL_MS, Date.parse(frame.processed_at) + FRAME_TTL_MS);
  const timer = setTimeout(() => {
    if (store().get(id)?.frame === frame) store().delete(id);
  }, Math.max(1, expires_at - now));
  timer.unref?.();
  store().set(id, { frame, expires_at, timer });
  return { duplicate: false, expires_at: new Date(expires_at).toISOString() };
}

export function getPreviewFrame(cameraId: string, mode: PreviewFrame["mode"], now = Date.now()): PreviewFrame | null {
  purge(now);
  return store().get(key(cameraId, mode))?.frame ?? null;
}

function json(value: unknown, status: number): Response { return Response.json(value, { status, headers: HEADERS }); }

/** Authenticate before reading JPEG bytes; credentials never enter the response or memory store. */
export async function handleFramePost(request: Request, now = Date.now()): Promise<Response> {
  const token = process.env.EMISSION_LENS_WORKER_TOKEN;
  if (!token || token.length < 32) return json({ error: "Worker preview is not configured." }, 503);
  const hash = (value: string) => createHash("sha256").update(value).digest();
  if (!timingSafeEqual(hash(request.headers.get("authorization") ?? ""), hash(`Bearer ${token}`))) return json({ error: "Unauthorized." }, 401);
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return json({ error: "Expected application/json." }, 415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return json({ error: "Preview request is too large or has an invalid length." }, 413);
  if (!request.body) return json({ error: "Expected a JSON body." }, 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); return json({ error: "Preview request is too large." }, 413); }
      chunks.push(value);
    }
    let value: unknown;
    try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    catch { return json({ error: "Invalid preview JSON." }, 400); }
    const receipt = storePreviewFrame(value, now);
    return json(receipt, receipt.duplicate ? 200 : 202);
  } catch (error) {
    if (error instanceof PreviewError) return json({ error: error.message }, error.status);
    return json({ error: "Preview could not be accepted." }, 503);
  } finally { reader.releaseLock(); }
}

export function handleFrameGet(request: Request, cameraId: string, now = Date.now()): Response {
  if (!cameraById(cameraId)) return json({ error: "Unknown camera." }, 404);
  const mode = new URL(request.url).searchParams.get("mode") ?? "live";
  if (mode !== "live" && mode !== "replay") return json({ error: "Preview mode must be live or replay." }, 400);
  const frame = getPreviewFrame(cameraId, mode, now);
  if (!frame) return json({ available: false, camera_id: cameraId, mode }, 404);
  return json({
    available: true, camera_id: frame.camera_id, mode: frame.mode, run_id: frame.run_id,
    session: frame.session, sequence: frame.sequence, received_at: frame.received_at, processed_at: frame.processed_at,
    image_data_url: `data:image/jpeg;base64,${frame.jpeg_base64}`,
  }, 200);
}
