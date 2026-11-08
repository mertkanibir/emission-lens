import {
  classRows,
  compare_scenario,
  get_camera_status,
  get_emissions_window,
  get_factor_catalog_status,
  get_traffic_window,
  listCameras,
} from "@emission-lens/backend";
import {
  calibrationFor,
  cameraById,
  sumStrict,
  type Pollutant,
} from "@emission-lens/contracts";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReductionInput } from "@/components/ReductionInput";
import { CameraPreview } from "@/components/CameraPreview";
import { MeasurementReadiness } from "@/components/MeasurementReadiness";
import {
  Panel,
  Quantity,
  QualityChip,
  Readout,
  StateChip,
} from "@/components/ui";
import {
  formatAge,
  formatCoordinates,
  formatInstant,
  formatLocalClock,
  formatNumber,
  formatPercent,
  formatWindow,
  hrefWith,
  isValidReduction,
  modeLabel,
  PACIFIC,
  parseMode,
  parseReduction,
} from "@/lib/format";

const POLLUTANT_LABEL: Record<Pollutant, string> = { co2: "CO₂", nox: "NOₓ" };

function uniqueText(values: Array<string | null>): string | null {
  const present = values.filter((value): value is string => value !== null);
  return present.length > 0 && present.every((value) => value === present[0])
    ? present[0]
    : null;
}

function Difference({
  baseline,
  scenario,
}: {
  baseline: number | null;
  scenario: number | null;
}) {
  if (baseline === null || scenario === null) return <Quantity value={null} />;
  const delta = scenario - baseline;
  const sign = delta < 0 ? "−" : delta > 0 ? "+" : "";
  return (
    <span className="q compare-delta">
      {sign}
      {formatNumber(Math.abs(delta))}
      {baseline === 0 ? null : (
        <span className="q-unit">
          {" "}
          ({sign}
          {formatNumber(Math.abs(delta / baseline) * 100, 0)}%)
        </span>
      )}
    </span>
  );
}

