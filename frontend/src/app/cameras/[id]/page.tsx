import {
  classRows,
  compare_scenario,
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
} from "@emission-lens/backend";
import { calibrationFor, cameraById } from "@emission-lens/contracts";
import Link from "next/link";
import { ModeBanner, ModeLinks } from "@/app/page";
import { formatInstant, formatQuantity, PACIFIC, parseMode, parseReduction } from "@/lib/format";

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
      <main>
        <h2>Camera not configured</h2>
        <p>No intersection with that id is in the contract.</p>
        <Link href="/">Back to the overview</Link>
      </main>
    );
  }

  const reduction = parseReduction(query.reduce);
  const status = get_camera_status(id, mode);
  const traffic = get_traffic_window({ cameraId: id, mode });
  const emissions = get_emissions_window({ cameraId: id, mode });
  const calibration = calibrationFor(id);
  const scenario =
    Number.isFinite(reduction)
      ? compare_scenario({ cameraId: id, mode, stoppedTimeReductionPct: reduction })
      : null;

  return (
    <main className="stack">
      <p>
        <Link href={mode === "live" ? "/" : `/?mode=${mode}`}>Overview</Link>
      </p>
      <div className="meta">
        <h2>
          {camera.name} · {id}
        </h2>
        <span className={`status status-${status.displayed_state}`}>{status.displayed_state}</span>
      </div>
      <ModeLinks mode={mode} path={`/cameras/${id}`} />
      <ModeBanner mode={mode} />
      <section className="panel">
        <h2>Video</h2>
        <p>No synchronized frame is available, so nothing is drawn over a leftover image.</p>
        <p className="fine">Master playlist: {camera.stream_url}</p>
        <dl>
          <div>
            <dt>Heartbeat</dt>
            <dd>{formatInstant(status.heartbeat_at, PACIFIC)}</dd>
          </div>
          <div>
            <dt>Last source time</dt>
            <dd>{formatInstant(status.last_source_timestamp, PACIFIC)}</dd>
          </div>
          <div>
            <dt>Processing delay</dt>
            <dd>{formatQuantity(status.processing_delay_ms, "ms")}</dd>
          </div>
          <div>
            <dt>Inference rate</dt>
            <dd>{formatQuantity(status.fps, "frames/s")}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <h2>Calibration</h2>
        <p>Status: {calibration.validation_status}. Version {calibration.version}.</p>
        <p>
          Road region, gates, and measured distances are not configured. Speed and distance-based
          emissions stay suppressed.
        </p>
      </section>
      <section className="table-wrap">
        <h2>Traffic in the reporting hour</h2>
        <p>{traffic.note}</p>
        <p className="fine">
          {formatInstant(traffic.from, PACIFIC)} to {formatInstant(traffic.to, PACIFIC)}. Stored
          timestamps are UTC.
        </p>
        {traffic.rows.length === 0 ? (
          <p>No class rows.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Crossings</th>
                <th>Completed</th>
                <th>Stopped time</th>
                <th>Traversal time</th>
              </tr>
            </thead>
            <tbody>
              {classRows(traffic.rows).map((row) => (
                <tr key={row.vehicle_class}>
                  <td>{row.vehicle_class}</td>
                  <td>{formatQuantity(row.count, "")}</td>
                  <td>{formatQuantity(row.completed_traversals, "")}</td>
                  <td>{formatQuantity(row.stopped_vehicle_seconds, "vehicle-seconds")}</td>
                  <td>{formatQuantity(row.traversal_time_s, "vehicle-seconds")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl>
          <div>
            <dt>Queue count</dt>
            <dd>{formatQuantity(traffic.queue_count, "vehicles")}</dd>
          </div>
          <div>
            <dt>Queue length</dt>
            <dd>{formatQuantity(traffic.queue_length_m, "m")}</dd>
          </div>
          <div>
            <dt>Coverage</dt>
            <dd>{traffic.totals.coverage === null ? "Unavailable" : `${traffic.totals.coverage}`}</dd>
          </div>
          <div>
            <dt>Stopped time, full mix</dt>
            <dd>{formatQuantity(traffic.totals.stopped_vehicle_seconds, "vehicle-seconds")}</dd>
          </div>
        </dl>
      </section>
      <section className="panel">
        <h2>Estimated emissions</h2>
        <p>{emissions.note}</p>
        <dl>
          <div>
            <dt>CO₂</dt>
            <dd>{formatQuantity(emissions.estimate_g_by_pollutant.co2, "g")}</dd>
          </div>
          <div>
            <dt>NOₓ</dt>
            <dd>{formatQuantity(emissions.estimate_g_by_pollutant.nox, "g")}</dd>
          </div>
        </dl>
        <p className="fine">Factor version: unavailable. Method version: unavailable.</p>
      </section>
      <section className="panel">
        <h2>Shorter-stop scenario</h2>
        <form action={`/cameras/${id}`} method="get">
          <input type="hidden" name="mode" value={mode} />
          <label>
            Reduce stopped time by this percent
            <input name="reduce" type="number" min="0" max="100" step="1" defaultValue={Number.isFinite(reduction) ? reduction : 20} />
          </label>
          <button type="submit">Compare scenario</button>
        </form>
        {scenario === null ? (
          <p>Enter a percentage from 0 to 100.</p>
        ) : (
          <>
            <p>{scenario.limitations[0]}</p>
            {scenario.classes.length === 0 ? (
              <p>No traversals to compare. The result is insufficient evidence, not zero.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Baseline stopped time</th>
                    <th>Scenario stopped time</th>
                  </tr>
                </thead>
                <tbody>
                  {scenario.classes.map((row) => (
                    <tr key={row.vehicle_class}>
                      <td>{row.vehicle_class}</td>
                      <td>{formatQuantity(row.baseline_stopped_vehicle_seconds, "vehicle-seconds")}</td>
                      <td>{formatQuantity(row.scenario_stopped_vehicle_seconds, "vehicle-seconds")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <ul>
              {scenario.limitations.slice(1).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
