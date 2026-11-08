"use client";

import { crossingSummary, crossingMapLabel } from "@/lib/crossing-summary";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Car,
  Clock,
  Info,
  MagnifyingGlass,
  MapPin,
  VideoCamera,
} from "@phosphor-icons/react";
import type {
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  listCameras,
} from "@emission-lens/backend";
import type { Mode } from "@emission-lens/contracts";
import { CameraMap } from "@/components/CameraMap";
import { SelectedEmissionMetric } from "@/components/SelectedEmissionMetric";
import type { MapEmissionEstimate } from "@/lib/map-emissions";
import { queueObservation, queueValueDescription, queueScopeDescription, type latestSupportedMinuteCohort, type measurementSupport } from "@/lib/observation-presentation";
import { scenarioValue } from "@/lib/scenario-presentation";
import { Quantity, QueueQuantity, StateChip, EmissionQuantity } from "@/components/ui";
import {
  formatAge,
  formatInstant,
  formatWindow,
  hrefWith,
  PACIFIC,
  stateLabel,
  type MapView,
} from "@/lib/format";

type CameraCard = {
  camera: ReturnType<typeof listCameras>[number];
  status: ReturnType<typeof get_camera_status>;
  traffic: ReturnType<typeof get_traffic_window>;
  emissions: ReturnType<typeof get_emissions_window>;
  calibration: "missing" | "invalid" | "valid";
  mapEstimate: MapEmissionEstimate | null;
  measurementSupport: ReturnType<typeof measurementSupport>;
  minuteCohort: ReturnType<typeof latestSupportedMinuteCohort>;
};
const filters = [
  { key: "all", label: "All cameras" },
  { key: "live", label: "Fresh" },
  { key: "degraded", label: "Stale" },
  { key: "offline", label: "Offline" },
] as const;

