import {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  listCameras,
} from "@emission-lens/backend";
import { calibrationFor, type Mode } from "@emission-lens/contracts";
import Link from "next/link";
import { MotionControl } from "@/components/MotionControl";
import { Clock } from "@/components/Clock";
import { LensMark } from "@/components/ui";
import { formatClock, hrefWith, modeLabel, PACIFIC, zoneAbbreviation } from "@/lib/format";

export type Section = "overview" | "camera" | "review" | "brief";

const MODES: Mode[] = ["live", "replay", "synthetic"];

const NAV: Array<{ key: Exclude<Section, "camera">; label: string; path: string }> = [
  { key: "overview", label: "Overview", path: "/" },
  { key: "review", label: "Review", path: "/review" },
  { key: "brief", label: "Brief", path: "/brief" },
];

function modeMessage(mode: Mode, cameraIds: string[]): string {
  const statuses = cameraIds.map((id) => get_camera_status(id, mode));
  const rowsByCamera = cameraIds.map((id) => ({ id, rows: get_traffic_window({ cameraId: id, mode }).rows.length }));
  if (mode === "live") {
    return statuses.every((status) => status.heartbeat_at === null)
      ? "No worker heartbeat is connected, so every camera is offline. Empty estimates are unavailable, not zero."
      : "Live totals exclude replay and synthetic samples. Empty estimates are unavailable, not zero.";
  }
  if (mode === "replay") {
    return rowsByCamera.every((item) => item.rows === 0)
      ? "No replay clip is loaded. Replay runs through the same pipeline and is kept out of live totals."
      : "Recorded clip processed by the same pipeline. Kept out of live totals.";
  }
  const sampled = rowsByCamera.filter((item) => item.rows > 0).map((item) => item.id);
  return sampled.length === 0
    ? "No synthetic rows are loaded."
    : `Labeled test rows for camera ${sampled.join(", ")}. They are not field measurements and stay out of live totals.`;
}

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
  const count = (state: string) => statuses.filter((status) => status.displayed_state === state).length;
  const live = count("live");
  const degraded = count("degraded");
  const offline = count("offline");
  const calibrated = cameras.filter((camera) => calibrationFor(camera.id).validation_status === "valid").length;
  const estimated = cameras.filter(
    (camera) => get_emissions_window({ cameraId: camera.id, mode }).quality_state === "ok",
  ).length;
  const asOf = statuses[0]?.as_of ?? new Date().toISOString();
  const activeNav = section === "camera" ? "overview" : section;

  return (
    <div className="app" data-mode={mode}>
      <header className="topbar">
        <Link className="brand" href={hrefWith("/", { mode })}>
          <LensMark />
          <span className="brand-lockup"><span className="brand-name">EMISSION LENS</span><span className="brand-subtitle">ENVIRONMENTAL INTELLIGENCE</span></span>

        </Link>

        <nav className="primary-nav" aria-label="Sections">
          {NAV.map((item, index) => (
            <Link
              key={item.key}
              href={hrefWith(item.path, { mode })}
              aria-current={item.key === activeNav ? (section === "camera" ? "true" : "page") : undefined}
            >
              <span className="nav-index">0{index + 1}</span>{item.label}
            </Link>
          ))}
        </nav>

        <nav className="mode-switch" aria-label="Data mode">
          {MODES.map((option) => (
            <Link key={option} href={modeHref(option)} aria-current={option === mode ? "page" : undefined}>
              <span className={`swatch swatch-${option}`} aria-hidden="true" />
              {modeLabel(option)}
            </Link>
          ))}
        </nav>

        <MotionControl />
        <Clock />
      </header>

      <div className="mode-strip" role="note" aria-label="Data mode">
        <span className={mode === "live" ? "mode-tag mode-tag-live" : "mode-tag"}>{modeLabel(mode)}</span>
        <span className="mode-message">{modeMessage(mode, cameras.map((camera) => camera.id))}</span>
        <dl className="counters" aria-label={`Camera summary in ${modeLabel(mode).toLowerCase()} mode`}>
          <div className={live > 0 ? "counter counter-go" : "counter"}>
            <dt>Live</dt>
            <dd>
              {live}/{cameras.length}
            </dd>
          </div>
          <div className={degraded > 0 ? "counter counter-caution" : "counter"}>
            <dt>Degraded</dt>
            <dd>{degraded}</dd>
          </div>
          <div className="counter">
            <dt>Offline</dt>
            <dd>{offline}</dd>
          </div>
          <div className="counter">
            <dt>Calibrated</dt>
            <dd>
              {calibrated}/{cameras.length}
            </dd>
          </div>
          <div className="counter">
            <dt>With estimates</dt>
            <dd>
              {estimated}/{cameras.length}
            </dd>
          </div>
          <div className="counter" title={`${formatClock(asOf, "UTC")} UTC`}>
            <dt>Data as of</dt>
            <dd>
              {formatClock(asOf, PACIFIC)} {zoneAbbreviation(asOf, PACIFIC)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="app-body">{children}</div>
    </div>
  );
}
