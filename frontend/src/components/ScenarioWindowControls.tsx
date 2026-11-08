import Link from "next/link";
import type { Mode } from "@emission-lens/contracts";
import { formatInstant, formatWindow, hrefWith, modeLabel, PACIFIC } from "@/lib/format";

export function ScenarioWindowControls({ cameraId, mode, reduction, from, to, explicit, candidate, error, workspace = false }: {
  workspace?: boolean;
  cameraId: string;
  mode: Mode;
  reduction: number;
  from: string;
  to: string;
  explicit: boolean;
  candidate: { from: string; to: string } | null;
  error: string | null;
}) {
  return (
    <div className="context-note" aria-label="Scenario comparison window">
      <h3>Scenario comparison window</h3>
      {error ? <p role="alert">Selected window could not be used: {error} Showing the reporting-hour comparison below.</p> : null}
      <p><strong>{explicit ? "Selected window" : "Reporting hour"}</strong> · Camera {cameraId} · {modeLabel(mode)}<br />
        {formatInstant(from, PACIFIC)} to {formatInstant(to, PACIFIC)}</p>
      <p className="fine">{explicit
        ? "Only this interval's original completed-movement cohort is compared. Every included minute must be supported; gaps stay unavailable. Reporting-hour totals stay separate. A planning brief must explicitly identify its selected interval."
        : "The hour includes all retained minutes, including insufficient evidence. A completed supported minute can be inspected separately without filling gaps in the hour."}</p>
      <nav className="scenario-window-actions" aria-label="Choose scenario comparison window">
        <Link className="button" aria-current={!explicit ? "true" : undefined} href={`${hrefWith(workspace ? "/" : `/cameras/${cameraId}`, { mode, camera: workspace ? cameraId : undefined, reduce: reduction })}#scenario`}>Use reporting hour</Link>
        {candidate ? <Link className="button" aria-current={explicit && Date.parse(from) === Date.parse(candidate.from) && Date.parse(to) === Date.parse(candidate.to) ? "true" : undefined} href={`${hrefWith(workspace ? "/" : `/cameras/${cameraId}`, { mode, camera: workspace ? cameraId : undefined, reduce: reduction, from: candidate.from, to: candidate.to })}#scenario`}>Use latest complete supported minute · {formatWindow(candidate.from, candidate.to, PACIFIC)}</Link> : <span className="fine">No complete supported minute is available in this reporting hour.</span>}
      </nav>
    </div>
  );
}
