"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Car,
  CheckCircle,
  Clock,
  Cloud,
  Info,
  Leaf,
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
import { Quantity, StateChip } from "@/components/ui";
import {
  formatAge,
  formatNumber,
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
  const traffic = selected.traffic;
  const observedMinutes = new Set(traffic.rows.map((row) => row.minute)).size;
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

  const classCounts = useMemo(() => {
    const classes = new Map<string, number | null>();
    for (const row of traffic.rows) {
      const previous = classes.get(row.vehicle_class);
      classes.set(
        row.vehicle_class,
        row.count === null || previous === null
          ? null
          : (previous ?? 0) + row.count,
      );
    }
    return [...classes].sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));
  }, [traffic.rows]);
  const crossings = traffic.totals.count;
  const stationGroups = ["SR-107", "SR-1"].map((road) => ({
    road,
    stations: cameras
      .filter((item) => item.camera.name.startsWith(`${road} at `))
      .sort((a, b) => b.camera.latitude - a.camera.latitude),
  }));

  return (
    <div className="overview-page">
      <header className="overview-heading">
        <div>
          <h1>
            Torrance intersections<span>.</span>
          </h1>
          <p>
            Traffic observations and the evidence behind estimated emissions.
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
            <span>Line crossings</span>
            <Car size={19} />
          </div>
          <strong>
            <Quantity value={crossings} digits={0} />
          </strong>
          <span className="metric-caption">
            Camera {selectedId} ·{" "}
            {mode === "synthetic" ? "synthetic sample" : "reporting hour"}
          </span>
        </section>
        <section className="summary-card summary-card--queue">
          <div className="summary-label">
            <span>Queue count</span>
            <VideoCamera size={19} />
          </div>
          <strong>
            <Quantity value={traffic.queue_count} digits={0} unit="vehicles" />
          </strong>
          <span className="metric-caption">
            An image-based observation, not length
          </span>
        </section>
        <section className="summary-card summary-card--emissions">
          <div className="summary-label">
            <span>Estimated CO₂</span>
            <Cloud size={19} />
          </div>
          <strong>
            <Quantity
              value={selected.emissions.estimate_g_by_pollutant.co2}
              unit="g"
            />
          </strong>
          <span className="metric-caption">
            {selected.emissions.estimate_g_by_pollutant.co2 !== null
              ? "Tailpipe estimate · never measured AQI"
              : selected.calibration === "valid"
                ? "Estimate unavailable · inspect evidence"
                : "Awaiting valid road calibration"}
          </span>
        </section>
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
          <section className="map-card" aria-label="Intersection map">
            <header className="map-card-head">
              <div>
                <h2>Observation map</h2>
                <span>
                  <MapPin size={13} /> Torrance · 4 configured intersections
                </span>
              </div>
              <nav className="map-layer-switch" aria-label="Map metric">
                <Link
                  href={cameraHref(selectedId, "activity")}
                  aria-current={view === "activity" ? "page" : undefined}
                >
                  Traffic
                </Link>
                <Link
                  href={cameraHref(selectedId, "emissions")}
                  aria-current={view === "emissions" ? "page" : undefined}
                >
                  Estimated emissions
                </Link>
              </nav>
            </header>
            <div className="map-pane">
              <CameraMap
                selectedId={selectedId}
                cameras={cameras.map((item) => ({
                  id: item.camera.id,
                  name: item.camera.name,
                  latitude: item.camera.latitude,
                  longitude: item.camera.longitude,
                  state: item.status.displayed_state,
                  stateLabel: stateLabel(item.status.displayed_state),
                  valueLabel:
                    view === "emissions"
                      ? item.emissions.estimate_g_by_pollutant.co2 === null
                        ? "CO₂ unavailable"
                        : `${formatNumber(item.emissions.estimate_g_by_pollutant.co2!)} g CO₂`
                      : item.traffic.totals.count === null
                        ? "Counts unavailable"
                        : `${item.traffic.totals.count} crossings`,
                  href: cameraHref(item.camera.id),
                }))}
              />
              <span className="map-location-pill">
                <MapPin size={14} /> South Bay, Los Angeles County
              </span>
            </div>
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
                  Intersection register <span>{cameras.length}</span>
                </h2>
                <p>Choose an intersection to explore its observations.</p>
              </div>
              <label className="search-field">
                <MagnifyingGlass size={17} />
                <input
                  aria-label="Search intersections"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find an intersection…"
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
                    <th>Estimated CO₂</th>
                    <th>
                      <span className="visually-hidden">Select camera</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
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
                      </td>
                      <td className="num">
                        <Quantity
                          value={item.traffic.totals.count}
                          digits={0}
                        />
                      </td>
                      <td className="num">
                        <Quantity value={item.traffic.queue_count} digits={0} />
                      </td>
                      <td>
                        <Quantity
                          value={item.emissions.estimate_g_by_pollutant.co2}
                          unit="g"
                        />
                      </td>
                      <td>
                        <Link
                          className="row-action"
                          href={hrefWith(`/cameras/${item.camera.id}`, {
                            mode,
                          })}
                          aria-label={`Inspect camera ${item.camera.id}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      </td>
                    </tr>
                  ))}
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
              means no supported value, not zero.
            </p>
          </section>
        </div>

        <aside className="overview-aside" aria-label="Selected camera context">
          <section className="nature-card">
            <div className="nature-image">
              <Image
                src="/images/greener-city.png"
                alt="Illustrative tree-lined urban park with a sunlit path"
                fill
                sizes="(max-width: 900px) 90vw, 280px"
                priority
              />
              <span>
                <Leaf size={12} /> A greener perspective
              </span>
            </div>
            <div className="nature-copy">
              <h2>
                Evidence for
                <br />
                <em>better streets.</em>
              </h2>
              <p>
                Observe traffic. Understand the limits. Explore what could
                change.
              </p>
              <span className="image-caption">
                Illustrative image · not camera footage
              </span>
            </div>
          </section>
          <section className="selection-card" key={`evidence-${selectedId}`}>
            <header>
              <span className="camera-focus-id">
                <VideoCamera size={14} /> Camera {selectedId}
              </span>
              <StateChip state={selected.status.displayed_state} />
            </header>
            <h2>{selected.camera.name}</h2>
            <p className="station-coordinate">
              {selected.camera.latitude.toFixed(4)}° N /{" "}
              {Math.abs(selected.camera.longitude).toFixed(4)}° W
            </p>
            <p>
              {selected.status.heartbeat_at === null
                ? "No heartbeat received. The camera is configured, but its worker is not connected."
                : `${formatAge(selected.status.heartbeat_at, selected.status.as_of)} since heartbeat at the data clock${mode === "synthetic" ? " (synthetic sample)" : ""}.`}
            </p>
            <dl className="mini-facts">
              <div>
                <dt>Completed traversals</dt>
                <dd>
                  <Quantity
                    value={traffic.totals.completed_traversals}
                    digits={0}
                  />
                </dd>
              </div>
              <div>
                <dt>Estimated NOₓ</dt>
                <dd>
                  <Quantity
                    value={selected.emissions.estimate_g_by_pollutant.nox}
                    unit="g"
                  />
                </dd>
              </div>
              <div>
                <dt>Calibration</dt>
                <dd>
                  {selected.calibration === "valid" ? "Valid" : "Not ready"}
                </dd>
              </div>
            </dl>
            <Link
              className="button button-primary"
              href={hrefWith(`/cameras/${selectedId}`, { mode })}
            >
              Explore intersection <ArrowRight size={16} />
            </Link>
          </section>
          <section className="class-card" key={`classes-${selectedId}`}>
            <header>
              <h2>Vehicle mix</h2>
              <Car size={17} />
            </header>
            <p>Camera {selectedId} · recorded crossings</p>
            {classCounts.length === 0 ? (
              <div className="small-empty">
                No class observations yet. A breakdown will appear when records
                arrive.
              </div>
            ) : (
              <>
                <div className="class-bars">
                  {classCounts.map(([name, count]) => (
                    <div key={name}>
                      <div>
                        <span>{name.replaceAll("_", " ")}</span>
                        <strong>
                          {count === null ? "Unavailable" : count}
                        </strong>
                      </div>
                      {count === null ? null : (
                        <meter
                          aria-label={`${name} crossings`}
                          min={0}
                          max={Math.max(
                            1,
                            crossings ??
                              Math.max(
                                ...classCounts.map((item) => item[1] ?? 0),
                              ),
                          )}
                          value={count}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <small>
                  Only {observedMinutes} recorded{" "}
                  {observedMinutes === 1 ? "minute" : "minutes"}; not an
                  hour-long trend.
                </small>
              </>
            )}
          </section>
        </aside>
      </div>
      <section className="evidence-path">
        <div className="evidence-path-title">
          <Leaf size={23} />
          <div>
            <h2>How an observation becomes an estimate</h2>
            <p>Each step matters. Missing evidence stays visible.</p>
          </div>
        </div>
        <div>
          <span className="step-number">1</span>
          <strong>Observe traffic</strong>
          <p>Crossings, queues, stopped time</p>
        </div>
        <ArrowRight size={16} />
        <div>
          <span className="step-number">2</span>
          <strong>Validate the road</strong>
          <p>Calibrated distances &amp; traversals</p>
        </div>
        <ArrowRight size={16} />
        <div>
          <span className="step-number">3</span>
          <strong>Estimate emissions</strong>
          <p>Regional factors, explicit assumptions</p>
        </div>
        <Link href={hrefWith("/brief", { mode, camera: selectedId })}>
          Create a planning brief <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}
