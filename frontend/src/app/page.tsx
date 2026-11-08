import {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  get_measurement_registry_status,
  listCameras,
} from "@emission-lens/backend";
import { AppShell } from "@/components/AppShell";
import { OverviewBoard } from "@/components/OverviewBoard";
import { registryCalibrationState } from "@/lib/measurement";
import { hrefWith, parseMode, parseView } from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; view?: string }>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const view = parseView(query.view);
  const now = new Date();
  const cameras = listCameras().map((camera) => ({
    camera,
    status: get_camera_status(camera.id, mode, now),
    traffic: get_traffic_window({ cameraId: camera.id, mode, now }),
    emissions: get_emissions_window({ cameraId: camera.id, mode, now }),
    calibration: registryCalibrationState(get_measurement_registry_status(camera.id, mode)),
  }));
  const selectedId = cameras.some((item) => item.camera.id === query.camera)
    ? query.camera!
    : cameras[0].camera.id;
  return (
    <AppShell
      mode={mode}
      section="overview"
      modeHref={(option) =>
        hrefWith("/", {
          mode: option,
          camera: selectedId,
          view: view === "activity" ? undefined : view,
        })
      }
    >
      <OverviewBoard
        cameras={cameras}
        selectedId={selectedId}
        mode={mode}
        view={view}
      />
    </AppShell>
  );
}
