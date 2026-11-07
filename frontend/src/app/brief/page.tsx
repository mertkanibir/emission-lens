import { draft_brief, get_camera_status, listCameras, rank_investigation_priorities } from "@emission-lens/backend";
import { AppShell } from "@/components/AppShell";
import { ReductionInput } from "@/components/ReductionInput";
import { Panel } from "@/components/ui";
import { hrefWith, isValidReduction, modeLabel, parseMode, parseReduction, stateLabel } from "@/lib/format";

export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; reduce?: string }>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const cameras = listCameras();
  const cameraId = cameras.some((camera) => camera.id === query.camera) ? (query.camera as string) : "222";
  const reduction = parseReduction(query.reduce);
  const validReduction = isValidReduction(reduction);
  const brief = validReduction ? draft_brief({ cameraId, mode, stoppedTimeReductionPct: reduction }) : null;
  const ranking = rank_investigation_priorities({ cameraId, mode });
  const download = brief
    ? `data:text/plain;charset=utf-8,${encodeURIComponent(brief.text)}`
    : null;

  return (
    <AppShell
      mode={mode}
      section="brief"
      modeHref={(option) => hrefWith("/brief", { mode: option, camera: cameraId, reduce: query.reduce })}
    >
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Investigation brief</h1>
          <p className="prose">
            A draft assembled from stored records for one camera and window. You can review it and save a copy. It is
            never sent anywhere.
          </p>
        </header>

        <div className="split split-narrow">
          <div className="stack">
            <Panel title="Draft settings" meta={modeLabel(mode)}>
              <form action="/brief" method="get" className="form-grid">
                {mode === "live" ? null : <input type="hidden" name="mode" value={mode} />}
                <div className="field">
                  <label className="field-label" htmlFor="camera">
                    Camera
                  </label>
                  <select id="camera" name="camera" defaultValue={cameraId}>
                    {cameras.map((camera) => (
                      <option key={camera.id} value={camera.id}>
                        {camera.id}, {camera.name} ({stateLabel(get_camera_status(camera.id, mode).displayed_state).toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="reduce">
                    Stopped-time reduction to compare
                  </label>
                  <ReductionInput id="reduce" defaultValue={validReduction ? reduction : 20} />
                  <span className="field-hint">Change the data mode from the bar at the top of the page.</span>
                </div>
                <div>
                  <button className="button button-primary" type="submit">
                    Draft brief
                  </button>
                </div>
              </form>
            </Panel>

            <Panel title="Investigation priorities" meta="By dimension, no combined score">
              <ul className="dimension-list">
                {ranking.dimensions.map((item) => (
                  <li key={item.dimension}>
                    <b>{item.dimension}</b>
                    <p>{item.evidence}</p>
                    <p className="step">{item.suggested_step}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          {brief === null ? (
            <Panel title="Draft">
              <p className="note">Enter a whole percentage from 0 to 100 to draft a brief.</p>
            </Panel>
          ) : (
            <Panel
              title={`Draft for camera ${brief.camera_id}`}
              meta={
                <>
                  <span className="chip chip-draft">Draft, not sent</span>
                  <span>Review status {brief.review_status}</span>
                  <span>Model unavailable</span>
                </>
              }
              flush
            >
              <ol className="printout" aria-label="Brief text">
                {brief.text.split("\n").map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ol>
              <div className="panel-body">
                <div className="field">
                  <span className="field-label">Evidence records</span>
                  <div className="evidence-list">
                    {brief.evidence_references.map((reference) => (
                      <code key={reference}>{reference}</code>
                    ))}
                  </div>
                </div>
                <div className="button-row">
                  {download ? (
                    <a className="button" href={download} download={`emission-lens-brief-${brief.camera_id}-${brief.mode}.txt`}>
                      Save draft as text
                    </a>
                  ) : null}
                </div>
                <p className="fine">Saving writes a local file only. Nothing is emailed, posted, or sent to an agency.</p>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </AppShell>
  );
}
