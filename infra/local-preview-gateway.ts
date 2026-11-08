import { createServer, request as upstreamRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { handleFrameGet, handleFramePost } from "../backend/src/frames.ts";

const LOOPBACK = "127.0.0.1";
const UPSTREAM_TIMEOUT_MS = 30_000;
const HOP_HEADERS = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

function port(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > 65535) throw new Error("Expected an explicit valid loopback port.");
  return value;
}

function endError(response: ServerResponse, status: number, message: string): void {
  if (response.destroyed) return;
  if (response.headersSent) { response.destroy(); return; }
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", "x-content-type-options": "nosniff" });
  response.end(JSON.stringify({ error: message }));
}

function safeHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const excluded = new Set(HOP_HEADERS);
  for (const name of (headers.connection ?? "").split(",")) excluded.add(name.trim().toLowerCase());
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !excluded.has(name.toLowerCase())));
}

/** Canceling a bounded preview reader drains its socket without retaining more bytes. */
function requestBody(request: IncomingMessage): ReadableStream<Uint8Array> {
  let cleanup = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      request.pause();
      const data = (chunk: Buffer) => { controller.enqueue(chunk); if ((controller.desiredSize ?? 0) <= 0) request.pause(); };
      const end = () => { cleanup(); controller.close(); };
      const error = () => { cleanup(); controller.error(new Error("Request interrupted.")); };
      cleanup = () => { request.off("data", data); request.off("end", end); request.off("error", error); request.off("aborted", error); };
      request.on("data", data); request.once("end", end); request.once("error", error); request.once("aborted", error);
    },
    pull() { request.resume(); },
    cancel() { cleanup(); request.resume(); },
  });
}

async function serveFrame(request: IncomingMessage, response: ServerResponse, url: URL, cameraId?: string): Promise<void> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  const init: RequestInit & { duplex?: "half" } = { method: request.method, headers };
  if (request.method === "POST") { init.body = requestBody(request); init.duplex = "half"; }
  const webRequest = new Request(url, init);
  const result = cameraId === undefined ? await handleFramePost(webRequest) : handleFrameGet(webRequest, cameraId);
  // Authentication and declared-length failures can finish before consuming the body.
  if (webRequest.body && !webRequest.body.locked) await webRequest.body.cancel();
  if (response.destroyed) return;
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(Buffer.from(await result.arrayBuffer()));
}

/** Preview handlers run here; all other bytes stream to one fixed loopback writer. */
export function createPreviewGateway({ upstreamPort }: { upstreamPort: number }) {
  const targetPort = port(upstreamPort);
  const server = createServer((request, response) => {
    // A disconnected client may emit error after a body reader has been canceled.
    request.on("error", () => {});
    // Never resolve an absolute request target or a caller-supplied upstream host.
    if (!request.url?.startsWith("/") || request.url.startsWith("//")) { endError(response, 400, "Expected a local request path."); request.resume(); return; }
    let url: URL;
    try { url = new URL(request.url, `http://${LOOPBACK}`); }
    catch { endError(response, 400, "Expected a local request path."); request.resume(); return; }
    if (url.origin !== `http://${LOOPBACK}` || url.hash) { endError(response, 400, "Expected a local request path."); request.resume(); return; }
    const frame = /^\/api\/cameras\/([^/]+)\/frame$/.exec(url.pathname);
    if ((request.method === "POST" && url.pathname === "/api/frames") || (request.method === "GET" && frame)) {
      void serveFrame(request, response, url, frame?.[1]).catch(() => endError(response, 503, "Preview could not be served."));
      return;
    }
    const headers = safeHeaders(request.headers);
    headers.host = `${LOOPBACK}:${targetPort}`;
    const upstream = upstreamRequest({ hostname: LOOPBACK, port: targetPort, method: request.method, path: request.url, headers }, incoming => {
      if (response.destroyed || response.headersSent) { incoming.destroy(); return; }
      response.writeHead(incoming.statusCode ?? 502, safeHeaders(incoming.headers));
      incoming.on("error", () => endError(response, 502, "Upstream response interrupted."));
      incoming.pipe(response);
    });
    const deadline = setTimeout(() => upstream.destroy(new Error("Upstream deadline.")), UPSTREAM_TIMEOUT_MS);
    deadline.unref();
    response.once("finish", () => clearTimeout(deadline));
    response.once("close", () => clearTimeout(deadline));
    upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => upstream.destroy(new Error("Upstream timeout.")));
    upstream.on("error", () => endError(response, 502, "Upstream is unavailable."));
    request.on("aborted", () => upstream.destroy());
    request.on("error", () => upstream.destroy());
    response.on("close", () => { if (!response.writableFinished) upstream.destroy(); });
    request.pipe(upstream);
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  return server;
}

function main(): void {
  const { values } = parseArgs({ options: { host: { type: "string" }, "listen-port": { type: "string" }, "upstream-port": { type: "string" } }, strict: true, allowPositionals: false });
  if (values.host !== LOOPBACK) throw new Error("The explicit host must be 127.0.0.1.");
  const listenPort = port(Number(values["listen-port"])), upstreamPort = port(Number(values["upstream-port"]));
  if (listenPort === upstreamPort) throw new Error("Gateway and writer ports must differ.");
  if ((process.env.EMISSION_LENS_WORKER_TOKEN?.length ?? 0) < 32) throw new Error("Configure the private worker token in the process environment.");
  const server = createPreviewGateway({ upstreamPort });
  server.on("error", () => { console.error("Preview gateway could not listen."); process.exitCode = 1; });
  server.listen(listenPort, LOOPBACK, () => console.log(`Preview gateway listening on ${LOOPBACK}:${listenPort}; writer ${LOOPBACK}:${upstreamPort}.`));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { server.close(); server.closeIdleConnections(); });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch { console.error("Preview gateway requires explicit loopback host, distinct valid ports, and a private worker token."); process.exitCode = 1; }
}
