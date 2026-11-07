import { get_camera_status, get_emissions_window, get_traffic_window, listCameras, readWorkerStore } from "@emission-lens/backend";
import { calibrationFor, CONTRACT_VERSION } from "@emission-lens/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public aggregate records only. No credentials, frames or temporary track IDs. */
export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("mode") ?? "live";
  if (requested !== "live" && requested !== "replay" && requested !== "synthetic") {
    return Response.json({ error: "Unknown data mode." }, { status: 400 });
  }
  try {
    const now = new Date();
    return Response.json({
      contract_version: CONTRACT_VERSION,
      mode: requested,
      as_of: now.toISOString(),
      runs: readWorkerStore().runs.filter((run) => run.mode === requested),
      cameras: listCameras().map((camera) => ({
        camera, calibration: calibrationFor(camera.id),
        status: get_camera_status(camera.id, requested, now),
        traffic: get_traffic_window({ cameraId: camera.id, mode: requested, now }),
        emissions: get_emissions_window({ cameraId: camera.id, mode: requested, now }),
      })),
    }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "Camera records are temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
