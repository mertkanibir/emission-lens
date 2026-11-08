import type { CSSProperties } from "react";
import type { MeasurementWindowView } from "@emission-lens/backend";
import { trafficFor } from "../../../backend/src/store";
import { evidenceAnalytics } from "@/lib/evidence-analytics";
import { formatInstant, hrefWith, modeLabel, PACIFIC } from "@/lib/format";
import { Panel, Quantity } from "./ui";
import "./evidence-analytics.css";

export function EvidenceAnalytics({ measurement, reduction }: { measurement: MeasurementWindowView; reduction?: number }) {
  const view = evidenceAnalytics(measurement, trafficFor(measurement.mode));
  const visible = view.slots.slice(-120);
  const max = Math.max(1, ...visible.map(slot => slot.count ?? 0));
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
        <section className="analytics-chart" aria-label="Crossings by recorded minute">
          <header><div><h3>Crossings and evidence coverage</h3><p>Choose a recorded minute to inspect its scoped comparison.</p></div><span>Scale 0–{max} crossings</span></header>
          {visible.length ? <>
            <div className="analytics-timeline-scroll"><div className="analytics-timeline" style={{"--analytics-columns": visible.length} as CSSProperties}>
              {visible.map(slot => {
                const label = `${formatInstant(slot.minute, PACIFIC)}: ${slot.count === null ? "crossings unavailable" : `${slot.count} crossings`}; ${slot.co2_g === null ? "CO2 estimate unavailable" : `${slot.co2_g} grams estimated CO2`}`;
                const content = <><span className="analytics-bar" data-missing={slot.count === null} style={{height: slot.count === null ? "100%" : `${Math.max(2, slot.count / max * 100)}%`}}/><span className="analytics-support" data-supported={slot.co2_g !== null}/></>;
                return slot.recorded ? <a className="analytics-minute" key={slot.minute} title={label} aria-label={label} href={hrefWith("/",{camera:view.camera_id,mode:view.mode,reduce:reduction,from:slot.minute,to:new Date(Date.parse(slot.minute)+60000).toISOString()})+"#scenario"}>{content}</a> : <span className="analytics-minute" key={slot.minute} title={label} aria-label={label}>{content}</span>;
              })}
            </div></div>
            <div className="analytics-axis"><span>{formatInstant(visible[0].minute,PACIFIC)}</span><span>{formatInstant(visible.at(-1)!.minute,PACIFIC)}</span></div>
            <p className="analytics-legend"><span><i/>Crossings</span><span><i data-gap/>Missing value</span><span><i data-supported/>Supported CO₂ snapshot</span></p>
          </> : <p className="context-note">No minute anchors fall inside this interval.</p>}
          <p className="fine">{view.slots.length>120?`Showing the final 120 of ${view.requested_minutes} requested minute anchors. Summary metrics use the full interval. `:""}The current minute may be partial. Empty or missing minutes are not zero; supported snapshots are not reporting-hour totals.</p>
        </section>
        <section className="analytics-composition" aria-label="Observed vehicle class composition"><h3>Observed class composition</h3><p className="fine">Crossings in recorded minutes only. Image labels are not regulatory fleet shares.</p>{view.classes.length ? view.classes.map(row=><div className="analytics-class" key={row.vehicle_class}><span>{row.vehicle_class.replaceAll("_"," ")}</span><strong><Quantity value={row.count} digits={0}/></strong><span className="analytics-class-track"><i style={{width:row.count===null?0:`${row.count/classMax*100}%`}}/></span></div>) : <p className="context-note">No class records in the selected interval.</p>}
          {view.peak ? <p className="fine"><strong>Peak recorded minute:</strong> {view.peak.count} crossings at {formatInstant(view.peak.minute,PACIFIC)}. This is a peak among available observations, not an extrapolated demand estimate.</p> : null}
        </section>
      </div>
      <details className="disclosure"><summary>Inspect exact interval records</summary><div className="table-scroll"><table className="data-table"><thead><tr><th>Minute · UTC</th><th className="num">Crossings</th><th className="num">Estimated CO₂ · g</th><th className="num">Linked cohort · vehicles</th></tr></thead><tbody>{view.slots.map(slot=><tr key={slot.minute}><td><time dateTime={slot.minute}>{slot.minute}</time>{!slot.recorded ? " · no observation" : ""}</td><td className="num"><Quantity value={slot.count} digits={0}/></td><td className="num"><Quantity value={slot.co2_g} digits={6}/></td><td className="num"><Quantity value={slot.cohort_count} digits={0}/></td></tr>)}</tbody></table></div></details>
      <p className="fine">Intensity divides CO₂ grams by completed vehicles from the same uniquely supported snapshots. It excludes snapshots with missing cohort counts and does not describe every crossing, the whole intersection, exposure or measured air quality.</p>
    </>}
  </Panel></section>;
}
