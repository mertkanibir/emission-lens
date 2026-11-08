import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as rawRequest, type Server } from "node:http";
import test from "node:test";
import { createPreviewGateway } from "../../infra/local-preview-gateway.ts";

const TOKEN = "isolated-preview-test-token-not-a-service-secret";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0xff, 0xd9]).toString("base64");
async function listen(server: Server): Promise<number> {
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); assert.ok(address && typeof address !== "string"); return address.port;
}
async function close(server: Server): Promise<void> {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
}
function frame(sequence = 1) {
  const now = new Date().toISOString();
  return { camera_id: "223", mode: "live", run_id: "gateway-test", session: 1, sequence, received_at: now, processed_at: now, jpeg_base64: JPEG };
}

test("gateway validates its fixed loopback upstream port", () => {
  for (const upstreamPort of [0, -1, 65536, 1.5, NaN]) assert.throws(() => createPreviewGateway({ upstreamPort }));
});

test("isolated preview preserves authorization, scope, bounds and exact same-frame identity while upstream waits", async () => {
  const previous = process.env.EMISSION_LENS_WORKER_TOKEN;
  process.env.EMISSION_LENS_WORKER_TOKEN = TOKEN;
  let release!: () => void, upstreamEntered!: () => void;
  const entered = new Promise<void>(resolve => { upstreamEntered = resolve; });
  const wait = new Promise<void>(resolve => { release = resolve; });
  const upstream = createServer(async (request, response) => {
    if (request.url === "/slow") { upstreamEntered(); await wait; }
    response.setHeader("connection", "keep-alive, x-private-hop");
    response.setHeader("x-private-hop", "removed");
    response.end("writer-response");
  });
  const upstreamPort = await listen(upstream), gateway = createPreviewGateway({ upstreamPort });
  const base = `http://127.0.0.1:${await listen(gateway)}`;
  const post = (body: unknown, authorization = `Bearer ${TOKEN}`) => fetch(`${base}/api/frames`, { method: "POST", headers: { authorization, "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  try {
    const malformedStatus = await new Promise<number | undefined>((resolve, reject) => {
      const malformed = rawRequest({ hostname: "127.0.0.1", port: new URL(base).port, path: "/\\[bad" }, response => { response.resume(); resolve(response.statusCode); });
      malformed.on("error", reject); malformed.end();
    });
    assert.equal(malformedStatus, 400, "malformed absolute-like targets fail closed without crashing");
    assert.equal((await post(frame(), "Bearer wrong")).status, 401);
    assert.equal((await post({ ...frame(), mode: "synthetic" })).status, 400);
    assert.equal((await post({ ...frame(), camera_id: "unknown" })).status, 400);
    assert.equal((await post({ ...frame(), received_at: new Date(Date.now() - 61_000).toISOString() })).status, 400);
    assert.equal((await post(" ".repeat(512 * 1024 + 1))).status, 413);
    const streamedStatus = await new Promise<number | undefined>((resolve, reject) => {
      const streamed = rawRequest(`${base}/api/frames`, { method: "POST", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" } }, response => { response.resume(); resolve(response.statusCode); });
      streamed.on("error", reject);
      for (let i = 0; i < 9; i++) streamed.write(Buffer.alloc(64 * 1024, 32));
      streamed.end();
    });
    assert.equal(streamedStatus, 413, "chunked bodies obey the same limit without declared length");
    const value = frame();
    assert.equal((await post(value)).status, 202);
    assert.equal((await post(value)).status, 200);
    const slow = fetch(`${base}/slow`);
    await entered;
    // The writer deliberately cannot complete until this preview roundtrip finishes.
    const received = await fetch(`${base}/api/cameras/223/frame?mode=live`);
    assert.equal(received.status, 200);
    assert.match(received.headers.get("cache-control")!, /no-store/);
    const body = await received.json();
    assert.equal(body.sequence, value.sequence);
    assert.equal(body.run_id, value.run_id);
    assert.equal(body.processed_at, value.processed_at);
    assert.equal(body.image_data_url, `data:image/jpeg;base64,${JPEG}`);
    assert.equal((await fetch(`${base}/api/cameras/223/frame?mode=replay`)).status, 404);
    assert.equal((await fetch(`${base}/api/cameras/222/frame?mode=live`)).status, 404);
    assert.equal((await fetch(`${base}/api/cameras/223/frame?mode=synthetic`)).status, 400);
    release();
    const proxied = await slow;
    assert.equal(await proxied.text(), "writer-response");
    assert.equal(proxied.headers.get("x-private-hop"), null);
  } finally {
    release(); await close(gateway); await close(upstream);
    if (previous === undefined) delete process.env.EMISSION_LENS_WORKER_TOKEN; else process.env.EMISSION_LENS_WORKER_TOKEN = previous;
  }
});

test("gateway returns a bounded 502 when its fixed upstream is unavailable", async () => {
  const unavailable = createServer(), upstreamPort = await listen(unavailable); await close(unavailable);
  const gateway = createPreviewGateway({ upstreamPort }), base = `http://127.0.0.1:${await listen(gateway)}`;
  try { const response = await fetch(`${base}/api/status`); assert.equal(response.status, 502); assert.deepEqual(await response.json(), { error: "Upstream is unavailable." }); }
  finally { await close(gateway); }
});
