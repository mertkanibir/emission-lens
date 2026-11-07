import {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  listCameras,
} from "@emission-lens/backend";
import { calibrationFor } from "@emission-lens/contracts";
import { AppShell } from "@/components/AppShell";
import { OverviewBoard } from "@/components/OverviewBoard";
import { hrefWith, parseMode, parseView } from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; view?: string }>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const view = parseView(query.view);
  const cameras = listCameras().map((camera) => ({
    camera,
    status: get_camera_status(camera.id, mode),
    traffic: get_traffic_window({ cameraId: camera.id, mode }),
    emissions: get_emissions_window({ cameraId: camera.id, mode }),
    calibration: calibrationFor(camera.id).validation_status,
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
