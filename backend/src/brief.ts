import { cameraById, type Mode } from "@emission-lens/contracts";
import {
  get_camera_status,
  get_context,
  get_emissions_window,
  get_traffic_window,
  type TrafficWindow,
} from "./queries.ts";
import { compare_scenario } from "./scenario.ts";
import { loadRegistry, registryStatus } from "./registry.ts";

export interface Brief {
  camera_id: string | null;
  mode: Mode;
  evidence_references: string[];
  text: string;
  model: null;
  review_status: "draft";
}

export interface PriorityDimension {
  dimension: "queues" | "emissions" | "uncertainty" | "context";
  evidence: string;
  suggested_step: string;
}

export interface InvestigationRanking {
  mode: Mode;
  camera_id: string | null;
  dimensions: PriorityDimension[];
  score: null;
}

export const ASSISTANT_TOOLS = [
  "get_camera_status",
  "get_traffic_window",
  "get_emissions_window",
  "get_context",
  "compare_scenario",
  "rank_investigation_priorities",
  "draft_brief",
] as const;

function queueEvidence(traffic: TrafficWindow): string {
  const minute = traffic.queue_observation?.minute;
  const when = minute === null || minute === undefined
    ? "with observation minute unavailable"
    : `for ${minute} (UTC)`;
  const length = `Queue length in metres: ${traffic.queue_length_m === null ? "unavailable" : traffic.queue_length_m}.`;
  if (traffic.queue_count === null) return `Queue observation unavailable ${when}. ${traffic.queue_observation?.reason ?? "No supported latest-minute observation is available."} ${length}`;
  if (traffic.queue_count > 0) return `At least ${traffic.queue_count} visible stopped vehicles in the latest image observation ${when}. Provisional image-area/motion observation: a visible stationary lower bound, not a physical queue total or reporting-hour total. Engine state is unavailable. ${length}`;
  return `Observed 0 visible stopped vehicles in the supported latest image observation ${when}. This scoped zero is not a physical queue total or reporting-hour total. Engine state is unavailable. ${length}`;
}

export function rank_investigation_priorities(input: {
  cameraId: string | null;
  mode: Mode;
  now?: Date;
}): InvestigationRanking {
  const cameraId = input.cameraId;
  if (cameraId === null) {
    return {
      mode: input.mode,
      camera_id: null,
      score: null,
      dimensions: [
        {
          dimension: "uncertainty",
          evidence: "No camera was selected.",
          suggested_step:
            "Choose one intersection before ranking investigation priorities.",
        },
      ],
    };
  }
  const now = input.now ?? new Date();
  const traffic = get_traffic_window({
    cameraId,
    mode: input.mode,
    now,
  });
  const emissions = get_emissions_window({
    cameraId,
    mode: input.mode,
    now,
  });
  const registry = registryStatus(loadRegistry(), cameraId, input.mode, now);
  const emptyApprovedWindow = emissions.rows.length === 0 &&
    registry.state === "configured" && registry.physical_calibration_approved &&
    registry.calibration_version !== null;
  const context = get_context(cameraId, input.mode);
  return {
    mode: input.mode,
    camera_id: cameraId,
    score: null,
    dimensions: [
      {
        dimension: "queues",
        evidence: queueEvidence(traffic),
        suggested_step:
          traffic.queue_count === null
            ? emptyApprovedWindow
              ? "Collect queue observations in this reporting window before investigating signal timing."
              : "Collect a calibrated observation window before investigating signal timing."
            : "Investigate signal timing and queue causes. This sample does not prove a signal change.",
      },
      {
        dimension: "emissions",
        evidence: emissions.note,
        suggested_step:
          emptyApprovedWindow
            ? "Collect completed traversals in this reporting window and confirm the visual-class mapping before comparing estimated emissions."
            : "Validate camera calibration and visual-class mappings, then collect completed traversals before comparing estimated emissions.",
      },
      {
        dimension: "uncertainty",
        evidence: traffic.note,
        suggested_step:
          "Keep training and evaluation footage separate, and do not fill gaps with a percentage.",
      },
      {
        dimension: "context",
        evidence:
          context.values === null
            ? "Weather, school, and community context are not loaded for this window."
            : "Context values are attached.",
        suggested_step:
          "Add a context layer only when its timestamp and geography can be shown.",
      },
    ],
  };
}

