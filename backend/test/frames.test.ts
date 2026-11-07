import assert from "node:assert/strict";
import test from "node:test";
import { getPreviewFrame, handleFrameGet, handleFramePost, storePreviewFrame, type PreviewFrame } from "../src/frames.ts";

const NOW = Date.parse("2026-11-07T23:30:00Z");
const TOKEN = "preview-test-only-token-more-than-32-characters";
// Framing fixture only. Server validates JPEG framing and base64, not image decode.
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]).toString("base64");

function fixture(cameraId = "222", mode: PreviewFrame["mode"] = "live"): PreviewFrame {
  return { camera_id: cameraId, mode, run_id: "preview-test", session: 1, sequence: 1, received_at: new Date(NOW - 1000).toISOString(), processed_at: new Date(NOW).toISOString(), jpeg_base64: JPEG };
}

function clear(): void { getPreviewFrame("222", "live", NOW + 100_000); }

test("ephemeral preview isolates cameras and modes and expires within sixty seconds", () => {
  clear();
  storePreviewFrame(fixture(), NOW);
  assert.equal(getPreviewFrame("222", "live", NOW)?.sequence, 1);
  assert.equal(getPreviewFrame("223", "live", NOW), null);
  assert.equal(getPreviewFrame("222", "replay", NOW), null);
  storePreviewFrame(fixture("222", "replay"), NOW);
  storePreviewFrame(fixture("223"), NOW);
  assert.equal(getPreviewFrame("222", "replay", NOW)?.mode, "replay");
  assert.equal(getPreviewFrame("223", "live", NOW)?.camera_id, "223");
  assert.equal(getPreviewFrame("222", "live", NOW + 58_999)?.sequence, 1);
  assert.equal(getPreviewFrame("222", "live", NOW + 59_000), null);
  assert.equal(getPreviewFrame("222", "replay", NOW + 60_000), null);
});

test("same preview is idempotent without extending expiry and conflicting/old sequences fail", () => {
  clear();
  const frame = fixture();
  const first = storePreviewFrame(frame, NOW);
  assert.equal(storePreviewFrame(frame, NOW + 500).duplicate, true);
  assert.equal(storePreviewFrame(frame, NOW + 500).expires_at, first.expires_at);
  assert.throws(() => storePreviewFrame({ ...frame, received_at: new Date(NOW).toISOString() }, NOW), /cannot change/);
  storePreviewFrame({ ...frame, sequence: 2, processed_at: new Date(NOW + 1).toISOString() }, NOW + 1);
  assert.throws(() => storePreviewFrame(frame, NOW + 1), /older/);
  storePreviewFrame({ ...frame, session: 2, sequence: 1, processed_at: new Date(NOW + 2).toISOString() }, NOW + 2);
  assert.throws(() => storePreviewFrame({ ...frame, sequence: 3, processed_at: new Date(NOW + 3).toISOString() }, NOW + 3), /older/);
  assert.equal(getPreviewFrame("222", "live", NOW + 3)?.session, 2);
});

test("different preview runs need newer processing evidence", () => {
  clear();
  storePreviewFrame(fixture(), NOW);
  assert.throws(() => storePreviewFrame({ ...fixture(), run_id: "other" }, NOW), /newer/);
  storePreviewFrame({ ...fixture(), run_id: "other", processed_at: new Date(NOW + 1).toISOString() }, NOW + 1);
  assert.equal(getPreviewFrame("222", "live", NOW + 1)?.run_id, "other");
});

test("preview parser rejects unsupported content, malformed JPEG, time order, old/future and non UTC values", () => {
  clear();
  const invalid: unknown[] = [
    { ...fixture(), camera_id: "unknown" }, { ...fixture(), mode: "synthetic" },
    { ...fixture(), session: 0 }, { ...fixture(), sequence: 1.5 },
    { ...fixture(), received_at: "2026-11-07T18:29:59-05:00" },
    { ...fixture(), processed_at: new Date(NOW - 2000).toISOString() },
    { ...fixture(), processed_at: new Date(NOW + 30_001).toISOString() },
    { ...fixture(), received_at: new Date(NOW - 60_000).toISOString() },
    { ...fixture(), jpeg_base64: "not base64" }, { ...fixture(), jpeg_base64: Buffer.from("not jpeg").toString("base64") },
    { ...fixture(), jpeg_base64: "A".repeat(500_000) },
    { ...fixture(), track_ids: [1] },
  ];
  for (const frame of invalid) assert.throws(() => storePreviewFrame(frame, NOW));
  assert.equal(getPreviewFrame("222", "live", NOW), null);
});

test("HTTP previews authenticate, cap streaming bodies and return labeled uncached same-frame data", async () => {
  clear();
  const previous = process.env.EMISSION_LENS_WORKER_TOKEN;
  process.env.EMISSION_LENS_WORKER_TOKEN = TOKEN;
  const request = (body: string, token = TOKEN, type = "application/json") => new Request("http://localhost/api/frames", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": type }, body });
  try {
    assert.equal((await handleFramePost(request(JSON.stringify(fixture()), "wrong"), NOW)).status, 401);
    assert.equal((await handleFramePost(request("{}", TOKEN, "text/plain"), NOW)).status, 415);
    assert.equal((await handleFramePost(request("{"), NOW)).status, 400);
    assert.equal((await handleFramePost(request(" ".repeat(512 * 1024 + 1)), NOW)).status, 413);
    assert.equal((await handleFramePost(request(JSON.stringify(fixture())), NOW)).status, 202);
    assert.equal((await handleFramePost(request(JSON.stringify(fixture())), NOW)).status, 200);
    const response = handleFrameGet(new Request("http://localhost/api/cameras/222/frame?mode=live"), "222", NOW);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /no-store/);
    const body = await response.json();
    assert.equal(body.mode, "live");
    assert.equal(body.image_data_url, `data:image/jpeg;base64,${JPEG}`);
    assert.equal(body.received_at, fixture().received_at);
    assert.equal(handleFrameGet(new Request("http://localhost/api/cameras/222/frame?mode=replay"), "222", NOW).status, 404);
    assert.equal(handleFrameGet(new Request("http://localhost/api/cameras/222/frame?mode=synthetic"), "222", NOW).status, 400);
    assert.equal(handleFrameGet(new Request("http://localhost/api/cameras/unknown/frame"), "unknown", NOW).status, 404);
    assert.equal(handleFrameGet(new Request("http://localhost/api/cameras/222/frame"), "222", NOW + 60_000).status, 404);
    delete process.env.EMISSION_LENS_WORKER_TOKEN;
    assert.equal((await handleFramePost(request(JSON.stringify(fixture())), NOW)).status, 503);
  } finally {
    clear();
    if (previous === undefined) delete process.env.EMISSION_LENS_WORKER_TOKEN;
    else process.env.EMISSION_LENS_WORKER_TOKEN = previous;
  }
});
