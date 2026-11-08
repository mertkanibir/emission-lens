import {
  classRows,
  compare_scenario,
  get_camera_status,
  get_emissions_window,
  get_factor_catalog_status,
  get_traffic_window,
  listCameras,
  read_measurement_window,
  IngestError,
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
import { ScenarioWindowControls } from "@/components/ScenarioWindowControls";
import { latestCompleteScenarioMinute } from "@/lib/scenario-window";
import { CameraPreview } from "@/components/CameraPreview";
import { MeasurementReadiness } from "@/components/MeasurementReadiness";
import { MeasurementSnapshots } from "@/components/MeasurementSnapshots";
import { MeasurementScope } from "@/components/MeasurementScope";
import { SupportedMinuteEstimate } from "@/components/SupportedMinuteEstimate";
import { latestSupportedMapEstimate } from "@/lib/map-emissions";
import { measurementSupport, queueObservation } from "@/lib/observation-presentation";
import { measurementScope } from "@/lib/measurement-scope";
import { ScenarioPollutants } from "@/components/ScenarioPollutants";
import { registryCalibrationState, scenarioPollutantRows, observationStoppedRows } from "@/lib/measurement";
import { recordedMinuteHistory } from "@/lib/minute-history";
import {
  Panel,
  Quantity,
  EmissionQuantity,
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
  searchParams: Promise<{ mode?: string; reduce?: string; from?: string; to?: string }>;
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
  const now = new Date();
  const status = get_camera_status(id, mode, now);
  const traffic = get_traffic_window({ cameraId: id, mode, now });
  const emissions = get_emissions_window({ cameraId: id, mode, now });
  const factors = get_factor_catalog_status();
  const calibration = calibrationFor(id);
  const measurement = read_measurement_window({
    cameraId: id, mode, now,
    stoppedTimeReductionPct: validReduction ? reduction : 20,
  });
  const calibrationState = registryCalibrationState(measurement.registry);
  const calibrationValid = calibrationState === "valid";
  const minuteEstimate = latestSupportedMapEstimate(measurement);
  const support = measurementSupport(measurement.registry, minuteEstimate);
  const queue = queueObservation(traffic);
  let scenarioMeasurement = measurement;
  let scenarioWindowError: string | null = null;
  if (query.from !== undefined || query.to !== undefined) {
    try {
      scenarioMeasurement = read_measurement_window({
        cameraId: id, mode, now,
        stoppedTimeReductionPct: validReduction ? reduction : 20,
        from: query.from, to: query.to,
      });
    } catch (error) {
      if (!(error instanceof IngestError) || error.status !== 400) throw error;
      scenarioWindowError = error.message;
    }
  }
  const explicitScenarioWindow = scenarioMeasurement.scope === "explicit_window";
  const completeMinute = latestCompleteScenarioMinute(measurement, status.as_of);
  const scenario = validReduction
    ? compare_scenario({
        cameraId: id,
        mode,
        stoppedTimeReductionPct: reduction,
        now,
      })
    : null;
  const observationStops = scenario === null ? [] : observationStoppedRows(scenario.classes);
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
  const history = recordedMinuteHistory(traffic.rows);
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
            <span className="section-kicker">Latest queue observation</span>
            <strong>
              <Quantity
                value={queue.value}
                digits={0}
                unit="vehicles"
                unavailable={queue.label}
              />
            </strong>
            <p>{queue.value !== null && queue.minute ? <>Latest observation · {formatInstant(queue.minute, PACIFIC)}. Image count, not length.</> : queue.detail}</p>
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
                    <Readout label="Latest queue observation" detail={queue.value !== null && queue.minute ? formatInstant(queue.minute, PACIFIC) : queue.detail}>
                      <Quantity
                        value={queue.value}
                        unit="vehicles"
                        digits={0}
                        unavailable={queue.label}
                      />
                    </Readout>
                    <Readout label="Queue length">
                      <Quantity value={traffic.queue_length_m} unit="m" unavailable="No length observation" />
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
                <MeasurementScope scope={measurementScope(measurement)} />
                {minuteEstimate ? (
                  <SupportedMinuteEstimate estimate={minuteEstimate} cameraId={id} mode={mode} state={status.displayed_state} />
                ) : mode !== "synthetic" ? (
                  <p className="context-note"><strong>{support.label}.</strong> {support.detail}</p>
                ) : null}
                <h3>Reporting-hour totals</h3>
                <p className="fine">{windowLabel}. Each total requires support from every included record. A supported minute does not replace unavailable minutes with zero.</p>
                <p className="context-note">{emissions.note}</p>
                {ranges.map((range) => (
                  <div className="pollutant" key={range.pollutant}>
                    <dl className="readouts readouts-2">
                      <Readout
                        label={`${POLLUTANT_LABEL[range.pollutant]} · reporting hour`}
                        large
                      >
                        <EmissionQuantity value={range.estimate} />
                      </Readout>
                      <Readout label="Scenario range">
                        {range.low === null || range.high === null ? (
                          <Quantity value={null} />
                        ) : (
                          <span className="q">
                            {formatNumber(range.low, 6)}–{formatNumber(range.high, 6)}
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
                    The factor catalog supports several meteorological
                    assumptions. The exact retained assumptions and measurement
                    versions are listed below; these are not current weather
                    observations.
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
                <ScenarioWindowControls cameraId={id} mode={mode} reduction={validReduction ? reduction : 20} from={scenarioMeasurement.from} to={scenarioMeasurement.to} explicit={explicitScenarioWindow} candidate={completeMinute} error={scenarioWindowError} />
                {scenarioMeasurement.scenario.completed_cohort.count !== null
                  && scenarioMeasurement.scenario.completed_cohort.count > 0
                  && scenarioMeasurement.scenario.completed_cohort.baseline.stopped_time_s === null ? (
                    <p className="context-note">
                      Traversal-linked stopped time is unavailable. Nonzero
                      stopped-time reduction results remain unavailable.
                    </p>
                  ) : null}
                <form
                  action={`/cameras/${id}`}
                  method="get"
                  className="form-grid"
                >
                  {mode === "live" ? null : (
                    <input type="hidden" name="mode" value={mode} />
                  )}
                  {explicitScenarioWindow ? <>
                    <input type="hidden" name="from" value={scenarioMeasurement.from} />
                    <input type="hidden" name="to" value={scenarioMeasurement.to} />
                  </> : null}
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
                      <table className="data-table" aria-label="Original completed-cohort comparison">
                        <thead>
                          <tr>
                            <th>Completed-cohort measure</th>
                            <th className="num">Baseline</th>
                            <th className="num">
                              {formatNumber(reduction, 0)}
                              % less stopping
                            </th>
                            <th className="num">Change</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            {
                              label: "Completed-cohort distance · m",
                              before: scenarioMeasurement.scenario.completed_cohort.baseline.distance_m,
                              after: scenarioMeasurement.scenario.completed_cohort.scenario.distance_m,
                            },
                            {
                              label: "Completed-cohort traversal · vehicle-s",
                              before: scenarioMeasurement.scenario.completed_cohort.baseline.traversal_time_s,
                              after: scenarioMeasurement.scenario.completed_cohort.scenario.traversal_time_s,
                            },
                            {
                              label: "Traversal-linked stopped · vehicle-s",
                              before: scenarioMeasurement.scenario.completed_cohort.baseline.stopped_time_s,
                              after: scenarioMeasurement.scenario.completed_cohort.scenario.stopped_time_s,
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
                    <ScenarioPollutants rows={scenarioPollutantRows(scenarioMeasurement.scenario.pollutants)} />
                    {Object.values(scenarioMeasurement.scenario.pollutants).some((value) => value.baseline_g === null || value.scenario_g === null) ? (
                      <p className="context-note">
                        Unsupported pollutant values stay unavailable. Observation-minute
                        stopped time is separate from the original completed-traversal
                        cohort used for estimated emissions.
                      </p>
                    ) : null}
                    <details className="disclosure">
                      <summary>Completed cohort & calculation evidence</summary>
                      <p className="fine">
                        {scenarioMeasurement.scenario.completed_cohort.count === null
                          ? "No supported completed-traversal cohort is available."
                          : `${formatNumber(scenarioMeasurement.scenario.completed_cohort.count, 0)} completed ${scenarioMeasurement.scenario.completed_cohort.count === 1 ? "traversal" : "traversals"} in the original ${explicitScenarioWindow ? "selected window" : "reporting hour"} cohort.`}
                        {" "}The same vehicles and original completion timestamps are used
                        for baseline and scenario; hypothetical rows never enter observed totals.
                      </p>
                      <ul className="limits">
                        {scenarioMeasurement.scenario.assumptions.map((line) => <li key={line}>{line}</li>)}
                      </ul>
                      <div className="evidence-list">
                        {scenarioMeasurement.scenario.evidence_refs.map((reference) => <code key={reference}>{reference}</code>)}
                      </div>
                      <p className="fine">References identify retained calculation evidence. Private provenance requires authenticated access.</p>
                    </details>
                    {explicitScenarioWindow ? (
                      <p className="fine">General observation-minute stopped time remains in the reporting-hour traffic table. It is not substituted for this selected completed-movement cohort's linked stops.</p>
                    ) : observationStops.length === 0 ? (
                      <p className="context-note">
                        No observation-minute stopped-time records are available.
                        These records are separate from the completed movement cohort.
                      </p>
                    ) : (
                      <details
                        className="disclosure"
                        open={
                          scenario.baseline.stopped_vehicle_seconds === null
                        }
                      >
                        <summary>Observation-minute stopped time by class</summary>
                        <p className="fine">
                          These general minute observations can include vehicles
                          outside the completed cohort. Their stopped-time arithmetic
                          does not supply traversal-linked stops or emissions inputs.
                          A full-mix total requires a value for every class.
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
                              {observationStops.map((row) => (
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
                        {[...new Set([...(explicitScenarioWindow ? [] : scenario.limitations), ...scenarioMeasurement.limitations, ...scenarioMeasurement.scenario.limitations])].map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </details>
                    {explicitScenarioWindow ? <p className="fine">The brief and its export use the reporting hour. This selected-window comparison is not included in that draft.</p> : null}
                    <Link
                      className="button"
                      href={hrefWith("/brief", {
                        mode,
                        camera: id,
                        reduce: reduction,
                      })}
                    >
                      {explicitScenarioWindow ? "Open reporting-hour brief" : "Include this scenario in a brief"}
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
                    {calibrationState === "valid" ? "Registry approved" : calibrationState}
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
                  measurement={measurement}
                />
                <MeasurementSnapshots window={measurement} />
                <p className="context-note">
                  {calibrationValid
                    ? "The server registry reports physical calibration approved for this camera and mode. Each estimate still requires matching versioned measurements, class mappings and applied factors."
                    : "Speeds and distance-based emissions are suppressed until calibration is valid. A queue without completed calibrated traversals does not imply zero emissions."}
                </p>
                <p className="fine">
                  Calibration version: {measurement.registry.calibration_version ?? "Unavailable"}. Weather, nearby
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
