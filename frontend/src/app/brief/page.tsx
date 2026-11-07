import {
  draft_brief,
  get_camera_status,
  listCameras,
  rank_investigation_priorities,
} from "@emission-lens/backend";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { BriefActions } from "@/components/BriefActions";
import { ReductionInput } from "@/components/ReductionInput";
import { Panel } from "@/components/ui";
import {
  hrefWith,
  isValidReduction,
  modeLabel,
  parseMode,
  parseReduction,
  stateLabel,
} from "@/lib/format";

export default async function BriefPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; reduce?: string }>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const cameras = listCameras();
  const cameraId = cameras.some((camera) => camera.id === query.camera)
    ? (query.camera as string)
    : "222";
  const camera = cameras.find((item) => item.id === cameraId)!;
  const reduction = parseReduction(query.reduce);
  const validReduction = isValidReduction(reduction);
  const brief = validReduction
    ? draft_brief({ cameraId, mode, stoppedTimeReductionPct: reduction })
    : null;
  const ranking = rank_investigation_priorities({ cameraId, mode });

  return (
    <AppShell
      mode={mode}
      section="brief"
      modeHref={(option) =>
        hrefWith("/brief", {
          mode: option,
          camera: cameraId,
          reduce: query.reduce,
        })
      }
    >
      <div className="page brief-page">
        <header className="page-head">
          <p className="section-kicker">From observations to next steps</p>
          <h1 className="page-title">Make the evidence useful.</h1>
          <p className="prose">
            Build a plain-language investigation brief with the camera,
            reporting window, scenario, and limitations in one place. Review it,
            then save a local copy.
          </p>
        </header>
        <div className="split split-narrow">
          <div className="stack">
            <Panel
              title="Build your brief"
              meta={<span className="chip">{modeLabel(mode)}</span>}
            >
              <form action="/brief" method="get" className="form-grid">
                {mode === "live" ? null : (
                  <input type="hidden" name="mode" value={mode} />
                )}
                <div className="field">
                  <label className="field-label" htmlFor="camera">
                    Intersection
                  </label>
                  <select
                    key={`${cameraId}-${mode}`}
                    id="camera"
                    name="camera"
                    defaultValue={cameraId}
                  >
                    {cameras.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id} · {item.name} (
                        {stateLabel(
                          get_camera_status(item.id, mode).displayed_state,
                        ).toLowerCase()}
                        )
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    One camera and reporting window per brief.
                  </span>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="reduce">
                    Hypothetical reduction in stopped time
                  </label>
                  <ReductionInput
                    key={`${cameraId}-${mode}-${reduction}`}
                    id="reduce"
                    defaultValue={validReduction ? reduction : 20}
                  />
                  <span className="field-hint">
                    A comparison assumption, not a promised real-world
                    improvement.
                  </span>
                </div>
                <button className="button button-primary" type="submit">
                  Update brief
                </button>
              </form>
              <p className="context-note">
                This draft is assembled directly from structured evidence. No
                language-model service is connected, and nothing is
                automatically sent.
              </p>
            </Panel>
            <Panel
              title="Where to investigate next"
              meta="Evidence by dimension"
            >
              <p className="fine">
                Each dimension is explained separately. There is no combined
                risk score or medical claim.
              </p>
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
          <div className="stack">
            {brief === null ? (
              <Panel title="Brief preview">
                <div className="empty-state">
                  <h2>Choose a valid scenario</h2>
                  <p role="alert">
                    Enter a percentage from 0 to 100, then update the brief.
                  </p>
                </div>
              </Panel>
            ) : (
              <Panel
                title="Your investigation brief"
                meta={<span className="chip chip-draft">Draft · not sent</span>}
                flush
              >
                <article className="brief-document" aria-label="Brief text">
                  <header className="document-heading">
                    <span className="section-kicker">
                      Emission Lens · Investigation brief
                    </span>
                    <h2>{camera.name}</h2>
                    <div className="page-meta">
                      <span>Camera {cameraId}</span>
                      <span>{modeLabel(mode)}</span>
                      <span>{reduction}% shorter-stop scenario</span>
                    </div>
                  </header>
                  {brief.text
                    .split("\n")
                    .slice(1)
                    .map((line, index) => {
                      const colon = line.indexOf(":");
                      const hasLabel = colon > 0 && colon < 28;
                      return (
                        <p className="brief-line" key={index}>
                          {hasLabel ? (
                            <>
                              <strong>{line.slice(0, colon)}</strong>
                              <span>{line.slice(colon + 1).trim()}</span>
                            </>
                          ) : (
                            line
                          )}
                        </p>
                      );
                    })}
                </article>
                <div className="panel-body">
                  <details className="disclosure brief-evidence">
                    <summary>Trace this draft to its evidence records</summary>
                    <div className="evidence-list">
                      {brief.evidence_references.map((reference) => (
                        <code key={reference}>{reference}</code>
                      ))}
                    </div>
                    <p className="fine">
                      Review status: {brief.review_status}. The original records
                      and their data modes remain separate.
                    </p>
                  </details>
                  <BriefActions
                    key={`${cameraId}-${mode}-${reduction}`}
                    text={brief.text}
                    filename={`emission-lens-brief-${brief.camera_id}-${brief.mode}.txt`}
                  />
                  <Link
                    className="button"
                    href={hrefWith(`/cameras/${cameraId}`, {
                      mode,
                      reduce: validReduction ? reduction : undefined,
                    })}
                  >
                    Inspect the underlying camera evidence
                  </Link>
                </div>
              </Panel>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
