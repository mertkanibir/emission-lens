import type { CSSProperties } from "react";
import type { MeasurementWindowView } from "@emission-lens/backend";
import { trafficFor } from "../../../backend/src/store";
import { crossingAxis, timeTickIndexes } from "@/lib/analytics-chart";
import { evidenceAnalytics } from "@/lib/evidence-analytics";
import { formatInstant, formatLocalClock, hrefWith, modeLabel, PACIFIC } from "@/lib/format";
import { Panel, Quantity } from "./ui";
import "./evidence-analytics.css";


function CrossingChart({ view, reduction }: { view: ReturnType<typeof evidenceAnalytics>; reduction?: number }) {
  const slots = view.slots.slice(-120);
  const axis = crossingAxis(slots.map(slot => slot.count));
  const single = slots.length === 1;
  const supported = slots.filter(slot => slot.co2_g !== null).length;
  const ticks = timeTickIndexes(slots.length);
  const minuteHref = (minute: string) => hrefWith("/", { camera: view.camera_id, mode: view.mode, reduce: reduction, from: minute, to: new Date(Date.parse(minute) + 60000).toISOString() }) + "#scenario";
  const columns = { "--analytics-columns": slots.length, "--analytics-min-width": `${single ? 0 : Math.max(360, slots.length * 7)}px` } as CSSProperties;
  return <section className="analytics-chart" data-single={single} aria-label="Crossings by recorded minute">
    <header><div><h3>{single ? "One-minute evidence spotlight" : "Crossings over time"}</h3><p>{single ? `${slots[0].recorded ? "One recorded interval" : "One selected minute with no observations"}. A trend needs more than one minute.` : "Each column is one minute. Select a recorded column to inspect its comparison."}</p></div><span>LINE CROSSINGS / MIN</span></header>
    {slots.length ? <>
      <div className="analytics-chart-body">
        <div className="analytics-instrument">
          <div className="analytics-y-axis" aria-hidden="true">{axis.ticks.map(tick => <span key={tick} style={{ bottom: `${tick / axis.ceiling * 100}%` }}>{tick}</span>)}</div>
          <div className="analytics-timeline-scroll">
            <div className="analytics-instrument-canvas" style={columns}>
              <div className="analytics-plot">
                <div className="analytics-grid" aria-hidden="true">{axis.ticks.map(tick => <i key={tick} style={{ bottom: `${tick / axis.ceiling * 100}%` }} />)}</div>
                <div className="analytics-timeline">
                  {slots.map((slot, index) => {
                    const label = `${formatInstant(slot.minute, PACIFIC)}: ${slot.count === null ? "crossing count unavailable" : `${slot.count} crossings`}; ${slot.co2_g === null ? "CO2 estimate unavailable" : `${slot.co2_g} grams estimated CO2`}`;
                    const content = <><span className="analytics-bar" data-missing={slot.count === null} data-zero={slot.count === 0} style={{ height: slot.count === null ? "100%" : `${slot.count / axis.ceiling * 100}%` }} /><span className="analytics-tooltip" role="tooltip"><time dateTime={slot.minute}>{formatInstant(slot.minute, PACIFIC)}</time><strong>{slot.count === null ? "Count unavailable" : `${slot.count} crossings`}</strong><span>{slot.co2_g === null ? "No supported CO₂ snapshot" : `${slot.co2_g.toLocaleString("en-US", { maximumFractionDigits: 6 })} g estimated CO₂`}</span><small>{slot.recorded ? "Open this minute's comparison ↗" : "No observation record"}</small></span></>;
                    const alignment = index < slots.length / 3 ? "start" : index > slots.length * 2 / 3 ? "end" : "center";
                    return slot.recorded ? <a className="analytics-minute" data-tooltip-align={alignment} key={slot.minute} title={label} aria-label={label} href={minuteHref(slot.minute)}>{content}</a> : <span className="analytics-minute" data-tooltip-align={alignment} key={slot.minute} title={label} aria-label={label} tabIndex={0}>{content}</span>;
                  })}
                </div>
              </div>
              <div className="analytics-support-band" aria-label={`${supported} of ${slots.length} displayed minutes have supported CO2 snapshots`}>{slots.map(slot => <span key={slot.minute} data-supported={slot.co2_g !== null} title={`${formatInstant(slot.minute, PACIFIC)}: ${slot.co2_g !== null ? "supported CO₂ snapshot" : "no supported CO₂ snapshot"}`} />)}</div>
              <div className="analytics-axis" aria-hidden="true">{ticks.map(index => <span key={index} style={{ left: `${single ? 50 : index === slots.length - 1 ? 100 : index / slots.length * 100}%` }}>{formatLocalClock(!single && index === slots.length - 1 ? new Date(Date.parse(slots[index].minute) + 60000).toISOString() : slots[index].minute)}</span>)}</div>
            </div>
          </div>
        </div>
        {single ? <div className="analytics-spotlight"><span className="analytics-spotlight-kicker">Selected minute · {modeLabel(view.mode)}</span><strong><Quantity value={slots[0].count} digits={0} unavailable="Count unavailable" /></strong><span>line crossings</span><time dateTime={slots[0].minute}>{formatInstant(slots[0].minute, PACIFIC)}</time><p>{slots[0].co2_g === null ? "No supported CO₂ estimate for this minute." : `${slots[0].co2_g.toLocaleString("en-US", { maximumFractionDigits: 6 })} g estimated CO₂ · supported snapshot`}</p>{slots[0].recorded ? <a href={minuteHref(slots[0].minute)}>Inspect this minute ↗</a> : null}</div> : null}
      </div>
      <div className="analytics-chart-footer"><p className="analytics-legend"><span><i />Crossings</span><span><i data-gap />Unavailable count</span><span><i data-zero />Supported zero</span><span><i data-supported />CO₂ support band</span></p><span>{supported}/{slots.length} minutes supported · Torrance local time</span></div>
    </> : <p className="context-note">No minute anchors fall inside this interval.</p>}
    <p className="fine">{view.slots.length > 120 ? `Final 120 of ${view.requested_minutes} minutes shown; summaries use the full interval. ` : ""}Missing values stay missing. A zero mark is a supported zero; the latest minute may be partial.</p>
  </section>;
}

