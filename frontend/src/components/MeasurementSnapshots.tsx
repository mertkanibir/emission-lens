import type { MeasurementWindowView } from "@emission-lens/backend";
import { formatInstant, PACIFIC } from "@/lib/format";
import { EmissionQuantity, Readout } from "@/components/ui";

/** Only the documented public receipt summary is rendered; private evidence is not fetched. */
export function MeasurementSnapshots({ window }: { window: MeasurementWindowView }) {
  return (
    <details className="disclosure">
      <summary>Retained measurement snapshots</summary>
      {window.minutes.length === 0 ? (
        <p className="fine">No measurement snapshots in this reporting window. Missing physical quantities remain unavailable.</p>
      ) : (
        window.minutes.map((minute) => (
          <div key={`${minute.batch_id}-${minute.revision}`} className="pollutant">
            <h3>{formatInstant(minute.minute, PACIFIC)}</h3>
            <p className="fine">Calculation state: {minute.state} · revision {minute.revision}</p>
            <ul className="limits">
              {minute.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
            <p className="fine">Timing basis: {minute.timing_basis}. This does not establish verified source capture UTC.</p>
            <p className="fine">Supplied assumptions for this minute: {minute.meteorology.temperature_f} °F; {minute.meteorology.relative_humidity_pct}% relative humidity. These are not observed weather conditions.</p>
            <p className="fine">Per-minute estimates for completed movement vehicles. An unavailable minute stays unavailable; these values do not create a partial whole-window total.</p>
            <dl className="readouts readouts-2">
              {(["co2", "nox"] as const).map((pollutant) => {
                const row = minute.emissions.find((value) => value.pollutant === pollutant);
                return (
                  <Readout key={pollutant} label={`Estimated ${pollutant === "co2" ? "CO₂" : "NOₓ"} · ${row?.quality_state.replaceAll("_", " ") ?? "unavailable"}`}>
                    <EmissionQuantity value={row?.quality_state === "ok" ? row.estimate_g : null} />
                  </Readout>
                );
              })}
            </dl>
            <div className="evidence-list">
              <code>Calibration: {minute.calibration_version ?? "Unavailable"}</code>
              <code>Mapping: {minute.mapping_version ?? "Unavailable"}</code>
              <code>Evidence: {minute.evidence_ref ?? "Unavailable"}</code>
              {minute.emissions.map((row) => (
                <code key={row.pollutant}>
                  {row.pollutant === "co2" ? "CO₂" : "NOₓ"} · {row.quality_state.replaceAll("_", " ")} · factor: {row.factor_version ?? "Unavailable"} · method: {row.method_version ?? "Unavailable"}
                </code>
              ))}
            </div>
          </div>
        ))
      )}
      <p className="fine">References identify private calculation records. Raw session/traversal identities and footage are not part of this public view.</p>
    </details>
  );
}
