import {
  classRows,
  compare_scenario,
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
} from "@emission-lens/backend";
import { calibrationFor, cameraById, sumStrict, type Pollutant } from "@emission-lens/contracts";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ReductionInput } from "@/components/ReductionInput";
import { Panel, Quantity, QualityChip, Readout, SignalHead, StateChip } from "@/components/ui";
import {
  formatAge,
  formatCoordinates,
  formatInstant,
  formatLocalClock,
  formatNumber,
  formatWindow,
  hrefWith,
  isValidReduction,
  PACIFIC,
  parseMode,
  parseReduction,
} from "@/lib/format";

const POLLUTANT_LABEL: Record<Pollutant, string> = { co2: "CO₂", nox: "NOₓ" };

function uniqueText(values: Array<string | null>): string | null {
  const present = values.filter((value): value is string => value !== null);
  if (present.length === 0) return null;
  return present.every((value) => value === present[0]) ? present[0] : null;
}

function VersionText({ value }: { value: string | null }) {
  return value === null ? <Quantity value={null} /> : <span className="q">{value}</span>;
}

function Difference({ baseline, scenario }: { baseline: number | null; scenario: number | null }) {
  if (baseline === null || scenario === null) return <Quantity value={null} />;
  const delta = scenario - baseline;
  const sign = delta < 0 ? "\u2212" : delta > 0 ? "+" : "";
  const pct = baseline === 0 ? null : (delta / baseline) * 100;
  return (
    <span className="q compare-delta">
      {sign}
      {formatNumber(Math.abs(delta))}
      {pct === null ? null : (
        <span className="q-unit">
          ({sign}
          {formatNumber(Math.abs(pct), 0)}%)
        </span>
      )}
    </span>
  );
}

