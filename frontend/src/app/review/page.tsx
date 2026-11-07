import { AppShell } from "@/components/AppShell";
import { Panel } from "@/components/ui";
import { hrefWith, parseMode } from "@/lib/format";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = parseMode((await searchParams).mode);

  return (
    <AppShell mode={mode} section="review" modeHref={(option) => hrefWith("/review", { mode: option })}>
      <div className="page">
        <header className="page-head">
          <h1 className="page-title">Review queue</h1>
          <p className="prose">
            Uncertain observations wait here for a person to check them. A correction is stored next to the original
            record, never over it.
          </p>
        </header>

        <div className="split split-narrow">
          <Panel title="How a review works">
            <ul className="checklist">
              <li>
                <span className="check-mark" aria-hidden="true">1</span>
                <span>The original observation and its provenance are kept.</span>
                <span />
              </li>
              <li>
                <span className="check-mark" aria-hidden="true">2</span>
                <span>A correction or calibration flag is recorded separately, with its own UTC timestamp.</span>
                <span />
              </li>
              <li>
                <span className="check-mark" aria-hidden="true">3</span>
                <span>Dependent results are recalculated only where the method supports it.</span>
                <span />
              </li>
            </ul>
          </Panel>

          <Panel title="Open items" meta={<span className="mono">0 open</span>} flush>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Evidence</th>
                    <th>Issue</th>
                    <th>Correction</th>
                    <th>Status</th>
                    <th>Updated (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="empty-row">
                    <td colSpan={5}>
                      No open reviews. Nothing is waiting, so no placeholder item is shown.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
