import type { Mode } from "@emission-lens/contracts";

export const PREVIEW_POLL_MS = 1000;
export const PREVIEW_TTL_MS = 60_000;
export interface ProcessedPreview {
  camera_id: string;
  mode: "live" | "replay";
  run_id: string;
  session: number;
  sequence: number;
  received_at: string;
  processed_at: string;
  image_data_url: string;
}

/** Keep the browser's selected camera/mode and the producer's original clocks. */
export function parseSelectedPreview(value: unknown, cameraId: string, mode: Mode, now: number): ProcessedPreview {
  const frame = value as ProcessedPreview;
  if (!frame || mode === "synthetic" || frame.camera_id !== cameraId || frame.mode !== mode
    || typeof frame.run_id !== "string" || !frame.run_id
    || !Number.isSafeInteger(frame.session) || frame.session < 1
    || !Number.isSafeInteger(frame.sequence) || frame.sequence < 1
    || typeof frame.image_data_url !== "string" || !frame.image_data_url.startsWith("data:image/jpeg;base64,")) {
    throw new Error("Preview does not match the selected camera and mode.");
  }
  const received = Date.parse(frame.received_at), processed = Date.parse(frame.processed_at);
  if (!Number.isFinite(received) || !Number.isFinite(processed) || processed < received
    || processed > now + 30_000 || received <= now - PREVIEW_TTL_MS) {
    throw new Error("Preview timing is unavailable or expired.");
  }
  return frame;
}

/** Duplicate polling never manufactures another processed frame. */
export function isNewPreview(next: ProcessedPreview, current: ProcessedPreview | null): boolean {
  if (!current) return true;
  if (Date.parse(next.processed_at) <= Date.parse(current.processed_at)) return false;
  if (next.run_id !== current.run_id) return true;
  return next.session > current.session || (next.session === current.session && next.sequence > current.sequence);
}

export function medianPreviewInterval(intervals: readonly number[]): number | null {
  const values = intervals.filter(value => Number.isFinite(value) && value > 0).slice(-6).sort((a, b) => a - b);
  if (!values.length) return null;
  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 ? values[midpoint] : (values[midpoint - 1] + values[midpoint]) / 2;
}