export function EvidenceAnalytics({ measurement, reduction }: { measurement: MeasurementWindowView; reduction?: number }) {
  const view = evidenceAnalytics(measurement, trafficFor(measurement.mode));
  const classMax = Math.max(1, ...view.classes.map(row => row.count ?? 0));
  return <section id="analytics" className="evidence-analytics"><Panel title="Evidence analytics" meta={`Camera ${view.camera_id} · ${modeLabel(view.mode)}`}>
    <p className="fine">{formatInstant(view.from, PACIFIC)} to {formatInstant(view.to, PACIFIC)}. This view follows the selected investigation interval. {view.mode === "synthetic" ? "Labeled synthetic sample; no field observations." : "Observed records and supported completed-movement estimates retain separate coverage."}</p>
    {!view.eligible ? <p className="context-note">Camera {view.camera_id} is excluded from quantitative analysis after its count screen. A retained preview does not enable these metrics.</p> : <>
      <div className="analytics-kpis">
        <div><span>Recorded minute anchors</span><strong>{view.recorded_minutes}<small> / {view.requested_minutes}</small></strong><p>Missing records stay unobserved.</p></div>
        <div><span>Supported CO₂ snapshots</span><strong>{view.supported_minutes}<small> / {view.requested_minutes}</small></strong><p>Matching approved measurement versions.</p></div>
        <div><span>Intensity cohort</span><strong><Quantity value={view.cohort_vehicles} digits={0}/></strong><p>Completed vehicles in {view.cohort_minutes} supported snapshot{view.cohort_minutes === 1 ? "" : "s"}.</p></div>
        <div><span>CO₂ / completed vehicle</span><strong><Quantity value={view.co2_per_completed_vehicle_g} digits={view.co2_per_completed_vehicle_g !== null && view.co2_per_completed_vehicle_g < 1 ? 6 : 3} unit="g"/></strong><p>Weighted within that exact supported cohort.</p></div>
      </div>
      <div className="analytics-views">
        <CrossingChart view={view} reduction={reduction} />
        <section className="analytics-composition" aria-label="Observed vehicle class composition"><h3>Observed class composition</h3><p className="fine">Crossings in recorded minutes only. Image labels are not regulatory fleet shares.</p>{view.classes.length ? view.classes.map(row=><div className="analytics-class" key={row.vehicle_class}><span>{row.vehicle_class.replaceAll("_"," ")}</span><strong><Quantity value={row.count} digits={0}/></strong><span className="analytics-class-track"><i style={{width:row.count===null?0:`${row.count/classMax*100}%`}}/></span></div>) : <p className="context-note">No class records in the selected interval.</p>}
          {view.peak ? <p className="fine"><strong>Peak recorded minute:</strong> {view.peak.count} crossings at {formatInstant(view.peak.minute,PACIFIC)}. This is a peak among available observations, not an extrapolated demand estimate.</p> : null}
        </section>
      </div>
      <details className="disclosure"><summary>Inspect exact interval records</summary><div className="table-scroll"><table className="data-table"><thead><tr><th>Minute · UTC</th><th className="num">Crossings</th><th className="num">Estimated CO₂ · g</th><th className="num">Linked cohort · vehicles</th></tr></thead><tbody>{view.slots.map(slot=><tr key={slot.minute}><td><time dateTime={slot.minute}>{slot.minute}</time>{!slot.recorded ? " · no observation" : ""}</td><td className="num"><Quantity value={slot.count} digits={0}/></td><td className="num"><Quantity value={slot.co2_g} digits={6}/></td><td className="num"><Quantity value={slot.cohort_count} digits={0}/></td></tr>)}</tbody></table></div></details>
      <p className="fine">Intensity divides CO₂ grams by completed vehicles from the same uniquely supported snapshots. It excludes snapshots with missing cohort counts and does not describe every crossing, the whole intersection, exposure or measured air quality.</p>
    </>}
  </Panel></section>;
}
