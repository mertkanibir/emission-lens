import type { MeasurementRegistryStatus, TrafficWindow } from "@emission-lens/backend";
import type { MapEmissionEstimate } from "./map-emissions";

/** A queue is a camera-minute observation, never a sum over classes or an hour. */
export function queueObservation(traffic: Pick<TrafficWindow, "camera_id" | "mode" | "from" | "to" | "rows" | "queue_count" | "queue_observation">) {
  const reported = traffic.queue_observation;
  if (reported) return {
    value: reported.state === "observed" && traffic.queue_count !== null
      && Number.isFinite(traffic.queue_count) && Number.isInteger(traffic.queue_count) && traffic.queue_count >= 0
      ? traffic.queue_count : null,
    minute: reported.minute,
    label: reported.state === "ambiguous" ? "Conflicting observations" : reported.state === "observed" ? "Recorded observation" : "No queue observation",
    detail: reported.reason,
  };
  const from = Date.parse(traffic.from);
  const to = Date.parse(traffic.to);
  const rows = traffic.rows.filter((row) => {
    const instant = Date.parse(row.minute);
    return row.camera_id === traffic.camera_id && row.mode === traffic.mode
      && Number.isFinite(instant) && instant >= from && instant < to;
  });
  const latest = rows.length > 0 ? Math.max(...rows.map((row) => Date.parse(row.minute))) : null;
  const observations = rows.filter((row) => Date.parse(row.minute) === latest && row.queue_count !== null);
  if (observations.length === 0) return {
    value: null, minute: latest === null ? null : new Date(latest).toISOString(), label: "No queue observation",
    detail: "The latest traffic minute has no queue observation. Older observations are not substituted; queue configuration status is not reported.",
  };
  const value = observations[0].queue_count;
  if (observations.length !== 1 || value === null || !Number.isInteger(value) || value < 0) return {
    value: null, minute: new Date(latest!).toISOString(), label: "Conflicting observations",
    detail: "The latest traffic minute has no unique supported queue count across class rows.",
  };
  return {
    value, minute: new Date(latest!).toISOString(), label: "Recorded observation",
    detail: "Latest recorded image-based queue count; it is not queue length or a reporting-hour total.",
  };
}

/** Registry authority and retained estimates are separate from feed freshness and count review. */
export function measurementSupport(registry: MeasurementRegistryStatus, estimate: MapEmissionEstimate | null) {
  if (estimate !== null) return {
    label: "Supported minute retained",
    detail: "Completed-movement estimate available. Feed freshness is reported separately; the minute does not cover the whole intersection or hour.",
  };
  if (registry.state === "invalid") return {
    label: "Measurement registry invalid",
    detail: "Approved calibration and mapping cannot be verified. Physical estimates stay unavailable.",
  };
  if (registry.state === "configured" && registry.physical_calibration_approved) return {
    label: "No supported minute",
    detail: "Calibration is registered for this mode, but this window has no matching supported completed-movement estimate.",
  };
  return {
    label: "Awaiting approved inputs",
    detail: "No approved measurement profile is available for this camera and mode. A fresh preview does not establish count accuracy or support physical estimates.",
  };
}
