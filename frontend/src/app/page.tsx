import {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  listCameras,
  read_measurement_window,
} from "@emission-lens/backend";
import { Suspense } from "react";
import { ContextPanel } from "@/components/ContextPanel";
import { ReviewPanel } from "@/components/ReviewPanel";
import { PlanningPanel } from "@/components/PlanningPanel";
import { AppShell } from "@/components/AppShell";
import { OverviewBoard } from "@/components/OverviewBoard";
import { workspaceQuery } from "@/lib/workspace-query";
import { CameraDetail } from "@/components/CameraDetail";
import { registryCalibrationState } from "@/lib/measurement";
import { latestSupportedMapEstimate } from "@/lib/map-emissions";
import { latestSupportedMinuteCohort, measurementSupport } from "@/lib/observation-presentation";
import { hrefWith, parseMode, parseView, parseReduction } from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; view?: string; reduce?: string; from?: string; to?: string; window?: string }>;
}) {
  const query = workspaceQuery(await searchParams);
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
      <section id="context" className="workspace-section workspace-module">
        <header className="workspace-module-heading"><span>03 / External inputs</span><h2>Source context and model assumptions</h2><p>Timestamped contextual records remain separate from the fixed meteorology and fleet assumptions used in each emissions calculation.</p></header>
        <Suspense fallback={<p className="context-note" role="status">Loading timestamped external context…</p>}><ContextPanel cameraId={selectedId} mode={mode} from={query.from} to={query.to} now={now} /></Suspense>
      </section>
      <section id="review" className="workspace-section workspace-module">
        <header className="workspace-module-heading"><span>04 / Evidence review</span><h2>Review records and preserve provenance</h2><p>Annotate uncertainty, track investigation state and retain the original camera evidence. A review does not itself approve calibration or alter observations.</p></header>
        <ReviewPanel cameraId={selectedId} mode={mode} from={query.from} to={query.to} now={now} />
      </section>
      <section id="planning" className="workspace-section workspace-module">
        <header className="workspace-module-heading"><span>05 / Planning brief</span><h2>Scoped investigation draft</h2><p>Use the selected camera, data mode and dated interval. Review the calculations and limitations before exporting the exact local draft.</p></header>
        <Suspense fallback={<p className="context-note" role="status">Preparing scoped evidence and draft…</p>}><PlanningPanel key={`${selectedId}-${mode}-${query.reduce}-${query.from}-${query.to}`} cameraId={selectedId} mode={mode} reduction={parseReduction(query.reduce)} from={query.from} to={query.to} now={now} /></Suspense>
      </section>
      </div>
    </AppShell>
  );
}
