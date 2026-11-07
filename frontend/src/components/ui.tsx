import { Leaf } from "@phosphor-icons/react/dist/ssr";
import type { CameraState, QualityState } from "@emission-lens/contracts";
import { formatNumber, qualityLabel, stateLabel } from "@/lib/format";

/** Three-lamp signal head: green lit for live, amber for degraded, unlit for offline. */
export function SignalHead({
  state,
  large = false,
}: {
  state: CameraState;
  large?: boolean;
}) {
  return (
    <span
      className={large ? "signal signal-lg" : "signal"}
      data-state={state}
      aria-hidden="true"
    >
      <i />
      <i />
      <i />
    </span>
  );
}

export function StateChip({ state }: { state: CameraState }) {
  return <span className={`chip chip-${state}`}>{stateLabel(state)}</span>;
}

export function QualityChip({ state }: { state: QualityState }) {
  return (
    <span className={state === "ok" ? "chip chip-ok" : "chip chip-missing"}>
      {qualityLabel(state)}
    </span>
  );
}

/** Null renders as an outlined "Unavailable" so it can never be read as zero. */
export function Quantity({
  value,
  unit,
  digits = 1,
  unavailable = "Unavailable",
}: {
  value: number | null;
  unit?: string;
  digits?: number;
  unavailable?: string;
}) {
  if (value === null) return <span className="q-null">{unavailable}</span>;
  return (
    <span className="q">
      {formatNumber(value, digits)}
      {unit ? <span className="q-unit">{unit}</span> : null}
    </span>
  );
}

export function Readout({
  label,
  children,
  detail,
  large = false,
}: {
  label: string;
  children: React.ReactNode;
  detail?: React.ReactNode;
  large?: boolean;
}) {
  return (
    <div className={large ? "readout readout-lg" : "readout"}>
      <dt>{label}</dt>
      <dd>
        {children}
        {detail ? <small>{detail}</small> : null}
      </dd>
    </div>
  );
}

export function Panel({
  title,
  meta,
  children,
  flush = false,
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {meta ? <div className="panel-meta">{meta}</div> : null}
      </header>
      {flush ? children : <div className="panel-body">{children}</div>}
    </section>
  );
}

export function LensMark() {
  return (
    <Leaf className="brand-mark" size={26} weight="fill" aria-hidden="true" />
  );
}
