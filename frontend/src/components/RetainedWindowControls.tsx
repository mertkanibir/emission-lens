import { retained_measurement_minutes } from "@emission-lens/backend";
import type { Mode } from "@emission-lens/contracts";
import { formatInstant, PACIFIC } from "@/lib/format";

/** Retained data is explicitly selected; it never masquerades as a current live window. */
export function RetainedWindowControls({ cameraId, mode, reduction, from, to, now, embedded = false }: {
  cameraId: string; mode: Mode; reduction: number; from?: string; to?: string; now?: Date; embedded?: boolean;
}) {
  const minutes = retained_measurement_minutes({ cameraId, mode, now });
  const value = from && to ? `${from}|${to}` : "";
  const selected = minutes.find((minute) => Date.parse(minute.from) === Date.parse(from ?? "") && Date.parse(minute.to) === Date.parse(to ?? ""));
  const matchedValue = selected ? `${selected.from}|${selected.to}` : value;
  return <section className="retained-window" aria-label="Retained evidence window">
    <div><h3>Evidence interval</h3><p>Current observations remain in the reporting hour. Choose a dated completed minute from the retained 24-hour index for scenarios, review and planning. A live-mode archive is historical evidence; feed freshness is shown separately.</p></div>
    <form action={embedded ? "/#selected-camera" : `/cameras/${cameraId}`} method="get">
      {embedded ? <input type="hidden" name="camera" value={cameraId} /> : null}
      <input type="hidden" name="mode" value={mode} /><input type="hidden" name="reduce" value={reduction} />
      <label className="field-label" htmlFor={`retained-${cameraId}`}>Camera {cameraId} · {mode} · comparison interval</label>
      <div className="retained-window-controls"><select id={`retained-${cameraId}`} name="window" defaultValue={matchedValue}>
        <option value="">Current reporting hour</option>
        {value && !selected ? <option value={value}>Explicit interval · {from} to {to}</option> : null}
        {minutes.map((minute) => <option key={minute.from} value={`${minute.from}|${minute.to}`}>{formatInstant(minute.minute, PACIFIC)} · {minute.supported ? `${minute.completed_count} completed movement vehicles` : "insufficient evidence"}</option>)}
      </select><button className="button" type="submit">Inspect interval</button></div>
    </form>
    {minutes.length === 0 ? <p className="fine">No complete retained minute is available for this camera and mode.</p> : null}
  </section>;
}
