import test from "node:test";
import assert from "node:assert/strict";
import { readProducerPreview } from "../src/lib/preview-source.ts";

test("isolated consumer previews use a fixed loopback producer, preserve modes and never relay credentials", async () => {
  const old = process.env.EMISSION_LENS_PREVIEW_ORIGIN;
  const originalFetch = globalThis.fetch;
  try {
    delete process.env.EMISSION_LENS_PREVIEW_ORIGIN;
    assert.equal(await readProducerPreview(new Request("http://127.0.0.1:3152/api/cameras/222/frame"), "222"), null);
    process.env.EMISSION_LENS_PREVIEW_ORIGIN = "http://127.0.0.1:3151";
    const frame = { available: true, camera_id: "222", mode: "replay", run_id: "run", session: "session", sequence: 12, received_at: new Date().toISOString(), processed_at: new Date().toISOString(), image_data_url: "data:image/jpeg;base64,/9j/", secret: "do not relay" };
    globalThis.fetch = async (url, options) => {
      assert.equal(String(url), "http://127.0.0.1:3151/api/cameras/222/frame?mode=replay");
      assert.equal(options?.headers, undefined);
      assert.equal(options?.redirect, "error");
      return Response.json(frame);
    };
    const request = new Request("http://127.0.0.1:3152/api/cameras/222/frame?mode=replay", { headers: { authorization: "private client credential" } });
    const result = await readProducerPreview(request, "222");
    assert.equal(result?.status, 200);
    assert.equal(result?.headers.get("cache-control"), "no-store");
    assert.equal((await result!.json()).secret, undefined);
    frame.mode = "live";
    assert.equal((await readProducerPreview(request, "222"))?.status, 503);
    frame.mode = "replay"; frame.received_at = new Date(Date.now() - 61_000).toISOString();
    assert.equal((await readProducerPreview(request, "222"))?.status, 503);
    for (const origin of ["https://example.com", "http://127.0.0.1:3151/path", "http://user:secret@127.0.0.1:3151", "http://127.0.0.1:3152"]) {
      process.env.EMISSION_LENS_PREVIEW_ORIGIN = origin;
      assert.equal((await readProducerPreview(request, "222"))?.status, 503);
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (old === undefined) delete process.env.EMISSION_LENS_PREVIEW_ORIGIN; else process.env.EMISSION_LENS_PREVIEW_ORIGIN = old;
  }
});