export function OverviewBoard({
  cameras,
  selectedId,
  mode,
  view,
}: {
  cameras: CameraCard[];
  selectedId: string;
  mode: Mode;
  view: MapView;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [sort, setSort] = useState("location");
  const selected =
    cameras.find((item) => item.camera.id === selectedId) ?? cameras[0];
  const quantitative = (id: string) => mode === "synthetic" || id === "222" || id === "223";
  const traffic = selected.traffic;
  const queue = queueObservation(traffic);
  const observedMinutes = new Set(traffic.rows.map((row) => new Date(row.minute).toISOString())).size;
  const expectedMinutes = Math.round(
    (Date.parse(traffic.to) - Date.parse(traffic.from)) / 60000,
  );
  const cameraHref = (id: string, nextView: MapView = view) =>
    hrefWith("/", {
      mode,
      camera: id,
      view: nextView === "activity" ? undefined : nextView,
    });
  const visible = useMemo(() => {
    const matches = cameras.filter(
      (item) =>
        (filter === "all" || item.status.displayed_state === filter) &&
        `${item.camera.id} ${item.camera.name}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    );
    return matches.sort((a, b) => {
      if (sort === "status")
        return a.status.displayed_state.localeCompare(b.status.displayed_state);
      if (sort === "id") return Number(a.camera.id) - Number(b.camera.id);
      return a.camera.name
        .split(" at ")
        .at(-1)!
        .localeCompare(b.camera.name.split(" at ").at(-1)!);
    });
  }, [cameras, search, filter, sort]);

  const crossings = quantitative(selectedId) ? crossingSummary(traffic.rows) : {count:null,partial:false,label:"Preview-only station"};
  const stationGroups = ["SR-107", "SR-1"].map((road) => ({
    road,
    stations: cameras
      .filter((item) => item.camera.name.startsWith(`${road} at `))
      .sort((a, b) => b.camera.latitude - a.camera.latitude),
  }));

  return (
    <section id="network" className="overview-page technical-network">
      <header className="overview-heading">
        <div>
          <h1>
            Network monitor<span> / Torrance</span>
          </h1>
          <p>
            Four configured intersections. Camera-scoped observations with separate processing and estimate support.
          </p>
        </div>
        <details suppressHydrationWarning data-menu className="period-menu">
          <summary>
            <Clock size={17} /> Reporting hour{" "}
            <span>{formatWindow(traffic.from, traffic.to, PACIFIC)}</span>
          </summary>
          <div>
            <strong>What does this window cover?</strong>
            <p>
              {formatWindow(traffic.from, traffic.to, PACIFIC)}. Values below
              describe camera {selectedId}; missing minutes are not filled with
              zeros.
            </p>
            <p>
              {observedMinutes} of {expectedMinutes} minutes have records.{" "}
              {mode === "synthetic"
                ? "The sample clock is fixed so test data can be inspected."
                : "The reporting window follows the data clock."}
            </p>
          </div>
        </details>
      </header>

      <div
        className="metric-grid overview-metrics"
        aria-label={`Selected camera ${selectedId} summary`}
      >
        <section className="summary-card summary-featured summary-card--crossings">
          <div className="summary-label">
            <span>{crossings.label}</span>
            <Car size={19} />
          </div>
          <strong>
            <Quantity value={crossings.count} digits={0} unavailable="Collecting records" />
          </strong>
          <span className="metric-caption">
            Camera {selectedId} ·{" "}
            {mode === "synthetic" ? "synthetic sample" : "reporting hour"}{crossings.partial ? " · partial class coverage" : ""}
          </span>
        </section>
        <SelectedEmissionMetric estimate={quantitative(selectedId) ? selected.mapEstimate : null} windowCo2={quantitative(selectedId) ? selected.emissions.estimate_g_by_pollutant.co2 : null} cameraId={selectedId} mode={mode} state={selected.status.displayed_state} support={quantitative(selectedId) ? selected.measurementSupport : {label:"Preview only",detail:"This station is excluded from quantitative processing pending count validation."}} />
        <section className="summary-card summary-card--coverage">
          <div className="summary-label">
            <span>Recorded minutes</span>
            <Clock size={19} />
          </div>
          <strong>
            {observedMinutes}
            <small> / {expectedMinutes}</small>
          </strong>
          <span className="metric-caption">
            {observedMinutes === 0
              ? "No traffic records in this window"
              : "Missing minutes remain unobserved"}
          </span>
        </section>
      </div>

      <div className="overview-layout">
        <div className="overview-main">
          <section className="map-card" aria-label="Camera network map">
            <header className="map-card-head">
              <div>
                <h2>Camera network</h2>
                <span>
                  <MapPin size={13} /> Torrance · 4 configured intersections
                </span>
              </div>
              <nav className="map-layer-switch" aria-label="Map metric">
                <a
                  href={`${cameraHref(selectedId, "activity")}#network`}
                  aria-current={view === "activity" ? "page" : undefined}
                >
                  Traffic
                </a>
                <a
                  href={`${cameraHref(selectedId, "emissions")}#network`}
                  aria-current={view === "emissions" ? "page" : undefined}
                >
                  Emissions heat map
                </a>
              </nav>
            </header>
            <div className="map-pane">
              <CameraMap
                selectedId={selectedId}
                view={view}
                cameras={cameras.map((item) => ({
                  id: item.camera.id,
                  name: item.camera.name,
                  latitude: item.camera.latitude,
                  longitude: item.camera.longitude,
                  state: item.status.displayed_state,
                  stateLabel: stateLabel(item.status.displayed_state),
                  valueLabel:
                    !quantitative(item.camera.id) ? "Preview only · counts excluded" : view === "emissions"
                      ? item.mapEstimate === null
                        ? "CO₂ unavailable"
                        : `${scenarioValue(item.mapEstimate.co2_g, "g", false, item.mapEstimate.co2_g >= 1 ? 1 : 6)} CO₂ · snapshot`
                      : crossingMapLabel(item.traffic.rows),
                  href: cameraHref(item.camera.id),
                  emissions: quantitative(item.camera.id) ? item.mapEstimate : null,
                  secondaryValueLabel: quantitative(item.camera.id) && view === "emissions" && item.mapEstimate
                    ? `NOₓ ${scenarioValue(item.mapEstimate.nox_g, "g")} · same snapshot`
                    : null,
                }))}
              />
              <span className="map-location-pill">
                <MapPin size={14} /> South Bay, Los Angeles County
              </span>
            </div>
            {view === "emissions" ? (
              <div className="map-heat-legend" aria-label="Emissions heat map legend">
                <div><span className="map-heat-ramp" aria-hidden="true" /><strong>Center color · estimated CO₂ · 0 → 100+ g per supported minute</strong></div>
                <p>Each camera uses its latest supported minute; dates and coverage can differ. Center color saturates at 100 g; halo marks supported camera points. Rings and glow are screen-space camera symbols, not pollution spread or exposure.</p>
                <p>{selected.mapEstimate
                  ? `Camera ${selectedId}: ${formatInstant(selected.mapEstimate.minute, PACIFIC)} · ${stateLabel(selected.status.displayed_state)}. Other minutes may be unavailable.`
                  : `Camera ${selectedId}: no supported emissions snapshot in this window.`} {cameras.filter((item) => item.mapEstimate !== null).length} of {cameras.length} cameras have supported estimates.</p>
              </div>
            ) : null}
            <nav
              className="station-index"
              aria-label="Select an observation station"
            >
              {stationGroups.map(({ road, stations }) => (
                <div className="station-group" key={road}>
                  <span className="station-road">{road}</span>
                  {stations.map(({ camera, status }) => (
                    <Link
                      key={camera.id}
                      href={cameraHref(camera.id)}
                      scroll={false}
                      aria-label={`Select camera ${camera.id} on ${road}`}
                      aria-current={
                        camera.id === selectedId ? "location" : undefined
                      }
                      title={camera.name}
                    >
                      <i
                        className={`dot dot-${status.displayed_state}`}
                        aria-hidden="true"
                      />
                      {camera.id}
                    </Link>
                  ))}
                </div>
              ))}
              <span className="station-index-note">
                Camera locations · independent observations
              </span>
            </nav>
            <div className="map-foot">
              <span>
                <i className="dot dot-live" />
                Fresh <i className="dot dot-degraded" />
                Stale <i className="dot dot-offline" />
                Offline
              </span>
              <span>
                Camera locations only · unobserved roads are not estimates
              </span>
            </div>
          </section>

          <section className="camera-table-card" aria-label="Camera directory">
            <div className="table-heading">
              <div>
                <h2>
                  Station register <span>{cameras.length}</span>
                </h2>
                <p>Independent camera records · current reporting hour</p>
              </div>
              <label className="search-field">
                <MagnifyingGlass size={17} />
                <input
                  aria-label="Search intersections"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter by camera or location"
                />
              </label>
            </div>
            <div className="table-toolbar">
              <nav
                className="filter-tabs"
                aria-label="Filter cameras by status"
              >
                {filters.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    aria-pressed={filter === item.key}
                    onClick={() => setFilter(item.key)}
                  >
                    {item.label}
                    <span>
                      {item.key === "all"
                        ? cameras.length
                        : cameras.filter(
                            (camera) =>
                              camera.status.displayed_state === item.key,
                          ).length}
                    </span>
                  </button>
                ))}
              </nav>
              <select
                aria-label="Sort cameras"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="location">Sort: location</option>
                <option value="id">Sort: camera ID</option>
                <option value="status">Sort: status</option>
              </select>
            </div>
            <div className="table-scroll">
              <table className="data-table camera-table">
                <thead>
                  <tr>
                    <th>Intersection</th>
                    <th>Feed status</th>
                    <th className="num">Crossings</th>
                    <th className="num">Queue</th>
                    <th>Estimated CO₂ · {mode === "synthetic" ? "sample window" : "supported minute"}</th>
                    <th>
                      <span className="visually-hidden">Select camera</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const rowQueue = queueObservation(item.traffic);
                    const rowCrossings = crossingSummary(item.traffic.rows);
                    return (
                    <tr
                      key={item.camera.id}
                      data-selected={item.camera.id === selectedId}
                    >
                      <td>
                        <Link
                          className="camera-location"
                          href={cameraHref(item.camera.id)}
                          scroll={false}
                        >
                          <span className="camera-id-badge">
                            {item.camera.id}
                          </span>
                          <span>
                            <strong>
                              {item.camera.name
                                .replace("SR-107 at ", "")
                                .replace("SR-1 at ", "")}
                            </strong>
                            <small>
                              {item.camera.name.startsWith("SR-107")
                                ? "SR-107"
                                : "SR-1"}{" "}
                              · Camera {item.camera.id}
                            </small>
                          </span>
                        </Link>
                      </td>
                      <td>
                        <StateChip state={item.status.displayed_state} />
                        <small className="camera-support" title={item.measurementSupport.detail}>{!quantitative(item.camera.id) ? "Metric camera excluded" : mode === "synthetic" ? "Labeled sample" : item.measurementSupport.label}</small>
                      </td>
                      <td className="num">
                        <Quantity
                          value={quantitative(item.camera.id) ? rowCrossings.count : null}
                          unavailable={item.camera.id==="220"||item.camera.id==="228"?"Excluded":"Collecting"}
                          digits={0}
                        />{quantitative(item.camera.id)&&rowCrossings.partial&&rowCrossings.count!==null?<small className="camera-support">Known classes</small>:null}
                      </td>
                      <td className="num">
                        <QueueQuantity value={quantitative(item.camera.id) ? rowQueue.value : null} unavailable={item.camera.id==="220"||item.camera.id==="228"?"Preview only":"No latest observation"} />
                        {quantitative(item.camera.id) && rowQueue.value !== null && rowQueue.minute ? <small className="camera-support"><time dateTime={rowQueue.minute}>{formatInstant(rowQueue.minute, PACIFIC)}</time></small> : null}
                        {quantitative(item.camera.id) && rowQueue.value !== null ? <small className="camera-support" title={queueScopeDescription(rowQueue.value)}>{rowQueue.value > 0 ? "Visible stopped · provisional lower bound" : "Observed image-area zero"}</small> : null}
                      </td>
                      <td>
                        {!quantitative(item.camera.id) ? <span className="camera-support">Count validation pending</span> : mode !== "synthetic" && item.mapEstimate === null ? <Quantity value={null} unavailable={item.measurementSupport.label} /> : <EmissionQuantity value={mode === "synthetic" ? item.emissions.estimate_g_by_pollutant.co2 : item.mapEstimate?.co2_g ?? null} />}
                        {quantitative(item.camera.id) && item.mapEstimate ? <small className="camera-support"><time dateTime={item.mapEstimate.minute}>{formatInstant(item.mapEstimate.minute, PACIFIC)}</time></small> : null}
                      </td>
                      <td>
                        <Link
                          className="row-action"
                          href={`${hrefWith("/", { mode, camera: item.camera.id })}#selected-camera`}
                          aria-label={`Inspect camera ${item.camera.id}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {visible.length === 0 ? (
              <div className="empty-state compact">
                <MagnifyingGlass size={26} />
                <strong>No intersections found</strong>
                <p>Try a camera number or another status.</p>
                <button
                  className="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}
            <p className="table-caption">
              <Info size={13} /> Counts are unique line crossings. Unavailable
              means no supported value, not zero. Positive queues are lower bounds (≥) of visible stopped vehicles under provisional image-area and motion assumptions. Queue minutes and supported emissions snapshots remain separate from whole-hour totals.
            </p>
          </section>
        </div>


      </div>
      <details className="operational-matrix network-gates" aria-label="Operational and acceptance matrix"><summary>Processing and evidence gates <span>Counts, estimates and feed health are evaluated separately</span></summary>
        <header><h2>Processing and evidence gates</h2><p>Runtime freshness, declared count eligibility and scientific input authority are independent.</p></header>
        <div className="table-scroll"><table className="data-table">
          <thead><tr><th>Station</th><th>Processing</th><th>Declared count policy</th><th>Measurement registry</th><th>Supported estimate</th><th>Scope / limitation</th></tr></thead>
          <tbody>{cameras.map((item) => <tr key={item.camera.id}>
            <th scope="row">{item.camera.id}</th><td><StateChip state={item.status.displayed_state} /><small className="camera-support">{item.status.heartbeat_at ? `Heartbeat ${formatAge(item.status.heartbeat_at, item.status.as_of)} old` : "No heartbeat"}</small></td>
            <td>{item.camera.id === "222" || item.camera.id === "223" ? "Enabled image-count gate" : "Excluded · failed count screen"}</td>
            <td>{item.calibration === "valid" ? "Camera/mode inputs approved" : item.calibration === "invalid" ? "Invalid · estimates withheld" : "No approved physical inputs"}</td>
            <td>{item.mapEstimate ? <><time dateTime={item.mapEstimate.minute}>{formatInstant(item.mapEstimate.minute, PACIFIC)}</time><small className="camera-support">Dated completed-movement minute</small></> : "No supported minute in this hour"}</td>
            <td>{item.camera.id === "222" ? "Eastbound · fixed 20 m assumption" : item.camera.id === "223" ? "Southbound · fixed 15 m assumption" : "No new quantitative processing"}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="table-caption">Declared project eligibility is separate from the current registry and does not certify human field accuracy. Missing records, source capture UTC and unobserved roads remain unavailable. Live/replay/synthetic records never share totals.</p>
      </details>
      <p className="network-method-note"><strong>Metric scope:</strong> 222 eastbound / 20 m and 223 southbound / 15 m use approved model assumptions. Cameras <strong>220 and 228 are excluded from quantitative processing after failed count screens</strong>; a video preview does not remove that exclusion. Estimates describe completed movements, not the full intersection. Select a camera below to inspect source timing, queues, calibration and calculations.</p>

    </section>
  );
}
