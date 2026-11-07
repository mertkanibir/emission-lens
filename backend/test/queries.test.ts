import assert from "node:assert/strict";
import test from "node:test";
import { validateEmissionsMinute, type EmissionsMinute } from "@emission-lens/contracts";
import {
  ASSISTANT_TOOLS,
  compare_scenario,
  draft_brief,
  get_camera_status,
  get_emissions_window,
  get_traffic_window,
  rank_investigation_priorities,
} from "../src/index.ts";

test("live emissions stay unavailable instead of zero", () => {
  const result = get_emissions_window({ cameraId: "222", mode: "live" });
  assert.equal(result.estimate_g_by_pollutant.co2, null);
  assert.equal(result.estimate_g_by_pollutant.nox, null);
  assert.equal(result.quality_state, "unavailable");
  assert.equal(result.rows.length, 0);
});

test("live totals exclude the synthetic sample", () => {
  const live = get_traffic_window({ cameraId: "222", mode: "live" });
  const synthetic = get_traffic_window({ cameraId: "222", mode: "synthetic" });
  assert.equal(live.totals.count, null);
  assert.equal(synthetic.totals.count, 24);
  assert.equal(live.rows.length, 0);
});

test("replay does not reuse synthetic traffic", () => {
  const replay = get_traffic_window({ cameraId: "222", mode: "replay" });
  assert.equal(replay.rows.length, 0);
  assert.equal(replay.totals.count, null);
  assert.match(replay.note, /not mixed into live totals/i);
});

test("incomplete stopped time keeps the mix total null", () => {
  const synthetic = get_traffic_window({ cameraId: "222", mode: "synthetic" });
  assert.equal(synthetic.totals.stopped_vehicle_seconds, null);
  assert.equal(synthetic.queue_count, 5);
  assert.equal(synthetic.queue_length_m, null);
  const car = synthetic.rows.find((row) => row.vehicle_class === "car");
  assert.equal(car?.stopped_vehicle_seconds, 420);
});

test("an empty live scenario does not become zero", () => {
  const scenario = compare_scenario({
    cameraId: "222",
    mode: "live",
    stoppedTimeReductionPct: 20,
  });
  assert.equal(scenario.baseline.count, null);
  assert.equal(scenario.scenario.stopped_vehicle_seconds, null);
  assert.equal(scenario.scenario.estimate_g, null);
});

test("shorter-stop scenario does not invent grams or speed", () => {
  const scenario = compare_scenario({
    cameraId: "222",
    mode: "synthetic",
    stoppedTimeReductionPct: 20,
  });
  const car = scenario.classes.find((row) => row.vehicle_class === "car");
  assert.equal(car?.baseline_stopped_vehicle_seconds, 420);
  assert.equal(car?.scenario_stopped_vehicle_seconds, 336);
  assert.equal(scenario.baseline.average_speed_m_s, null);
  assert.equal(scenario.scenario.average_speed_m_s, null);
  assert.equal(scenario.scenario.estimate_g, null);
  assert.equal(scenario.baseline.stopped_vehicle_seconds, null);
});

test("electric fleet share is not applied without a factor", () => {
  const scenario = compare_scenario({
    cameraId: "222",
    mode: "synthetic",
    stoppedTimeReductionPct: 0,
    electricFleetShare: 0.2,
  });
  assert.equal(scenario.scenario.estimate_g, null);
  assert.ok(scenario.limitations.some((line) => /fleet-average factor/i.test(line)));
});

test("stopped-time reduction outside 0 to 100 is rejected", () => {
  assert.throws(() =>
    compare_scenario({ cameraId: "222", mode: "synthetic", stoppedTimeReductionPct: 140 }),
  );
});

test("a stale stored live state is shown as degraded", () => {
  const status = get_camera_status("223", "synthetic");
  assert.equal(status.state, "live");
  assert.equal(status.displayed_state, "degraded");
});

test("missing heartbeat is offline even if a frame could still be on screen", () => {
  const status = get_camera_status("222", "live");
  assert.equal(status.displayed_state, "offline");
  assert.equal(status.heartbeat_at, null);
});

test("validator rejects a zero estimate marked unavailable", () => {
  const row: EmissionsMinute = {
    camera_id: "222",
    minute: "2026-11-07T20:00:00.000Z",
    pollutant: "co2",
    mode: "synthetic",
    estimate_g: 0,
    range_low_g: null,
    range_high_g: null,
    factor_version: null,
    method_version: null,
    quality_state: "unavailable",
  };
  assert.throws(() => validateEmissionsMinute(row));
});

test("brief traces numbers to records and does not claim air quality", () => {
  const brief = draft_brief({ cameraId: "222", mode: "live" });
  assert.match(brief.text, /estimated emissions/i);
  assert.match(brief.text, /unavailable/i);
  assert.match(brief.text, /not sent anywhere/i);
  assert.doesNotMatch(brief.text, /AQI/i);
  assert.equal(brief.model, null);
  assert.equal(brief.review_status, "draft");
});

test("ranking does not collapse evidence into a score", () => {
  const ranking = rank_investigation_priorities({ cameraId: "222", mode: "live" });
  assert.equal(ranking.score, null);
  assert.ok(ranking.dimensions.length >= 3);
});

test("assistant tools do not include a send action", () => {
  assert.deepEqual(ASSISTANT_TOOLS, [
    "get_camera_status",
    "get_traffic_window",
    "get_emissions_window",
    "get_context",
    "compare_scenario",
    "rank_investigation_priorities",
    "draft_brief",
  ]);
});
