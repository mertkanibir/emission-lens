import { cameraById } from "@emission-lens/contracts";

const HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const unavailable = (status: number) => Response.json({ available: false }, { status, headers: HEADERS });

/** Read only from an explicitly configured local producer. Never forward credentials. */
export async function readProducerPreview(request: Request, cameraId: string): Promise<Response | null> {
  const configured = process.env.EMISSION_LENS_PREVIEW_ORIGIN;
  if (!configured) return null;
  if (!cameraById(cameraId)) return unavailable(404);
  const mode = new URL(request.url).searchParams.get("mode") ?? "live";
  if (mode !== "live" && mode !== "replay") return unavailable(400);
  try {
    const origin = new URL(configured);
    if (origin.protocol !== "http:" || !["127.0.0.1", "[::1]"].includes(origin.hostname) ||
        origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
        origin.origin === new URL(request.url).origin) return unavailable(503);
    const response = await fetch(new URL(`/api/cameras/${cameraId}/frame?mode=${mode}`, origin), {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(2500),
    });
    if (response.status !== 200) return unavailable(response.status === 404 ? 404 : 503);
    if (!response.headers.get("content-type")?.startsWith("application/json")) return unavailable(503);
    const reader = response.body?.getReader();
    if (!reader) return unavailable(503);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1_500_000) { await reader.cancel(); return unavailable(503); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const frame = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const now = Date.now();
    if (frame.available !== true || frame.camera_id !== cameraId || frame.mode !== mode ||
        !Number.isFinite(Date.parse(frame.received_at)) || !Number.isFinite(Date.parse(frame.processed_at)) ||
        Date.parse(frame.received_at) < now - 60_000 || Date.parse(frame.processed_at) < now - 60_000 ||
        Date.parse(frame.received_at) > now + 30_000 || Date.parse(frame.processed_at) > now + 30_000 ||
        typeof frame.image_data_url !== "string" || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(frame.image_data_url)) return unavailable(503);
    // Project only the existing public preview envelope; arbitrary producer fields cannot leak.
    return Response.json(Object.fromEntries(["available", "camera_id", "mode", "run_id", "session", "sequence", "received_at", "processed_at", "image_data_url"].map(key => [key, frame[key]])), { headers: HEADERS });
  } catch { return unavailable(503); }
}