export function draft_brief(input: {
  cameraId: string;
  mode: Mode;
  stoppedTimeReductionPct?: number;
  now?: Date;
}): Brief {
  const now = input.now ?? new Date();
  const camera = cameraById(input.cameraId);
  const status = get_camera_status(input.cameraId, input.mode, now);
  const traffic = get_traffic_window({
    cameraId: input.cameraId,
    mode: input.mode,
    now,
  });
  const emissions = get_emissions_window({
    cameraId: input.cameraId,
    mode: input.mode,
    now,
  });
  const scenario = compare_scenario({
    cameraId: input.cameraId,
    mode: input.mode,
    stoppedTimeReductionPct: input.stoppedTimeReductionPct ?? 20,
    now,
  });
  const ranking = rank_investigation_priorities({
    cameraId: input.cameraId,
    mode: input.mode,
    now,
  });
  const modeLine =
    input.mode === "live"
      ? "Mode: live. Live totals exclude replay and synthetic samples."
      : input.mode === "replay"
        ? "Mode: replay. Replay observations are labeled and kept separate from live totals."
        : "Mode: synthetic sample. This is not a live total and not a field measurement.";
  const lines = [
    "Investigation brief",
    `Camera: ${camera?.name ?? "Unknown camera"} (${input.cameraId}).`,
    modeLine,
    `Status: ${status.displayed_state}. A camera is not treated as live from a leftover frame.`,
    `Window: ${traffic.from} to ${traffic.to} (UTC).`,
    `Crossings: ${traffic.totals.count === null ? "unavailable" : traffic.totals.count}.`,
    `Stopped time: ${traffic.totals.stopped_vehicle_seconds === null ? "unavailable for the full mix" : `${traffic.totals.stopped_vehicle_seconds} vehicle-seconds`}.`,
    queueEvidence(traffic),
    `${emissions.note} These are modeled estimates when present, not a measured concentration and not an air-quality index.`,
    `Shorter-stop scenario at ${scenario.assumptions.stopped_time_reduction_pct}%: ${scenario.limitations[0]}`,
    ...(["co2", "nox"] as const).map((pollutant) => {
      const value = scenario.pollutants[pollutant];
      const label = pollutant === "co2" ? "CO2" : "NOx";
      if (value.baseline_g === null)
        return `Estimated ${label}: unavailable; this is not zero.`;
      if (value.scenario_g === null || value.change_g === null)
        return `Estimated ${label} baseline: ${value.baseline_g.toFixed(6)} g. Scenario unavailable because required evidence is missing.`;
      return `Estimated ${label}: baseline ${value.baseline_g.toFixed(6)} g; hypothetical scenario ${value.scenario_g.toFixed(6)} g; signed change ${value.change_g.toFixed(6)} g (${value.change_pct === null ? "percentage unavailable" : `${value.change_pct.toFixed(3)}%`}).`;
    }),
    ...(scenario.evidence_refs.length
      ? [
          `Calculation evidence: ${scenario.evidence_refs.join(", ")}.`,
          "Comparison uses the same completed vehicles and each vehicle's linked stopped component. Counts and all-observed stopped seconds describe independent observations.",
        ]
      : []),
    ...scenario.calculation_assumptions,
    `Suggested next step: ${ranking.dimensions.map((item) => item.suggested_step).join(" ")}`,
    "This draft can be reviewed and exported. It is not sent anywhere.",
  ];
  return {
    camera_id: input.cameraId,
    mode: input.mode,
    evidence_references: [
      `camera:${input.cameraId}`,
      `traffic:${input.mode}:${traffic.from}`,
      `emissions:${emissions.quality_state}`,
      ...scenario.evidence_refs,
    ],
    text: lines.join("\n"),
    model: null,
    review_status: "draft",
  };
}
