import {
  get_camera_status,
  get_traffic_window,
  listCameras,
} from "@emission-lens/backend";
import { calibrationFor, type Mode } from "@emission-lens/contracts";
import Link from "next/link";
import {
  Leaf,
  SquaresFour,
  VideoCamera,
  FileText,
  ShieldCheck,
  Question,
  CaretDown,
  MapPin,
  Info,
  ArrowUpRight,
} from "@phosphor-icons/react/dist/ssr";
import { MotionControl } from "@/components/MotionControl";
import { WorkspaceMenus } from "@/components/WorkspaceMenus";
import { Clock } from "@/components/Clock";
import { LiveRefresh } from "@/components/LiveRefresh";
import {
  formatClock,
  hrefWith,
  modeLabel,
  PACIFIC,
  zoneAbbreviation,
} from "@/lib/format";

export type Section = "overview" | "camera" | "review" | "brief";
const MODES: Mode[] = ["live", "replay", "synthetic"];

export function AppShell({
  mode,
  section,
  modeHref,
  children,
}: {
  mode: Mode;
  section: Section;
  modeHref: (mode: Mode) => string;
  children: React.ReactNode;
}) {
  const cameras = listCameras();
  const statuses = cameras.map((camera) => get_camera_status(camera.id, mode));
  const fresh = statuses.filter(
    (status) => status.displayed_state === "live",
  ).length;
  const calibrated = cameras.filter(
    (camera) => calibrationFor(camera.id).validation_status === "valid",
  ).length;
  const asOf = statuses[0].as_of;
  const hasTraffic = cameras.some(
    (camera) =>
      get_traffic_window({ cameraId: camera.id, mode }).rows.length > 0,
  );
  const note =
    mode === "synthetic"
      ? "Illustrative test data. Not field measurements; excluded from live totals."
      : mode === "replay"
        ? hasTraffic
          ? "Recorded observations. Kept separate from live totals."
          : "No replay loaded. Recorded observations will appear here when available."
        : statuses.every((status) => status.heartbeat_at === null)
          ? "Waiting for a live worker. Missing observations are unavailable, never zero."
          : fresh === 0
            ? "Live mode selected. No fresh processing heartbeat is reported."
            : "Live observations only. Replay and synthetic samples are excluded.";
  const names = {
    overview: "Overview",
    camera: "Camera detail",
    review: "Evidence review",
    brief: "Investigation brief",
  };

  return (
    <div className="app" data-mode={mode}>
      <LiveRefresh mode={mode} />
      <WorkspaceMenus />
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link
          className="brand"
          href={hrefWith("/", { mode })}
          aria-label="Emission Lens home"
        >
          <span className="brand-symbol">
            <Leaf size={24} weight="fill" />
          </span>
          <span className="brand-lockup">
            <strong>Emission Lens</strong>
            <small>A clearer perspective.</small>
          </span>
        </Link>
        <span className="sidebar-label">WORKSPACE</span>
        <nav className="primary-nav" aria-label="Main navigation">
          <Link
            aria-label="Overview"
            title="Overview"
            href={hrefWith("/", { mode })}
            aria-current={section === "overview" ? "page" : undefined}
          >
            <SquaresFour size={20} />
            <span>Overview</span>
          </Link>
          <details
            suppressHydrationWarning
            data-menu
            className="sidebar-cameras"
            data-active={section === "camera"}
          >
            <summary aria-label="Camera network" title="Camera network">
              <VideoCamera size={20} />
              <span>Camera network</span>
              <CaretDown size={12} />
            </summary>
            <div>
              {cameras.map((camera) => (
                <Link
                  key={camera.id}
                  aria-label={`Camera ${camera.id}, ${camera.name}`}
                  href={hrefWith(`/cameras/${camera.id}`, { mode })}
                >
                  <span>{camera.id}</span>
                  <span>
                    {camera.name
                      .replace("SR-107 at ", "")
                      .replace("SR-1 at ", "")}
                  </span>
                </Link>
              ))}
            </div>
          </details>
          <Link
            aria-label="Evidence review"
            title="Evidence review"
            href={hrefWith("/review", { mode })}
            aria-current={section === "review" ? "page" : undefined}
          >
            <ShieldCheck size={20} />
            <span>Evidence review</span>
          </Link>
          <Link
            aria-label="Planning brief"
            title="Planning brief"
            href={hrefWith("/brief", { mode })}
            aria-current={section === "brief" ? "page" : undefined}
          >
            <FileText size={20} />
            <span>Planning brief</span>
          </Link>
        </nav>
        <div className="sidebar-note">
          <span className="sidebar-label">THE BIGGER PICTURE</span>
          <Leaf size={25} />
          <p>
            Small observations.
            <br />
            <strong>Better-informed places.</strong>
          </p>
          <span>Traffic evidence for thoughtful environmental planning.</span>
        </div>
        <div className="sidebar-bottom">
          <details suppressHydrationWarning data-menu className="help-menu">
            <summary aria-label="How it works" title="How it works">
              <Question size={20} />
              <span>How it works</span>
            </summary>
            <div className="help-content">
              <strong>Observations, then estimates.</strong>
              <p>
                Camera line crossings describe traffic. Calibrated traversals
                and regional factors support estimated tailpipe CO₂ and NOₓ.
              </p>
              <p>
                These are not measured air quality or health-risk scores. A
                missing value means unavailable.
              </p>
              <a
                href="https://ww2.arb.ca.gov/our-work/programs/msei/on-road-emfac"
                target="_blank"
                rel="noreferrer"
              >
                About CARB factors <ArrowUpRight size={14} />
              </a>
            </div>
          </details>
          <div className="team-mark">
            <span>M</span>
            <div>
              <strong>Mert &amp; Carter</strong>
              <small>Environment workspace</small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="workspace-crumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{names[section]}</strong>
          </div>
          <div className="topbar-actions">
            <Clock />
            <MotionControl />
            <details suppressHydrationWarning data-menu className="status-menu">
              <summary aria-label="Data status">
                <span className="status-dot" />
                <span>Data status</span>
                <CaretDown size={12} />
              </summary>
              <div className="status-popover">
                <strong>What is connected?</strong>
                <p>
                  Health is evaluated at the data clock for the selected mode.
                </p>
                <dl>
                  <div>
                    <dt>Fresh heartbeats</dt>
                    <dd>
                      {fresh} / {cameras.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Valid calibrations</dt>
                    <dd>
                      {calibrated} / {cameras.length}
                    </dd>
                  </div>
                  <div>
                    <dt>Regional factors</dt>
                    <dd>Available</dd>
                  </div>
                </dl>
                <p>
                  Emissions also require completed traversals and documented
                  vehicle-class mappings.
                </p>
              </div>
            </details>
          </div>
        </header>
        <div className="workspace-toolbar">
          <span className="location-label">
            <MapPin size={16} /> Torrance, California
          </span>
          <nav className="mode-switch" aria-label="Data mode">
            {MODES.map((option) => (
              <Link
                key={option}
                href={modeHref(option)}
                aria-current={option === mode ? "page" : undefined}
              >
                <span className={`swatch swatch-${option}`} />
                {modeLabel(option)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mode-strip" role="note" aria-label="Data provenance">
          <Info size={16} />
          <span className="mode-tag">{modeLabel(mode)}</span>
          <span className="mode-message">{note}</span>
          <span className="data-clock">
            Data as of {formatClock(asOf, PACIFIC)}{" "}
            {zoneAbbreviation(asOf, PACIFIC)}{" "}
            <span>/ {formatClock(asOf, "UTC")} UTC</span>
          </span>
        </div>
        <main id="main-content" className="app-body">
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            <Leaf size={13} /> Estimated emissions. Evidence before conclusions.
          </span>
          <span>Caltrans cameras · CARB factors</span>
        </footer>
      </div>
    </div>
  );
}