function RangeMeter({ estimate, low, high }: { estimate: number | null; low: number | null; high: number | null }) {
  if (estimate === null || low === null || high === null || high <= 0) {
    return <div className="range-meter range-meter-empty" aria-hidden="true" />;
  }
  const scale = high * 1.1;
  return (
    <div className="range-meter" aria-hidden="true">
      <span className="range-meter-band" style={{ left: `${(low / scale) * 100}%`, width: `${((high - low) / scale) * 100}%` }} />
      <span className="range-meter-tick" style={{ left: `${(estimate / scale) * 100}%` }} />
    </div>
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
      <AppShell mode={mode} section="camera" modeHref={(option) => hrefWith(`/cameras/${id}`, { mode: option })}>
        <div className="page">
          <div className="page-head">
            <h1 className="page-title">Camera {id} is not configured</h1>
            <p className="prose">No intersection with that id is in the contract. The four configured cameras are on the overview.</p>
          </div>
          <div>
            <Link className="button" href={hrefWith("/", { mode })}>
              Go to the overview
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
  const calibration = calibrationFor(id);
  const calibrationValid = calibration.validation_status === "valid";
  const scenario = validReduction ? compare_scenario({ cameraId: id, mode, stoppedTimeReductionPct: reduction }) : null;
  const rows = classRows(traffic.rows);
  const maxCount = Math.max(0, ...rows.map((row) => row.count ?? 0));
  const windowLabel = formatWindow(traffic.from, traffic.to, PACIFIC);

  const calibrationItems = [
    { label: "Road region of interest", done: camera.road_region !== null },
    { label: "Entry and exit gates", done: calibration.gates !== null },
    { label: "Road-plane reference measurements", done: calibration.reference_measurements !== null },
    { label: "Image-to-road transform", done: calibration.transform !== null },
  ];

  const pollutantRange = (pollutant: Pollutant) => {
    const matching = emissions.rows.filter((row) => row.pollutant === pollutant);
    const estimate = emissions.estimate_g_by_pollutant[pollutant];
    if (estimate === null) return { estimate, low: null, high: null };
    return {
      estimate,
      low: sumStrict(matching.map((row) => row.range_low_g)),
      high: sumStrict(matching.map((row) => row.range_high_g)),
    };
  };

  return (
    <AppShell
      mode={mode}
      section="camera"
      modeHref={(option) => hrefWith(`/cameras/${id}`, { mode: option, reduce: query.reduce })}
    >
      <div className="page">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href={hrefWith("/", { mode, camera: id })}>Overview</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Camera {id}</span>
        </nav>

        <header className="page-head">
          <div className="page-title-row">
            <SignalHead state={status.displayed_state} large />
            <h1 className="page-title">{camera.name}</h1>
            <span className="page-id">Camera {id}</span>
            <StateChip state={status.displayed_state} />
          </div>
          <div className="page-meta">
            <span className="mono">{formatCoordinates(camera.latitude, camera.longitude)}</span>
            <span>Reporting window {windowLabel}</span>
            <span>Stored timestamps are UTC. Times here are Torrance local time.</span>
          </div>
        </header>

        <div className="split">
          <div className="stack">
            <Panel title="Video" meta="Caltrans District 7 public CCTV" flush>
              <div className="viewport">
                <span className="corner tl" />
                <span className="corner tr" />
                <span className="corner bl" />
                <span className="corner br" />
                <span className="burn-in burn-in-tl">CCTV-{id}</span>
                <span className="burn-in burn-in-tr">{status.displayed_state.toUpperCase()}</span>
                <span className="burn-in burn-in-bl" title={camera.stream_url}>
                  {camera.stream_url}
                </span>
                <div className="viewport-msg">
                  <strong>No synchronized frame</strong>
                  <span>
                    Detections are only drawn over the frame they came from, so nothing is drawn over a leftover
                    image.
                  </span>
                </div>
              </div>
              <div className="panel-body">
                <dl className="readouts readouts-4">
                  <Readout
                    label="Heartbeat"
                    detail={
                      status.heartbeat_at === null ? undefined : `${formatAge(status.heartbeat_at, status.as_of)} before data clock`
                    }
                  >
                    {status.heartbeat_at === null ? (
                      <Quantity value={null} unavailable="None received" />
                    ) : (
                      <span className="q">{formatLocalClock(status.heartbeat_at)}</span>
                    )}
                  </Readout>
                  <Readout
                    label="Last source frame"
                    detail={status.last_source_timestamp === null ? undefined : formatInstant(status.last_source_timestamp, PACIFIC)}
                  >
                    {status.last_source_timestamp === null ? (
                      <Quantity value={null} />
                    ) : (
                      <span className="q">{formatLocalClock(status.last_source_timestamp)}</span>
                    )}
                  </Readout>
                  <Readout label="Processing delay">
                    <Quantity value={status.processing_delay_ms === null ? null : status.processing_delay_ms / 1000} unit="s" />
                  </Readout>
                  <Readout label="Inference rate">
                    <Quantity value={status.fps} unit="frames/s" />
                  </Readout>
                </dl>
                {status.state !== status.displayed_state ? (
                  <p className="note">
                    The worker last reported {status.state}. It is shown {status.displayed_state} because the heartbeat
                    is stale at the data clock.
                  </p>
                ) : null}
              </div>
            </Panel>

            <Panel title="Traffic in the reporting hour" meta={windowLabel} flush>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Line crossings</th>
                      <th className="num">
                        Completed <span className="unit">traversals</span>
                      </th>
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
                        <td colSpan={5}>No class rows in this window.</td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.vehicle_class}>
                          <td className="class-name">{row.vehicle_class}</td>
                          <td>
                            <div className="share">
                              <Quantity value={row.count} digits={0} />
                              {row.count === null ? null : (
                                <span className="share-bar" aria-hidden="true">
                                  <span style={{ width: `${maxCount === 0 ? 0 : (row.count / maxCount) * 100}%` }} />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="num">
                            <Quantity value={row.completed_traversals} digits={0} />
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
                          <Quantity value={traffic.totals.completed_traversals} digits={0} />
                        </td>
                        <td className="num">
                          <Quantity value={traffic.totals.stopped_vehicle_seconds} />
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
                <dl className="readouts">
                  <Readout label="Queue count">
                    <Quantity value={traffic.queue_count} unit="vehicles" digits={0} />
                  </Readout>
                  <Readout label="Queue length">
                    <Quantity value={traffic.queue_length_m} unit="m" />
                  </Readout>
                  <Readout label="Coverage">
                    <Quantity value={traffic.totals.coverage === null ? null : traffic.totals.coverage * 100} unit="%" digits={0} />
                  </Readout>
                </dl>
                <p>{traffic.note}</p>
              </div>
            </Panel>

            <Panel
              title="Calibration"
              meta={
                <>
                  <span className={calibrationValid ? "chip chip-ok" : "chip chip-missing"}>{calibration.validation_status}</span>
                  <span className="mono">version {calibration.version}</span>
                </>
              }
            >
              <ul className="checklist">
                {calibrationItems.map((item) => (
                  <li key={item.label}>
                    <span className={item.done ? "check-mark is-yes" : "check-mark"} aria-hidden="true">
                      {item.done ? "✓" : "✕"}
                    </span>
                    <span>{item.label}</span>
                    <span className={item.done ? "chip chip-ok" : "chip chip-missing"}>
                      {item.done ? "Configured" : "Missing"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className={calibrationValid ? "note note-info" : "note"}>
                {calibrationValid
                  ? "Calibration is valid. Speeds and distance-based emissions are supported."
                  : "Counts and image-based queue observations remain. Average speed and distance-based emissions stay suppressed until calibration is valid."}
              </p>
            </Panel>
          </div>

          <div className="stack">
            <Panel title="Estimated emissions" meta={<QualityChip state={emissions.quality_state} />}>
              {(["co2", "nox"] as const).map((pollutant) => {
                const range = pollutantRange(pollutant);
                return (
                  <div className="pollutant" key={pollutant}>
                    <dl className="readouts readouts-2">
                      <Readout label={`${POLLUTANT_LABEL[pollutant]}, central estimate`} large>
                        <Quantity value={range.estimate} unit="g" />
                      </Readout>
                      <Readout label="Scenario range">
                        {range.low === null || range.high === null ? (
                          <Quantity value={null} />
                        ) : (
                          <span className="q">
                            {formatNumber(range.low)} to {formatNumber(range.high)}
                            <span className="q-unit">g</span>
                          </span>
                        )}
                      </Readout>
                    </dl>
                    <RangeMeter estimate={range.estimate} low={range.low} high={range.high} />
                  </div>
                );
              })}
              <dl className="readouts readouts-2">
                <Readout label="Factor version">
                  <VersionText value={uniqueText(emissions.rows.map((row) => row.factor_version))} />
                </Readout>
                <Readout label="Method version">
                  <VersionText value={uniqueText(emissions.rows.map((row) => row.method_version))} />
                </Readout>
              </dl>
              <p>{emissions.note}</p>
              <p className="fine">
                Modeled tailpipe estimates, not a measured concentration or air-quality index. Scenario ranges are not
                statistical confidence intervals.
              </p>
            </Panel>

            <Panel title="Shorter-stop scenario" meta="Hypothetical change">
              <form action={`/cameras/${id}`} method="get" className="form-grid">
                {mode === "live" ? null : <input type="hidden" name="mode" value={mode} />}
                <div className="field">
                  <label className="field-label" htmlFor="reduce">
                    Reduce stopped time by
                  </label>
                  <ReductionInput id="reduce" defaultValue={validReduction ? reduction : 20} />
                  <span className="field-hint">
                    Vehicle count, distance, and moving time stay fixed. Only the observed stopped component changes.
                  </span>
                </div>
                <div>
                  <button className="button button-primary" type="submit">
                    Compare scenario
                  </button>
                </div>
              </form>

              {scenario === null ? (
                <p className="note">Enter a whole percentage from 0 to 100 to compare a scenario.</p>
              ) : (
                <>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Measure</th>
                          <th className="num">Baseline</th>
                          <th className="num">At {formatNumber(scenario.assumptions.stopped_time_reduction_pct, 0)}% less stopping</th>
                          <th className="num">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            Stopped time <span className="unit faint">vehicle-s</span>
                          </td>
                          <td className="num">
                            <Quantity value={scenario.baseline.stopped_vehicle_seconds} />
                          </td>
                          <td className="num">
                            <Quantity value={scenario.scenario.stopped_vehicle_seconds} />
                          </td>
                          <td className="num">
                            <Difference
                              baseline={scenario.baseline.stopped_vehicle_seconds}
                              scenario={scenario.scenario.stopped_vehicle_seconds}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>
                            Traversal time <span className="unit faint">vehicle-s</span>
                          </td>
                          <td className="num">
                            <Quantity value={scenario.baseline.traversal_time_s} />
                          </td>
                          <td className="num">
                            <Quantity value={scenario.scenario.traversal_time_s} />
                          </td>
                          <td className="num">
                            <Difference
                              baseline={scenario.baseline.traversal_time_s}
                              scenario={scenario.scenario.traversal_time_s}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>
                            Average speed <span className="unit faint">m/s</span>
                          </td>
                          <td className="num">
                            <Quantity
                              value={scenario.baseline.average_speed_m_s}
                              unavailable={calibrationValid ? "Unavailable" : "Suppressed"}
                            />
                          </td>
                          <td className="num">
                            <Quantity
                              value={scenario.scenario.average_speed_m_s}
                              unavailable={calibrationValid ? "Unavailable" : "Suppressed"}
                            />
                          </td>
                          <td className="num">
                            <Difference
                              baseline={scenario.baseline.average_speed_m_s}
                              scenario={scenario.scenario.average_speed_m_s}
                            />
                          </td>
                        </tr>
                        <tr>
                          <td>Estimated emissions</td>
                          <td className="num">
                            <Quantity value={scenario.baseline.estimate_g} />
                          </td>
                          <td className="num">
                            <Quantity value={scenario.scenario.estimate_g} />
                          </td>
                          <td className="num">
                            <Quantity value={null} />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {scenario.classes.length === 0 ? (
                    <p className="note">No traversals to compare. The result is insufficient evidence, not zero.</p>
                  ) : (
                    <details className="disclosure" open={scenario.baseline.stopped_vehicle_seconds === null}>
                      <summary>Stopped time by class</summary>
                      {scenario.baseline.stopped_vehicle_seconds === null ? (
                        <p className="fine">
                          The full-mix total is unavailable because at least one class has no stopped time. Classes
                          with a recorded value are compared here.
                        </p>
                      ) : null}
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
                              <td className="class-name">{row.vehicle_class}</td>
                              <td className="num">
                                <Quantity value={row.baseline_stopped_vehicle_seconds} />
                              </td>
                              <td className="num">
                                <Quantity value={row.scenario_stopped_vehicle_seconds} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  )}

                  <div className="field">
                    <span className="field-label">Model limits</span>
                    <ul className="limits">
                      {scenario.limitations.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