export default async function CameraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; reduce?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const mode = parseMode(query.mode);
  const camera = cameraById(id);
  if (!camera) {
    return (
      <AppShell
        mode={mode}
        section="camera"
        modeHref={(option) => hrefWith(`/cameras/${id}`, { mode: option })}
      >
        <div className="page">
          <div className="empty-state">
            <span className="section-kicker">Intersection not found</span>
            <h1 className="page-title">Camera {id} is not configured</h1>
            <p>
              Choose one of the four configured intersections to inspect its
              evidence.
            </p>
            <Link
              className="button button-primary"
              href={hrefWith("/", { mode })}
            >
              Back to overview
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const reduction = parseReduction(query.reduce);
  const validReduction = isValidReduction(reduction);
  const status = get_camera_status(id, mode);
  const traffic = get_traffic_window({ cameraId: id, mode });
  const emissions = get_emissions_window({ cameraId: id, mode });
  const factors = get_factor_catalog_status();
  const calibration = calibrationFor(id);
  const calibrationValid = calibration.validation_status === "valid";
  const scenario = validReduction
    ? compare_scenario({
        cameraId: id,
        mode,
        stoppedTimeReductionPct: reduction,
      })
    : null;
  // Class totals span the selected window; the minute history below keeps the
  // original records separate. Camera-minute queue observations are never summed.
  const rows = classRows(
    [...new Set(traffic.rows.map((row) => row.vehicle_class))].map(
      (vehicleClass) => {
        const members = traffic.rows.filter(
          (row) => row.vehicle_class === vehicleClass,
        );
        return {
          ...members[0],
          run_id: null,
          minute: traffic.from,
          count: sumStrict(members.map((row) => row.count)),
          completed_traversals: sumStrict(
            members.map((row) => row.completed_traversals),
          ),
          stopped_vehicle_seconds: sumStrict(
            members.map((row) => row.stopped_vehicle_seconds),
          ),
          traversal_time_s: sumStrict(
            members.map((row) => row.traversal_time_s),
          ),
          distance_m: sumStrict(members.map((row) => row.distance_m)),
          queue_count: null,
          queue_length_m: null,
          coverage: null,
        };
      },
    ),
  );
  const maxCount = Math.max(0, ...rows.map((row) => row.count ?? 0));
  const windowLabel = formatWindow(traffic.from, traffic.to, PACIFIC);
  const history = [...new Set(traffic.rows.map((row) => row.minute))]
    .sort()
    .map((minute) => {
      const minuteRows = traffic.rows.filter((row) => row.minute === minute);
      return {
        minute,
        count: sumStrict(minuteRows.map((row) => row.count)),
        traversals: sumStrict(
          minuteRows.map((row) => row.completed_traversals),
        ),
        stopped: sumStrict(
          minuteRows.map((row) => row.stopped_vehicle_seconds),
        ),
      };
    });
  const ranges = (["co2", "nox"] as const).map((pollutant) => {
    const matching = emissions.rows.filter(
      (row) => row.pollutant === pollutant,
    );
    const estimate = emissions.estimate_g_by_pollutant[pollutant];
    return {
      pollutant,
      estimate,
      low:
        estimate === null
          ? null
          : sumStrict(matching.map((row) => row.range_low_g)),
      high:
        estimate === null
          ? null
          : sumStrict(matching.map((row) => row.range_high_g)),
    };
  });

  return (
    <AppShell
      mode={mode}
      section="camera"
      modeHref={(option) =>
        hrefWith(`/cameras/${id}`, { mode: option, reduce: query.reduce })
      }
    >
      <div className="page camera-page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href={hrefWith("/", { mode, camera: id })}>Overview</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Camera {id}</span>
        </nav>
        <header className="page-head">
          <div className="page-title-row">
            <div>
              <p className="section-kicker">
                Intersection details · Camera {id}
              </p>
              <h1 className="page-title">{camera.name}</h1>
            </div>
            <StateChip state={status.displayed_state} />
          </div>
          <p className="prose">
            See what the camera supports, understand what is missing, and
            explore a clearly hypothetical change.
          </p>
          <div className="page-meta">
            <span>{formatCoordinates(camera.latitude, camera.longitude)}</span>
            <span>{windowLabel}</span>
            <span>{modeLabel(mode)}</span>
          </div>
        </header>
        <nav className="camera-switcher" aria-label="Choose intersection">
          {listCameras().map((item) => (
            <Link
              key={item.id}
              className="button"
              href={hrefWith(`/cameras/${item.id}`, {
                mode,
                reduce: query.reduce,
              })}
              aria-current={item.id === id ? "page" : undefined}
            >
              {item.id} · {item.name.replace(/^SR-\d+ at /, "")}
            </Link>
          ))}
        </nav>
        <div className="metric-grid">
          <article className="summary-card summary-card--crossings">
            <span className="section-kicker">Line crossings</span>
            <strong>
              <Quantity value={traffic.totals.count} digits={0} />
            </strong>
            <p>Unique crossings, never frame detections.</p>
          </article>
          <article className="summary-card summary-card--traversals">
            <span className="section-kicker">Completed traversals</span>
            <strong>
              <Quantity
                value={traffic.totals.completed_traversals}
                digits={0}
              />
            </strong>
            <p>Vehicles that completed the observed segment.</p>
          </article>
          <article className="summary-card summary-card--queue">
            <span className="section-kicker">Queue count</span>
            <strong>
              <Quantity
                value={traffic.queue_count}
                digits={0}
                unit="vehicles"
              />
            </strong>
            <p>Image-based observation; distance is separate.</p>
          </article>
          <article className="summary-card summary-card--coverage">
            <span className="section-kicker">Recorded-minute coverage</span>
            <strong>
              {traffic.totals.coverage === null ? (
                <Quantity value={null} />
              ) : (
                formatPercent(traffic.totals.coverage)
              )}
            </strong>
            <p>Applies to recorded minutes, not the full reporting hour.</p>
          </article>
        </div>
        <nav className="section-nav" aria-label="Camera sections">
          <a href="#observation">Observation</a>
          <a href="#traffic">Traffic & history</a>
          <a href="#emissions">Estimated emissions</a>
          <a href="#scenario">Explore a scenario</a>
          <a href="#evidence">Evidence & calibration</a>
        </nav>
        <div className="split">
          <div className="stack">
            <section id="observation">
              <Panel
                title="Camera observation"
                meta={<span>Caltrans District 7 · {modeLabel(mode)}</span>}
                flush
              >
                <CameraPreview
                  key={`${id}-${mode}`}
                  cameraId={id}
                  mode={mode}
                />
                <div className="panel-body">
                  <dl className="readouts readouts-2">
                    <Readout
                      label="Worker heartbeat"
                      detail={
                        status.heartbeat_at === null
                          ? "No worker connected"
                          : `${formatAge(status.heartbeat_at, status.as_of)} before the data clock`
                      }
                    >
                      {status.heartbeat_at === null ? (
                        <Quantity value={null} unavailable="None received" />
                      ) : (
                        <span className="q">
                          {formatLocalClock(status.heartbeat_at)}
                        </span>
                      )}
                    </Readout>
                    <Readout
                      label="Source capture time"
                      detail="Independent of the worker heartbeat; unavailable when the feed has no capture metadata."
                    >
                      {status.last_source_timestamp === null ? (
                        <Quantity value={null} />
                      ) : (
                        <span className="q">
                          {formatLocalClock(status.last_source_timestamp)}
                        </span>
                      )}
                    </Readout>
                    <Readout label="Processing delay">
                      <Quantity
                        value={
                          status.processing_delay_ms === null
                            ? null
                            : status.processing_delay_ms / 1000
                        }
                        unit="s"
                      />
                    </Readout>
                    <Readout label="Inference rate">
                      <Quantity value={status.fps} unit="frames/s" />
                    </Readout>
                  </dl>
                  {status.state !== status.displayed_state ? (
                    <p className="context-note">
                      The worker last reported {status.state}. Its heartbeat is
                      stale at the data clock, so this camera is shown as{" "}
                      {status.displayed_state}.
                    </p>
                  ) : null}
                  <details className="disclosure">
                    <summary>Source & timestamps</summary>
                    <p className="fine">
                      Public Caltrans feed:{" "}
                      <a
                        href={camera.stream_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source playlist
                      </a>
                    </p>
                    <p className="fine">
                      Data as of {formatInstant(status.as_of, PACIFIC)}. Source
                      timestamps are stored in UTC; displayed times use Torrance
                      local time.
                    </p>
                  </details>
                </div>
              </Panel>
            </section>
            <section id="traffic">
              <Panel title="Traffic by vehicle class" meta={windowLabel} flush>
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Vehicle class</th>
                        <th>Crossings</th>
                        <th className="num">Completed traversals</th>
                        <th className="num">
                          Stopped time <span className="unit">vehicle-s</span>
                        </th>
                        <th className="num">
                          Traversal time <span className="unit">vehicle-s</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr className="empty-row">
                          <td colSpan={5}>
                            No traffic observations in this window. Missing data
                            is not a zero.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row) => (
                          <tr key={row.vehicle_class}>
                            <td className="class-name">
                              {row.vehicle_class.replaceAll("_", " ")}
                            </td>
                            <td>
                              <div className="share">
                                <Quantity value={row.count} digits={0} />
                                {row.count === null ? null : (
                                  <span
                                    className="share-bar"
                                    aria-hidden="true"
                                  >
                                    <span
                                      style={{
                                        width: `${maxCount === 0 ? 0 : (row.count / maxCount) * 100}%`,
                                      }}
                                    />
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="num">
                              <Quantity
                                value={row.completed_traversals}
                                digits={0}
                              />
                            </td>
                            <td className="num">
                              <Quantity value={row.stopped_vehicle_seconds} />
                            </td>
                            <td className="num">
                              <Quantity value={row.traversal_time_s} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {rows.length === 0 ? null : (
                      <tfoot>
                        <tr>
                          <td>All classes</td>
                          <td>
                            <Quantity value={traffic.totals.count} digits={0} />
                          </td>
                          <td className="num">
                            <Quantity
                              value={traffic.totals.completed_traversals}
                              digits={0}
                            />
                          </td>
                          <td className="num">
                            <Quantity
                              value={traffic.totals.stopped_vehicle_seconds}
                            />
                          </td>
                          <td className="num">
                            <Quantity value={traffic.totals.traversal_time_s} />
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                <div className="panel-body">
                  <p>{traffic.note}</p>
                  <p className="fine">
                    Stopped time describes observed vehicle movement. The video
                    cannot establish whether an engine is running.
                  </p>
                  <dl className="readouts readouts-2">
                    <Readout label="Queue count">
                      <Quantity
                        value={traffic.queue_count}
                        unit="vehicles"
                        digits={0}
                      />
                    </Readout>
                    <Readout label="Queue length">
                      <Quantity value={traffic.queue_length_m} unit="m" />
                    </Readout>
                  </dl>
                </div>
              </Panel>
            </section>
            <Panel
              title="Recorded minute history"
              meta={`${history.length} available ${history.length === 1 ? "minute" : "minutes"}`}
              flush
            >
              {history.length === 0 ? (
                <div className="empty-state">
                  <h3>History starts with the first observation</h3>
                  <p>
                    No minute aggregates are available in this reporting window.
                    Gaps stay visible rather than being filled with invented
                    activity.
                  </p>
                </div>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Minute · Torrance local</th>
                          <th className="num">Crossings</th>
                          <th className="num">Completed</th>
                          <th className="num">Stopped vehicle-s</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((row) => (
                          <tr key={row.minute}>
                            <td>{formatInstant(row.minute, PACIFIC)}</td>
                            <td className="num">
                              <Quantity value={row.count} digits={0} />
                            </td>
                            <td className="num">
                              <Quantity value={row.traversals} digits={0} />
                            </td>
                            <td className="num">
                              <Quantity value={row.stopped} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="panel-body">
                    <p className="fine">
                      Only recorded minutes are shown.{" "}
                      {mode === "synthetic"
                        ? "These are labeled test records, not a field time series."
                        : "Unlisted minutes have no observations."}
                    </p>
                  </div>
                </>
              )}
            </Panel>
          </div>
          <div className="stack">
            <section id="emissions">
              <Panel
                title="Estimated emissions"
                meta={<QualityChip state={emissions.quality_state} />}
              >
                <p className="context-note">{emissions.note}</p>
                {ranges.map((range) => (
                  <div className="pollutant" key={range.pollutant}>
                    <dl className="readouts readouts-2">
                      <Readout
                        label={`${POLLUTANT_LABEL[range.pollutant]} · central estimate`}
                        large
                      >
                        <Quantity value={range.estimate} unit="g" />
                      </Readout>
                      <Readout label="Scenario range">
                        {range.low === null || range.high === null ? (
                          <Quantity value={null} />
                        ) : (
                          <span className="q">
                            {formatNumber(range.low)}–{formatNumber(range.high)}
                            <span className="q-unit">g</span>
                          </span>
                        )}
                      </Readout>
                    </dl>
                  </div>
                ))}
                <p className="fine">
                  Tailpipe CO₂ and NOₓ are modeled from completed, calibrated
                  traversals. They are not measured air quality. Scenario ranges
                  are not statistical confidence intervals.
                </p>
                <details className="disclosure">
                  <summary>Calculation method & factor provenance</summary>
                  <p className="fine">
                    Segment distance × the matching running-exhaust factor,
                    using total traversal time including stops. Ordinary
                    driving-cycle idling is already included; no second idle
                    term is added.
                  </p>
                  <p className="fine">
                    Factor catalog:{" "}
                    <a href={factors.source_url}>
                      CARB {factors.model_version}
                    </a>{" "}
                    · {factors.region} · {factors.calendar_year} · Annual.{" "}
                    {factors.validation.factor_rows.toLocaleString("en-US")}{" "}
                    validated factors, in g/vehicle-km. CARB aggregates fuel and
                    model-year mixtures.
                  </p>
                  <p className="fine">
                    Temperature assumptions are 60, 70, and 80 °F at 60%
                    relative humidity. These are scenario assumptions, not
                    current weather observations.
                  </p>
                  <dl className="readouts readouts-2">
                    <Readout label="Applied factor version">
                      {uniqueText(
                        emissions.rows.map((row) => row.factor_version),
                      ) ?? <Quantity value={null} />}
                    </Readout>
                    <Readout label="Applied method version">
                      {uniqueText(
                        emissions.rows.map((row) => row.method_version),
                      ) ?? <Quantity value={null} />}
                    </Readout>
                  </dl>
                </details>
              </Panel>
            </section>
            <section id="scenario">
              <Panel
                title="What if stops were shorter?"
                meta={<span className="chip chip-draft">Hypothetical</span>}
              >
                <p>
                  Explore how less stopped time would change the same traffic
                  sample. This does not predict what a signal adjustment would
                  achieve.
                </p>
                <form
                  action={`/cameras/${id}`}
                  method="get"
                  className="form-grid"
                >
                  {mode === "live" ? null : (
                    <input type="hidden" name="mode" value={mode} />
                  )}
                  <div className="field">
                    <label className="field-label" htmlFor="reduce">
                      Reduce stopped time by
                    </label>
                    <ReductionInput
                      key={`${id}-${mode}-${reduction}`}
                      id="reduce"
                      defaultValue={validReduction ? reduction : 20}
                    />
                    <span className="field-hint">
                      Vehicle count, distance, and moving time stay fixed.
                    </span>
                  </div>
                  <button className="button button-primary" type="submit">
                    Compare scenario
                  </button>
                </form>
                {scenario === null ? (
                  <p className="note" role="alert">
                    Enter a percentage from 0 to 100 to compare a scenario.
                  </p>
                ) : (
                  <>
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Measure</th>
                            <th className="num">Baseline</th>
                            <th className="num">
                              {formatNumber(
                                scenario.assumptions.stopped_time_reduction_pct,
                                0,
                              )}
                              % less stopping
                            </th>
                            <th className="num">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              label: "Stopped vehicle-s",
                              before: scenario.baseline.stopped_vehicle_seconds,
                              after: scenario.scenario.stopped_vehicle_seconds,
                            },
                            {
                              label: "Traversal vehicle-s",
                              before: scenario.baseline.traversal_time_s,
                              after: scenario.scenario.traversal_time_s,
                            },
                            {
                              label: "Average speed · m/s",
                              before: scenario.baseline.average_speed_m_s,
                              after: scenario.scenario.average_speed_m_s,
                            },
                            {
                              label: "Estimated emissions · g",
                              before: scenario.baseline.estimate_g,
                              after: scenario.scenario.estimate_g,
                            },
                          ].map((row) => (
                            <tr key={row.label}>
                              <td>{row.label}</td>
                              <td className="num">
                                <Quantity
                                  value={row.before}
                                  unavailable={
                                    row.label.startsWith("Average speed") &&
                                    !calibrationValid
                                      ? "Suppressed"
                                      : "Unavailable"
                                  }
                                />
                              </td>
                              <td className="num">
                                <Quantity
                                  value={row.after}
                                  unavailable={
                                    row.label.startsWith("Average speed") &&
                                    !calibrationValid
                                      ? "Suppressed"
                                      : "Unavailable"
                                  }
                                />
                              </td>
                              <td className="num">
                                <Difference
                                  baseline={row.before}
                                  scenario={row.after}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {scenario.baseline.estimate_g === null ||
                    scenario.scenario.estimate_g === null ? (
                      <p className="context-note">
                        Estimated grams are unavailable for this comparison. A
                        numeric change in stopped time does not establish an
                        emissions change.
                      </p>
                    ) : null}
                    {scenario.classes.length === 0 ? (
                      <p className="context-note">
                        There are no traversals to compare. The result is
                        insufficient evidence, not zero.
                      </p>
                    ) : (
                      <details
                        className="disclosure"
                        open={
                          scenario.baseline.stopped_vehicle_seconds === null
                        }
                      >
                        <summary>Stopped time by vehicle class</summary>
                        <p className="fine">
                          A full-mix total requires a value for every class.
                          Available class observations can still be compared
                          individually.
                        </p>
                        <div className="table-scroll">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Class</th>
                                <th className="num">Baseline</th>
                                <th className="num">Scenario</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scenario.classes.map((row) => (
                                <tr key={row.vehicle_class}>
                                  <td className="class-name">
                                    {row.vehicle_class.replaceAll("_", " ")}
                                  </td>
                                  <td className="num">
                                    <Quantity
                                      value={
                                        row.baseline_stopped_vehicle_seconds
                                      }
                                    />
                                  </td>
                                  <td className="num">
                                    <Quantity
                                      value={
                                        row.scenario_stopped_vehicle_seconds
                                      }
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                    <details className="disclosure">
                      <summary>Assumptions & limitations</summary>
                      <ul className="limits">
                        {scenario.limitations.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </details>
                    <Link
                      className="button"
                      href={hrefWith("/brief", {
                        mode,
                        camera: id,
                        reduce: reduction,
                      })}
                    >
                      Include this scenario in a brief
                    </Link>
                  </>
                )}
              </Panel>
            </section>
            <section id="evidence">
              <Panel
                title="Calibration & evidence readiness"
                meta={
                  <span
                    className={
                      calibrationValid ? "chip chip-ok" : "chip chip-missing"
                    }
                  >
                    {calibration.validation_status}
                  </span>
                }
              >
                <p className="fine">
                  These are the prerequisites behind an estimate, not a
                  completion score. Counts and image-based queues require
                  reviewed image geometry; physical distances require
                  independent calibration.
                </p>
                <MeasurementReadiness
                  camera={camera}
                  calibration={calibration}
                  traffic={traffic}
                  emissions={emissions}
                  factors={factors}
                  mode={mode}
                />
                <p className="context-note">
                  {calibrationValid
                    ? "Calibration is marked valid. Supported estimates still require calibrated completed traversals, documented class mappings, and applied factor provenance."
                    : "Speeds and distance-based emissions are suppressed until calibration is valid. A queue without completed calibrated traversals does not imply zero emissions."}
                </p>
                <p className="fine">
                  Calibration version: {calibration.version}. Weather, nearby
                  schools, and community context are not loaded for this window.
                </p>
              </Panel>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
