import {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  listCameras,
  read_measurement_window,
} from "@emission-lens/backend";
import { AppShell } from "@/components/AppShell";
import { OverviewBoard } from "@/components/OverviewBoard";
import { CameraDetail } from "@/components/CameraDetail";
import { registryCalibrationState } from "@/lib/measurement";
import { latestSupportedMapEstimate } from "@/lib/map-emissions";
import { latestSupportedMinuteCohort, measurementSupport } from "@/lib/observation-presentation";
import { hrefWith, parseMode, parseView } from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; view?: string; reduce?: string; from?: string; to?: string }>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const view = parseView(query.view);
  const now = new Date();
  const cameras = listCameras().map((camera) => {
    const measurement = read_measurement_window({ cameraId: camera.id, mode, now });
    const mapEstimate = latestSupportedMapEstimate(measurement);
    return {
      camera,
      status: get_camera_status(camera.id, mode, now),
      traffic: get_traffic_window({ cameraId: camera.id, mode, now }),
      emissions: get_emissions_window({ cameraId: camera.id, mode, now }),
      calibration: registryCalibrationState(measurement.registry),
      mapEstimate,
      minuteCohort: latestSupportedMinuteCohort(measurement),
      measurementSupport: measurementSupport(measurement.registry, mapEstimate),
    };
  });
  const selectedId = cameras.some((item) => item.camera.id === query.camera)
    ? query.camera!
    : cameras[0].camera.id;
  return (
    <AppShell
      mode={mode}
      section="overview"
      cameraId={selectedId}
      modeHref={(option) =>
        hrefWith("/", {
          mode: option,
          camera: selectedId,
          view: view === "activity" ? undefined : view,
        })
      }
    >
      <div className="single-workspace">
      <OverviewBoard
        cameras={cameras}
        selectedId={selectedId}
        mode={mode}
        view={view}
      />
      <section id="selected-camera" className="workspace-section"><CameraDetail id={selectedId} query={query} now={now} embedded /></section>
      </div>
    </AppShell>
  );
}
