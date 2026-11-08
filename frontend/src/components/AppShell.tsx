import {
  get_camera_status,
  get_traffic_window,
  get_measurement_registry_status,
  listCameras,
} from "@emission-lens/backend";
import { type Mode } from "@emission-lens/contracts";
import Link from "next/link";
import { CaretDown, Info, ArrowUpRight, Gauge } from "@phosphor-icons/react/dist/ssr";
import { MotionControl } from "@/components/MotionControl";
import { WorkspaceMenus } from "@/components/WorkspaceMenus";
import { Clock } from "@/components/Clock";
import { LiveRefresh } from "@/components/LiveRefresh";
import { sourceLinks } from "@/lib/source-links";
import { formatClock, hrefWith, modeLabel, PACIFIC, zoneAbbreviation } from "@/lib/format";

export type Section = "overview" | "camera" | "review" | "brief";
const MODES: Mode[] = ["live", "replay", "synthetic"];
const SECTIONS = [
  { anchor: "network", label: "Network" },
  { anchor: "selected-camera", label: "Camera evidence" },
  { anchor: "context", label: "External inputs" },
  { anchor: "review", label: "Evidence review" },
  { anchor: "planning", label: "Planning brief" },
];

/** One technical workspace. Dedicated routes remain available as deep links. */
export function AppShell({ mode, section, modeHref, cameraId = "222", workspaceParams = {}, children }: {
  mode: Mode;
  section: Section;
  modeHref: (mode: Mode) => string;
  cameraId?: string;
  workspaceParams?: { reduce?: string | number; from?: string; to?: string; view?: string };
  children: React.ReactNode;
}) {
  const source = sourceLinks(process.env.EMISSION_LENS_WEB_SOURCE_REVISION);
  const cameras = listCameras();
  const statuses = cameras.map((camera) => get_camera_status(camera.id, mode));
  const fresh = statuses.filter((status) => status.displayed_state === "live").length;
  const calibrated = cameras.filter((camera) => get_measurement_registry_status(camera.id, mode).physical_calibration_approved).length;
  const asOf = statuses[0].as_of;
  const hasTraffic = cameras.some((camera) => get_traffic_window({ cameraId: camera.id, mode }).rows.length > 0);
  const note = mode === "synthetic"
    ? "Labeled test records. Excluded from live totals."
    : mode === "replay"
      ? hasTraffic ? "Recorded observations. Separate from live totals." : "No replay records in the reporting window."
      : fresh === 0 ? "No fresh processing heartbeat. Retained history remains dated." : "Live processing. Retained estimates and feed freshness are separate.";
  const workspaceHref = (anchor: string) => section === "overview" ? `#${anchor}` : `${hrefWith("/", { ...workspaceParams, mode, camera: cameraId })}#${anchor}`;
  return (
    <div className="app technical-workspace" data-mode={mode}>
      <LiveRefresh mode={mode} />
      <WorkspaceMenus />
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="instrument-header">
        <a className="instrument-brand" href={workspaceHref("network")} aria-label="Emission Lens workspace">
          <img src="/brand/mark.svg" width={34} height={34} alt="" />
          <span><strong>Emission Lens</strong><small>Traffic observation · emissions modeling</small></span>
        </a>
        <div className="instrument-controls">
          <Clock />
          <MotionControl />
          <details suppressHydrationWarning data-menu className="status-menu">
            <summary aria-label="Data status"><Gauge size={16} /><span>{fresh}/{cameras.length} fresh</span><CaretDown size={12} /></summary>
            <div className="status-popover">
              <strong>Processing status</strong>
              <p>Evaluated at the selected mode's data clock.</p>
              <dl>
                <div><dt>Fresh heartbeats</dt><dd>{fresh} / {cameras.length}</dd></div>
                <div><dt>Registry-approved calibrations</dt><dd>{calibrated} / {cameras.length}</dd></div>
                <div><dt>RUNEX factor catalog</dt><dd>Available</dd></div>
              </dl>
              <p>Approval and fresh imagery do not establish field accuracy. Counts, completed traversals and estimates have separate support.</p>
            </div>
          </details>
        </div>
      </header>
      <div className="workspace-navigation">
        <nav aria-label="Workspace sections">
          {SECTIONS.map((item, index) => <a key={item.anchor} href={workspaceHref(item.anchor)} aria-current={section === "overview" && index === 0 ? "page" : undefined}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</a>)}
        </nav>
        <nav className="mode-switch" aria-label="Data mode">
          {MODES.map((option) => <Link key={option} href={modeHref(option)} aria-current={option === mode ? "page" : undefined}><span className={`swatch swatch-${option}`} />{modeLabel(option)}</Link>)}
        </nav>
      </div>
      <div className="mode-strip" role="note" aria-label="Data provenance">
        <Info size={14} /><span className="mode-tag">{modeLabel(mode)}</span><span className="mode-message">{note}</span>
        <span className="data-clock">Data as of {formatClock(asOf, PACIFIC)} {zoneAbbreviation(asOf, PACIFIC)} / {formatClock(asOf, "UTC")} UTC</span>
      </div>
      <main id="main-content" className="app-body">{children}</main>
      <footer className="workspace-footer">
        <div><strong>Emission Lens</strong><span>Torrance, California · Mert and Carter</span></div>
        <p>Estimated tailpipe emissions. No measured air quality, exposure or engine-running inference.</p>
        <nav aria-label="Licence and source"><a href={source.licence}>AGPL-3.0</a><a href={source.source}>{source.sourceLabel} <ArrowUpRight size={12} /></a><a href={source.notice}>Notices</a></nav>
      </footer>
    </div>
  );
}
