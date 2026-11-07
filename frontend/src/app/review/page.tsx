import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui";
import { hrefWith, modeLabel, parseMode } from "@/lib/format";

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const mode = parseMode((await searchParams).mode);
  return (
    <AppShell
      mode={mode}
      section="review"
      modeHref={(option) => hrefWith("/review", { mode: option })}
    >
      <div className="page">
        <header className="page-head">
          <p className="section-kicker">Evidence quality</p>
          <h1 className="page-title">A little review. Better evidence.</h1>
          <p className="prose">
            A place to check uncertain observations, flag camera changes, and
            keep the reasoning behind every estimate clear.
          </p>
        </header>
        <div className="metric-grid">
          <article className="summary-card">
            <span className="section-kicker">Loaded review items</span>
            <strong>0</strong>
            <p>
              No review records are connected in {modeLabel(mode).toLowerCase()}{" "}
              mode.
            </p>
          </article>
          <article className="summary-card">
            <span className="section-kicker">Review history</span>
            <strong>Not connected</strong>
            <p>Corrections will stay linked to the original observation.</p>
          </article>
          <article className="summary-card">
            <span className="section-kicker">What stays protected</span>
            <strong>Original evidence</strong>
            <p>A review adds context rather than overwriting a record.</p>
          </article>
        </div>
        <div className="split split-narrow">
          <Panel title="What belongs in a review?">
            <ul className="dimension-list">
              <li>
                <b>Uncertain vehicle class</b>
                <p>
                  Check a low-confidence classification against its source
                  evidence.
                </p>
              </li>
              <li>
                <b>Camera movement or calibration</b>
                <p>
                  Flag a shifted view before using distance, speed, or
                  movement-dependent emissions.
                </p>
              </li>
              <li>
                <b>Incomplete observations</b>
                <p>
                  Inspect missing coverage, interrupted tracks, or inconsistent
                  timestamps.
                </p>
              </li>
            </ul>
            <details className="disclosure">
              <summary>How a correction will be recorded</summary>
              <ol className="limits">
                <li>Keep the original observation and its provenance.</li>
                <li>
                  Add the correction or calibration flag with its own UTC
                  timestamp.
                </li>
                <li>
                  Recalculate dependent results only where the method supports
                  it.
                </li>
              </ol>
            </details>
          </Panel>
          <Panel
            title="Review queue"
            meta={<span className="chip">{modeLabel(mode)}</span>}
            flush
          >
            <div className="empty-state">
              <span className="section-kicker">Nothing loaded yet</span>
              <h2>No observations waiting here</h2>
              <p>
                The review feed is not connected. An empty queue does not mean
                the camera observations have been checked or approved.
              </p>
              <div className="button-row">
                <Link
                  className="button button-primary"
                  href={hrefWith("/", { mode })}
                >
                  Explore intersections
                </Link>
                <Link
                  className="button"
                  href={hrefWith("/cameras/222", { mode }) + "#evidence"}
                >
                  View calibration readiness
                </Link>
              </div>
            </div>
            <div className="panel-body">
              <p className="context-note">
                Reviewing evidence supports better estimates. It does not turn
                modeled emissions into measured air quality.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
