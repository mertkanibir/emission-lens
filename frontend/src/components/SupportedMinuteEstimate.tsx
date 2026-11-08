import type { CameraState, Mode } from "@emission-lens/contracts";
import type { MapEmissionEstimate } from "@/lib/map-emissions";
import { formatInstant, modeLabel, PACIFIC, stateLabel } from "@/lib/format";
import { EmissionQuantity, Quantity, Readout } from "@/components/ui";

/** A retained minute remains dated and mode-scoped even when its worker is stale. */
export function SupportedMinuteEstimate({ estimate, cameraId, mode, state, cohort }: {
  estimate: MapEmissionEstimate;
  cameraId: string;
  mode: Mode;
  state: CameraState;
  cohort?: { count: number | null; stopped_time_s: number | null } | null;
}) {
  const stopped = cohort?.stopped_time_s ?? null;
  const stoppedText = stopped !== null && Number.isFinite(stopped) && stopped >= 0
    ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 3, ...(stopped > 0 && stopped < 0.001 ? { notation: "scientific" as const } : {}) }).format(stopped)
    : null;
  return (
    <section className="supported-minute" aria-label="Latest supported minute estimate">
      <h3>Latest supported minute</h3>
      <p className="fine">
        Camera {cameraId} · {modeLabel(mode)} records · feed {stateLabel(state).toLowerCase()}<br />
        <time dateTime={estimate.minute} title={estimate.minute}>{formatInstant(estimate.minute, PACIFIC)}</time>
      </p>
      <dl className="readouts readouts-2">
        <Readout label="Estimated CO₂ · this minute"><EmissionQuantity value={estimate.co2_g} /></Readout>
        <Readout label="Estimated NOₓ · same minute"><EmissionQuantity value={estimate.nox_g} /></Readout>
        <Readout label="Completed movement cohort · same minute"><Quantity value={cohort?.count ?? null} digits={0} unit="vehicles" unavailable="Cohort not reported" /></Readout>
        <Readout label="Traversal-linked stopped time · same cohort">
          {stoppedText === null ? <Quantity value={null} unavailable="Linked stopped time unavailable" /> : <span className="q" title={`${stopped} vehicle-s`}>{stoppedText}<span className="q-unit">vehicle-s</span></span>}
        </Readout>
      </dl>
      <p className="fine">Completed movement vehicles only. This retained minute is separate from the reporting-hour total; it is not every crossing or measured air quality.</p>
      <p className="fine">Linked stopped time belongs only to this minute's completed movement cohort. General observation-hour stopped time remains separate. Video cannot establish whether an engine is running.</p>
    </section>
  );
}
