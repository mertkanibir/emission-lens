import type { CameraStatusView, EmissionsWindow, TrafficWindow } from "@emission-lens/backend";
import type { CameraCalibration, ContextSnapshot, Mode } from "@emission-lens/contracts";
import { formatAge, formatNumber } from "@/lib/format";

export interface CheckLine {
  level: "ok" | "warn" | "info";
  at: string | null;
  source: string;
  text: string;
}

export interface CameraEvidence {
  camera: { id: string };
  status: CameraStatusView;
  traffic: TrafficWindow;
  emissions: EmissionsWindow;
  calibration: CameraCalibration;
  context: ContextSnapshot;
}

/** Every line restates a stored record or its absence. Nothing here is an invented event. */
export function systemChecks(mode: Mode, cards: CameraEvidence[]): CheckLine[] {
  const lines: CheckLine[] = [];
  const total = cards.length;

  for (const { camera, status } of cards) {
    const source = `cam ${camera.id}`;
    const age = formatAge(status.heartbeat_at, status.as_of);
    if (status.heartbeat_at === null) {
      lines.push({ level: "warn", at: null, source, text: "No heartbeat received. Shown offline." });
    } else if (status.displayed_state === "offline") {
      lines.push({
        level: "warn",
        at: status.heartbeat_at,
        source,
        text: "The worker reports no active frame processing. Shown offline.",
      });
    } else if (status.displayed_state === "degraded") {
      lines.push({
        level: "warn",
        at: status.heartbeat_at,
        source,
        text: `Heartbeat is ${age ?? "of unknown age"} old at the data clock. Shown degraded, not live.`,
      });
    } else {
      const fps = status.fps === null ? "inference rate unavailable" : `${formatNumber(status.fps)} frames/s`;
      const delay =
        status.processing_delay_ms === null
          ? "processing delay unavailable"
          : `${formatNumber(status.processing_delay_ms / 1000)} s processing delay`;
      lines.push({
        level: "ok",
        at: status.heartbeat_at,
        source,
        text: `Heartbeat ${age ?? "of unknown age"} before the data clock. ${fps}, ${delay}.`,
      });
    }
  }

  const calibrated = cards.filter((card) => card.calibration.validation_status === "valid").length;
  lines.push({
    level: calibrated === total ? "ok" : "warn",
    at: null,
    source: "calibration",
    text:
      calibrated === total
        ? `All ${total} calibrations are valid.`
        : `${calibrated} of ${total} calibrations are valid. Speeds and distance-based emissions are suppressed where calibration is missing.`,
  });

  const estimated = cards.filter((card) => card.emissions.quality_state === "ok").length;
  lines.push({
    level: estimated === total ? "ok" : "warn",
    at: null,
    source: "emissions",
    text:
      estimated === total
        ? `All ${total} cameras have estimated emissions in this window.`
        : `${estimated} of ${total} cameras have estimated emissions in this window. The rest are unavailable, not zero.`,
  });

  if (cards.every((card) => card.context.values === null)) {
    lines.push({
      level: "info",
      at: null,
      source: "context",
      text: "Weather, school, and community context are not loaded.",
    });
  }

  if (mode === "replay" && cards.every((card) => card.traffic.rows.length === 0)) {
    lines.push({ level: "info", at: null, source: "replay", text: "No replay clip is loaded." });
  }
  if (mode === "synthetic") {
    lines.push({
      level: "info",
      at: null,
      source: "synthetic",
      text: "Synthetic rows are labeled samples and are excluded from live totals.",
    });
  }

  return lines;
}
