import {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  listCameras,
  read_measurement_window,
} from "@emission-lens/backend";
import { preferredInvestigationWindow } from "@/lib/preferred-window";
import { WorkspaceDisclosure } from "@/components/WorkspaceDisclosure";
import { Suspense } from "react";
import { ContextPanel } from "@/components/ContextPanel";
import { ReviewPanel } from "@/components/ReviewPanel";
import { PlanningPanel } from "@/components/PlanningPanel";
import { AppShell } from "@/components/AppShell";
import { OverviewBoard } from "@/components/OverviewBoard";
import { workspaceQuery } from "@/lib/workspace-query";
import { CameraDetail } from "@/components/CameraDetail";
import { registryCalibrationState } from "@/lib/measurement";
import { isRichSyntheticWindow, latestSupportedMapEstimate } from "@/lib/map-emissions";
import { latestSupportedMinuteCohort, measurementSupport } from "@/lib/observation-presentation";
import { hrefWith, parseMode, parseView, parseReduction } from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; view?: string; reduce?: string; from?: string; to?: string; window?: string }>;
}) {
  let query = workspaceQuery(await searchParams);
  const mode = parseMode(query.mode);
  const view = parseView(query.view);
  const now = new Date();
  const configured = listCameras();
  const selectedId = configured.some(camera => camera.id === query.camera) ? query.camera! : configured[0].id;
  let selectedMeasurement: ReturnType<typeof read_measurement_window> | undefined;
  const cameras = configured.map((camera) => {
    const measurement = read_measurement_window({ cameraId: camera.id, mode, now });
    if (camera.id === selectedId) selectedMeasurement = measurement;
    const mapEstimate = latestSupportedMapEstimate(measurement);
    return {
      camera,
      status: get_camera_status(camera.id, mode, now),
      traffic: get_traffic_window({ cameraId: camera.id, mode, now }),
      emissions: get_emissions_window({ cameraId: camera.id, mode, now }),
      calibration: registryCalibrationState(measurement.registry),
      mapEstimate,
      syntheticDemoEligible: isRichSyntheticWindow(measurement),
      minuteCohort: latestSupportedMinuteCohort(measurement),
      measurementSupport: measurementSupport(measurement.registry, mapEstimate),
    };
  });
  if (selectedMeasurement) query = preferredInvestigationWindow(query, selectedMeasurement);
  return (
    <AppShell
      mode={mode}
      section="overview"
      cameraId={selectedId}
      workspaceParams={{ reduce: query.reduce, from: query.from, to: query.to, view: query.view, window: query.window }}
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
      <WorkspaceDisclosure id="context" className="workspace-section workspace-module method-context-disclosure" eyebrow="03 / External inputs" title="Weather and regional context" summary="Timestamped external sources, kept separate from camera estimates.">
        <Suspense fallback={<p className="context-note" role="status">Loading timestamped external context…</p>}><ContextPanel cameraId={selectedId} mode={mode} from={query.from} to={query.to} now={now} /></Suspense>
      </WorkspaceDisclosure>
      <WorkspaceDisclosure id="review" className="workspace-section workspace-module" eyebrow="04 / Evidence review" title="Review the evidence" summary="Record an investigation note, inspect provenance and retain the original observations.">
        <ReviewPanel cameraId={selectedId} mode={mode} from={query.from} to={query.to} now={now} />
      </WorkspaceDisclosure>
      <section id="planning" className="workspace-section workspace-module">
        <header className="workspace-module-heading"><span>05 / Planning brief</span><h2>Scoped investigation draft</h2><p>Use the selected camera, data mode and dated interval. Review the calculations and limitations before exporting the exact local draft.</p></header>
        <Suspense fallback={<p className="context-note" role="status">Preparing scoped evidence and draft…</p>}><PlanningPanel key={`${selectedId}-${mode}-${query.reduce}-${query.from}-${query.to}`} cameraId={selectedId} mode={mode} reduction={parseReduction(query.reduce)} from={query.from} to={query.to} now={now} /></Suspense>
      </section>
      </div>
    </AppShell>
  );
}
