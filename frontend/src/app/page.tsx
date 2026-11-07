import {
  get_camera_status,
  get_context,
  get_emissions_window,
  get_traffic_window,
  listCameras,
} from "@emission-lens/backend";
import { calibrationFor } from "@emission-lens/contracts";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { CameraMap } from "@/components/CameraMap";
import { Quantity, QualityChip, Readout, SignalHead, StateChip } from "@/components/ui";
import { systemChecks } from "@/lib/checks";
import {
  formatAge,
  formatClock,
  formatCoordinates,
  formatInstant,
  formatNumber,
  formatPercent,
  formatWindow,
  hrefWith,
  PACIFIC,
  parseMode,
  parseView,
  stateLabel,
  formatLocalClock as localClock,
  type MapView,
} from "@/lib/format";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; camera?: string; view?: string }>;
}) {
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const view = parseView(query.view);
  const cards = listCameras().map((camera) => ({
    camera,
    status: get_camera_status(camera.id, mode),
    traffic: get_traffic_window({ cameraId: camera.id, mode }),
    emissions: get_emissions_window({ cameraId: camera.id, mode }),
    calibration: calibrationFor(camera.id),
    context: get_context(camera.id, mode),
  }));
  const selected = cards.find((card) => card.camera.id === query.camera) ?? cards[0];
  const link = (params: { mode?: string; camera?: string; view?: MapView }) => {
    const nextView = params.view ?? view;
    return hrefWith("/", {
      mode: params.mode ?? mode,
      camera: params.camera ?? selected.camera.id,
      view: nextView === "activity" ? undefined : nextView,
    });
  };

  const metricLabel = (card: (typeof cards)[number], active: MapView): string => {
    if (active === "emissions") {
      const co2 = card.emissions.estimate_g_by_pollutant.co2;
      return co2 === null ? "CO₂ unavailable" : `${formatNumber(co2)} g CO₂`;
    }
    const crossings = card.traffic.totals.count;
    return crossings === null ? "Counts unavailable" : `${formatNumber(crossings, 0)} crossings`;
  };

  const checks = systemChecks(mode, cards);
  const asOf = selected.status.as_of;
  const roadRegions = cards.filter((card) => card.camera.road_region !== null).length;
  const gates = cards.filter((card) => card.calibration.gates !== null).length;
  const contextLoaded = cards.filter((card) => card.context.values !== null).length;

  return (
    <AppShell mode={mode} section="overview" modeHref={(option) => link({ mode: option })}>
      <div className="console">
        <aside className="rail" aria-label="Cameras and layers">
          <div className="rail-head">
            <h2>Cameras</h2>
            <span>{cards.length} intersections</span>
          </div>
          <ul className="cam-list">
            {cards.map((card) => {
              const isSelected = card.camera.id === selected.camera.id;
              return (
                <li key={card.camera.id}>
                  <Link
                    className="cam-row"
                    href={link({ camera: card.camera.id })}
                    scroll={false}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <SignalHead state={card.status.displayed_state} />
                    <span className="cam-id">{card.camera.id}</span>
                    <span className="cam-state">{stateLabel(card.status.displayed_state)}</span>
                    <span className="cam-name">{card.camera.name}</span>
                    <span className="cam-value mono">{metricLabel(card, view)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="rail-head">
            <h2>Map layers</h2>
            <span>Status</span>
          </div>
          <ul className="layer-list">
            <li className="layer-row is-on">
              <span>Camera locations</span>
              <span>Shown, {cards.length}</span>
            </li>
            <li className="layer-row">
              <span>Road regions</span>
              <span>{roadRegions === 0 ? "None configured" : `${roadRegions} of ${cards.length}`}</span>
            </li>
            <li className="layer-row">
              <span>Entry and exit gates</span>
              <span>{gates === 0 ? "None configured" : `${gates} of ${cards.length}`}</span>
            </li>
            <li className="layer-row">
              <span>Weather, schools</span>
              <span>{contextLoaded === 0 ? "Not loaded" : `${contextLoaded} of ${cards.length}`}</span>
            </li>
          </ul>
          <p className="rail-foot">
            Unconfigured layers are left off the map rather than guessed. Roads outside a configured region are not
            observed.
          </p>
        </aside>

        <section className="map-pane" aria-label="Camera map">
          <CameraMap
            selectedId={selected.camera.id}
            cameras={cards.map((card) => ({
              id: card.camera.id,
              name: card.camera.name,
              latitude: card.camera.latitude,
              longitude: card.camera.longitude,
              state: card.status.displayed_state,
              stateLabel: stateLabel(card.status.displayed_state),
              valueLabel: metricLabel(card, view),
              href: link({ camera: card.camera.id }),
            }))}
          />
          <div className="map-overlay map-view">
            <span>Show</span>
            <nav className="mode-switch" aria-label="Map metric">
              <Link href={link({ view: "activity" })} scroll={false} aria-current={view === "activity" ? "page" : undefined}>
                Vehicle activity
              </Link>
              <Link
                href={link({ view: "emissions" })}
                scroll={false}
                aria-current={view === "emissions" ? "page" : undefined}
              >
                Modeled emissions
              </Link>
            </nav>
          </div>
          <div className="map-overlay map-legend" aria-label="Map legend">
            <div>
              <SignalHead state="live" /> Live: fresh heartbeat
            </div>
            <div>
              <SignalHead state="degraded" /> Degraded: heartbeat is stale
            </div>
            <div>
              <SignalHead state="offline" /> Offline: no heartbeat or source time
            </div>
          </div>
        </section>

        <aside className="dossier" aria-label={`Camera ${selected.camera.id} summary`}>
          <header className="dossier-head">
            <div className="dossier-kicker">
              <SignalHead state={selected.status.displayed_state} large />
              Camera {selected.camera.id}
            </div>
            <h2>{selected.camera.name}</h2>
            <div className="dossier-meta">
              <StateChip state={selected.status.displayed_state} />
              <span className="mono faint">
                {formatCoordinates(selected.camera.latitude, selected.camera.longitude)}
              </span>
            </div>
          </header>

          <div className="dossier-sections">
            <section className="dossier-section">
              <h3>Feed status</h3>
              <dl className="readouts readouts-2">
                <Readout
                  label="Heartbeat"
                  detail={
                    selected.status.heartbeat_at === null
                      ? undefined
                      : `${formatAge(selected.status.heartbeat_at, asOf)} before data clock`
                  }
                >
                  {selected.status.heartbeat_at === null ? (
                    <Quantity value={null} unavailable="None received" />
                  ) : (
                    <span className="q">{localClock(selected.status.heartbeat_at)}</span>
                  )}
                </Readout>
                <Readout label="Last source frame">
                  {selected.status.last_source_timestamp === null ? (
                    <Quantity value={null} />
                  ) : (
                    <span className="q">{localClock(selected.status.last_source_timestamp)}</span>
                  )}
                </Readout>
                <Readout label="Processing delay">
                  <Quantity
                    value={selected.status.processing_delay_ms === null ? null : selected.status.processing_delay_ms / 1000}
                    unit="s"
                  />
                </Readout>
                <Readout label="Inference rate">
                  <Quantity value={selected.status.fps} unit="frames/s" />
                </Readout>
              </dl>
              {selected.status.state !== selected.status.displayed_state ? (
                <p className="note">
                  The worker last reported {selected.status.state}. It is shown {selected.status.displayed_state}{" "}
                  because the heartbeat is stale at the data clock.
                </p>
              ) : null}
            </section>

            <section className="dossier-section">
              <h3>
                Traffic <span>{formatWindow(selected.traffic.from, selected.traffic.to, PACIFIC)}</span>
              </h3>
              <dl className="readouts readouts-2">
                <Readout label="Line crossings">
                  <Quantity value={selected.traffic.totals.count} digits={0} />
                </Readout>
                <Readout label="Completed traversals">
                  <Quantity value={selected.traffic.totals.completed_traversals} digits={0} />
                </Readout>
                <Readout label="Queue count">
                  <Quantity value={selected.traffic.queue_count} unit="vehicles" digits={0} />
                </Readout>
                <Readout label="Queue length">
                  <Quantity value={selected.traffic.queue_length_m} unit="m" />
                </Readout>
                <Readout label="Stopped time, full mix">
                  <Quantity value={selected.traffic.totals.stopped_vehicle_seconds} unit="vehicle-s" />
                </Readout>
                <Readout label="Coverage">
                  {selected.traffic.totals.coverage === null ? (
                    <Quantity value={null} />
                  ) : (
                    <span className="q">{formatPercent(selected.traffic.totals.coverage)}</span>
                  )}
                </Readout>
              </dl>
              <p>{selected.traffic.note}</p>
            </section>

            <section className="dossier-section">
              <h3>
                Estimated emissions <QualityChip state={selected.emissions.quality_state} />
              </h3>
              <dl className="readouts readouts-2">
                <Readout label="CO₂">
                  <Quantity value={selected.emissions.estimate_g_by_pollutant.co2} unit="g" />
                </Readout>
                <Readout label="NOₓ">
                  <Quantity value={selected.emissions.estimate_g_by_pollutant.nox} unit="g" />
                </Readout>
              </dl>
              <p>{selected.emissions.note}</p>
            </section>

            <section className="dossier-section">
              <h3>
                Calibration{" "}
                <span className={selected.calibration.validation_status === "valid" ? "chip chip-ok" : "chip chip-missing"}>
                  {selected.calibration.validation_status}
                </span>
              </h3>
              <p>
                Version {selected.calibration.version}.{" "}
                {selected.calibration.validation_status === "valid"
                  ? "Speeds and distance-based emissions are supported."
                  : "Counts and image-based queue observations remain. Speeds and distance-based emissions are suppressed."}
              </p>
            </section>
          </div>

          <div className="dossier-actions">
            <Link className="button button-primary" href={hrefWith(`/cameras/${selected.camera.id}`, { mode })}>
              Open camera {selected.camera.id}
            </Link>
            <Link className="button" href={hrefWith("/brief", { mode, camera: selected.camera.id })}>
              Draft a brief
            </Link>
          </div>
        </aside>

        <section className="syslog" aria-label="System checks">
          <div className="syslog-head">
            <h2>System checks</h2>
            <span className="mono">
              Evaluated at the data clock, {formatInstant(asOf, PACIFIC)} / {formatClock(asOf, "UTC")} UTC
            </span>
          </div>
          <ol>
            {checks.map((line, index) => (
              <li key={`${line.source}-${index}`}>
                <time dateTime={line.at ?? undefined}>{line.at === null ? "—" : `${formatClock(line.at, "UTC")}Z`}</time>
                <span className={`lvl lvl-${line.level}`}>{line.level.toUpperCase()}</span>
                <span className="src">{line.source}</span>
                <span className="msg">{line.text}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AppShell>
  );
}
