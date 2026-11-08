import { Cloud } from "@phosphor-icons/react/dist/ssr";
import type { CameraState, Mode } from "@emission-lens/contracts";
import type { MapEmissionEstimate } from "@/lib/map-emissions";
import type { measurementSupport } from "@/lib/observation-presentation";
import { formatInstant, modeLabel, PACIFIC, stateLabel } from "@/lib/format";
import { EmissionQuantity, Quantity } from "@/components/ui";

export function SelectedEmissionMetric({ estimate, windowCo2, cameraId, mode, state, support }: {
  estimate: MapEmissionEstimate | null;
  windowCo2: number | null;
  cameraId: string;
  mode: Mode;
  state: CameraState;
  support: ReturnType<typeof measurementSupport>;
}) {
  const value = mode === "synthetic" ? windowCo2 : estimate?.co2_g ?? null;
  return (
    <section className="summary-card summary-card--emissions">
      <div className="summary-label"><span>Estimated CO₂</span><Cloud size={19} /></div>
      <strong>{value === null ? <Quantity value={null} unavailable={support.label} /> : <EmissionQuantity value={value} />}</strong>
      <span className="metric-caption">
        {mode === "synthetic" ? "Labeled synthetic reporting-window estimate" : estimate ? <>
          Latest supported minute · <time dateTime={estimate.minute}>{formatInstant(estimate.minute, PACIFIC)}</time><br />
          Camera {cameraId} · {modeLabel(mode)} · feed {stateLabel(state).toLowerCase()} · completed movement only
        </> : support.detail}
      </span>
      <span className="metric-caption">
        Reporting-hour CO₂: {windowCo2 === null ? "unavailable; required records are unsupported or missing" : <EmissionQuantity value={windowCo2} />}.
      </span>
    </section>
  );
}
