import { cameraById, type Mode } from "@emission-lens/contracts";
import { get_camera_status, get_context, get_emissions_window, get_traffic_window } from "./queries.ts";
import { compare_scenario } from "./scenario.ts";

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
          suggested_step: "Choose one intersection before ranking investigation priorities.",
        },
      ],
    };
  }
  const traffic = get_traffic_window({ cameraId, mode: input.mode, now: input.now });
  const emissions = get_emissions_window({ cameraId, mode: input.mode, now: input.now });
  const context = get_context(cameraId, input.mode);
  const queueEvidence =
    traffic.queue_count === null
      ? "No queue count in this window."
      : `Image-based queue count is ${traffic.queue_count}. Queue length in metres is ${traffic.queue_length_m === null ? "unavailable" : traffic.queue_length_m}.`;
  return {
    mode: input.mode,
    camera_id: cameraId,
    score: null,
    dimensions: [
      {
        dimension: "queues",
        evidence: queueEvidence,
        suggested_step:
          traffic.queue_count === null
            ? "Collect a calibrated observation window before investigating signal timing."
            : "Investigate signal timing and queue causes. This sample does not prove a signal change.",
      },
      {
        dimension: "emissions",
        evidence: emissions.note,
        suggested_step: "Validate camera calibration and visual-class mappings, then collect completed traversals before comparing estimated emissions.",
      },
      {
        dimension: "uncertainty",
        evidence: traffic.note,
        suggested_step: "Keep training and evaluation footage separate, and do not fill gaps with a percentage.",
      },
      {
        dimension: "context",
        evidence:
          context.values === null
            ? "Weather, school, and community context are not loaded for this window."
            : "Context values are attached.",
        suggested_step: "Add a context layer only when its timestamp and geography can be shown.",
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
  const camera = cameraById(input.cameraId);
  const status = get_camera_status(input.cameraId, input.mode, input.now);
  const traffic = get_traffic_window({ cameraId: input.cameraId, mode: input.mode, now: input.now });
  const emissions = get_emissions_window({ cameraId: input.cameraId, mode: input.mode, now: input.now });
  const scenario = compare_scenario({
    cameraId: input.cameraId,
    mode: input.mode,
    stoppedTimeReductionPct: input.stoppedTimeReductionPct ?? 20,
    now: input.now,
  });
  const ranking = rank_investigation_priorities({
    cameraId: input.cameraId,
    mode: input.mode,
    now: input.now,
  });
  const modeLine =
    input.mode === "live"
      ? "Mode: live. Live totals exclude replay and synthetic samples."
      : input.mode === "replay"
        ? "Mode: replay. Replay is labeled and is not mixed into live totals. No replay clip is loaded."
        : "Mode: synthetic sample. This is not a live total and not a field measurement.";
  const lines = [
    "Investigation brief",
    `Camera: ${camera?.name ?? "Unknown camera"} (${input.cameraId}).`,
    modeLine,
    `Status: ${status.displayed_state}. A camera is not treated as live from a leftover frame.`,
    `Window: ${traffic.from} to ${traffic.to} (UTC).`,
    `Crossings: ${traffic.totals.count === null ? "unavailable" : traffic.totals.count}.`,
    `Stopped time: ${traffic.totals.stopped_vehicle_seconds === null ? "unavailable for the full mix" : `${traffic.totals.stopped_vehicle_seconds} vehicle-seconds`}.`,
    `Queue count: ${traffic.queue_count === null ? "unavailable" : traffic.queue_count}. Queue length in metres: ${traffic.queue_length_m === null ? "unavailable" : traffic.queue_length_m}.`,
    `${emissions.note} These are modeled estimates when present, not a measured concentration and not an air-quality index.`,
    `Shorter-stop scenario at ${scenario.assumptions.stopped_time_reduction_pct}%: estimated emissions remain unavailable. ${scenario.limitations[0]}`,
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
    ],
    text: lines.join("\n"),
    model: null,
    review_status: "draft",
  };
}
