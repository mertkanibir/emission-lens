/** Mert's isolated acceptance listener; never run against an application store. */
import { createServer } from "node:http";
import { Readable } from "node:stream";
import { handleWorkerPost, handleMeasurementPost, handleMeasurementGet,
  get_camera_status, get_traffic_window, get_emissions_window } from "../../backend/src/index.ts";

if (!process.env.EMISSION_LENS_REGISTRY_PATH || !process.env.EMISSION_LENS_STORE_PATH ||
    !process.env.EMISSION_LENS_WORKER_TOKEN || !process.env.EMISSION_LENS_STORE_PATH.includes("runs/reliability/"))
  throw new Error("A private reliability registry, store and token are required.");
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers))
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(",") : value);
    const init: RequestInit & { duplex?: "half" } = { method: incoming.method, headers };
    if (!["GET", "HEAD"].includes(incoming.method ?? "GET")) {
      init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>; init.duplex = "half";
    }
    const request = new Request(url, init);
    let response: Response;
    if (url.pathname === "/api/worker" && incoming.method === "POST") response = await handleWorkerPost(request);
    else if (url.pathname === "/api/measurements" && incoming.method === "POST") response = await handleMeasurementPost(request);
    else if (url.pathname === "/api/measurements") response = await handleMeasurementGet(request);
    else if (url.pathname === "/read") {
      const mode = url.searchParams.get("mode");
      if (mode !== "replay" && mode !== "live") response = Response.json({}, { status: 400 });
      else response = Response.json({ status: get_camera_status("222", mode),
        traffic: get_traffic_window({cameraId: "222", mode}),
        emissions: get_emissions_window({cameraId: "222", mode}) });
    } else response = Response.json({}, {status:404});
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(503); outgoing.end('{}'); }
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string") console.log(JSON.stringify({port:address.port}));
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
