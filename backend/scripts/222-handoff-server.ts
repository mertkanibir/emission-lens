/** Isolated loopback acceptance server; uses the production backend handlers. */
import { createServer } from "node:http";
import { Readable } from "node:stream";
import {
  handleWorkerPost,
  handleMeasurementPost,
  handleMeasurementGet,
  handleMeasurementEvidenceGet,
  handleMeasurementRefreshPost,
  get_traffic_window,
  get_emissions_window,
  compare_scenario,
  draft_brief,
} from "../src/index.ts";

if (
  !process.env.EMISSION_LENS_REGISTRY_PATH ||
  !process.env.EMISSION_LENS_STORE_PATH ||
  !process.env.EMISSION_LENS_WORKER_TOKEN
)
  throw new Error("An isolated registry/store/token environment is required.");
const counters = {
  measurement_posts: 0,
  duplicates: 0,
  dropped_acknowledgements: 0,
};
const server = createServer(async (incoming, outgoing) => {
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("No listener.");
    const url = new URL(
      incoming.url ?? "/",
      `http://127.0.0.1:${address.port}`,
    );
    const headers = new Headers();
    for (const [key, value] of Object.entries(incoming.headers)) {
      if (value !== undefined)
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    const init: RequestInit & { duplex?: "half" } = {
      method: incoming.method,
      headers,
    };
    if (!["GET", "HEAD"].includes(incoming.method ?? "GET")) {
      init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>;
      init.duplex = "half";
    }
    const request = new Request(url, init);
    let response: Response;
    if (url.pathname === "/api/worker" && incoming.method === "POST")
      response = await handleWorkerPost(request);
    else if (url.pathname === "/api/measurements" && incoming.method === "POST")
      response = await handleMeasurementPost(request);
    else if (url.pathname === "/api/measurements" && incoming.method === "GET")
      response = await handleMeasurementGet(request);
    else if (
      url.pathname === "/api/measurements/refresh" &&
      incoming.method === "POST"
    )
      response = await handleMeasurementRefreshPost(request);
    else if (url.pathname === "/api/measurements/evidence")
      response = await handleMeasurementEvidenceGet(request);
    else if (
      url.pathname === "/api/handoff-counters" &&
      incoming.method === "GET"
    )
      response = Response.json(counters);
    else if (url.pathname === "/api/222-read" && incoming.method === "GET") {
      const mode = url.searchParams.get("mode");
      if (mode !== "live" && mode !== "replay" && mode !== "synthetic")
        response = Response.json({ error: "Invalid mode." }, { status: 400 });
      else
        response = Response.json(
          {
            traffic: get_traffic_window({ cameraId: "222", mode }),
            emissions: get_emissions_window({ cameraId: "222", mode }),
            scenario: compare_scenario({
              cameraId: "222",
              mode,
              stoppedTimeReductionPct: 20,
            }),
            brief: draft_brief({ cameraId: "222", mode }),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
    } else response = Response.json({ error: "Not found." }, { status: 404 });
    if (url.pathname === "/api/measurements" && incoming.method === "POST") {
      counters.measurement_posts++;
      const receipt = await response.clone().json();
      if (receipt.duplicate === true) counters.duplicates++;
      if (
        response.status === 202 &&
        process.env.EMISSION_LENS_HANDOFF_DROP_ACK === "1" &&
        counters.dropped_acknowledgements === 0
      ) {
        counters.dropped_acknowledgements++;
        outgoing.destroy();
        return;
      }
    }
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(503, { "Content-Type": "application/json" });
    outgoing.end('{"error":"Isolated handoff request failed."}');
  }
});
server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string")
    process.stdout.write(JSON.stringify({ port: address.port }) + "\n");
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));
