import type { CameraState, Mode } from "@emission-lens/contracts";
import type { MapEmissionEstimate } from "@/lib/map-emissions";
import { formatInstant, modeLabel, PACIFIC, stateLabel } from "@/lib/format";
import { EmissionQuantity, Readout } from "@/components/ui";

/** A retained minute remains dated and mode-scoped even when its worker is stale. */
export function SupportedMinuteEstimate({ estimate, cameraId, mode, state }: {
  estimate: MapEmissionEstimate;
  cameraId: string;
  mode: Mode;
  state: CameraState;
}) {
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
      </dl>
      <p className="fine">Completed movement vehicles only. This retained minute is separate from the reporting-hour total; it is not every crossing or measured air quality.</p>
    </section>
  );
}
