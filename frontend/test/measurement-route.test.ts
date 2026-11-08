import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { compare_scenario, draft_brief, get_emissions_window, get_traffic_window } from "@emission-lens/backend";
import { GET as getMeasurement, POST as postMeasurement } from "../src/app/api/measurements/route.ts";
import { GET as getEvidence } from "../src/app/api/measurements/evidence/route.ts";
import { POST as refreshMeasurements } from "../src/app/api/measurements/refresh/route.ts";
import { POST as exportBrief } from "../src/app/api/brief/route.ts";
import { controlledMeasurement, controlledRegistry } from "./fixtures/measurement.ts";

/** Entire test uses a private temporary store and synthetic-only approval records. */
test("thin routes connect accepted synthetic measurements to authoritative reads, scenarios and exact local briefs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "emission-lens-frontend-measurement-"));
  const envKeys = ["EMISSION_LENS_STORE_PATH", "EMISSION_LENS_REGISTRY_PATH", "EMISSION_LENS_WORKER_TOKEN"] as const;
  const previous = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const token = randomBytes(32).toString("hex");
  const storePath = join(dir, "measurements.json");
  const registryPath = join(dir, "synthetic-only-registry.json");
  process.env.EMISSION_LENS_STORE_PATH = storePath;
  process.env.EMISSION_LENS_REGISTRY_PATH = registryPath;
  process.env.EMISSION_LENS_WORKER_TOKEN = token;
  const registry = controlledRegistry();
  const payload = controlledMeasurement();
  const post = (path: string, value: unknown, authorized = true) => new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorized ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(value),
  });
  const read = (mode = "synthetic") => getMeasurement(new Request(`http://localhost/api/measurements?camera=222&mode=${mode}&reduce=50`));
  try {
    writeFileSync(registryPath, JSON.stringify(registry), { mode: 0o600 });
    assert.equal((await postMeasurement(post("/api/measurements", payload, false))).status, 401);
    assert.equal(existsSync(storePath), false);
    const suppliedDistance = { ...payload, traversals: [{ ...payload.traversals[0], distance_m: 10 }] };
    assert.equal((await postMeasurement(post("/api/measurements", suppliedDistance))).status, 400);
    assert.equal(existsSync(storePath), false);
    assert.equal((await postMeasurement(post("/api/measurements", payload))).status, 202);
    assert.equal((await postMeasurement(post("/api/measurements", payload))).status, 200);
    const bad = { ...payload, observations: [{ ...payload.observations[0], count: 2 }] };
    assert.equal((await postMeasurement(post("/api/measurements", bad))).status, 409);

    const response = await read();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const model = await response.json();
    assert.equal(model.mode, "synthetic");
    assert.equal(model.minutes.length, 1);
    assert.equal(model.minutes[0].state, "ready");
    assert.equal(model.registry.physical_calibration_approved, true);
    assert.equal(model.scenario.completed_cohort.count, 1);
    assert.equal(model.scenario.completed_cohort.baseline.stopped_time_s, 180);
    assert.equal(model.scenario.completed_cohort.scenario.stopped_time_s, 90);
    assert.deepEqual(model.minutes[0].meteorology, payload.meteorology);
    const assumptions = model.scenario.assumptions.join(" ");
    assert.match(assumptions, /70/, "Exact retained temperature is required in public assumptions.");
    assert.match(assumptions, /60/, "Exact retained relative humidity is required in public assumptions.");
    assert.match(assumptions, /temperature|°F|fahrenheit/i);
    assert.match(assumptions, /humidity|RH/i);
    assert.doesNotMatch(JSON.stringify(model), /synthetic-private-session|synthetic-private-traversal|"session_id"|"traversal_id"|registry_path/);

    const traffic = get_traffic_window({ cameraId: "222", mode: "synthetic" });
    const emissions = get_emissions_window({ cameraId: "222", mode: "synthetic" });
    const comparison = compare_scenario({ cameraId: "222", mode: "synthetic", stoppedTimeReductionPct: 50 });
    assert.equal(traffic.totals.completed_traversals, 1);
    for (const pollutant of ["co2", "nox"] as const) {
      const item = model.scenario.pollutants[pollutant];
      assert.equal(typeof item.baseline_g, "number");
      assert.equal(typeof item.scenario_g, "number");
      assert.equal(emissions.estimate_g_by_pollutant[pollutant], item.baseline_g);
      assert.deepEqual(comparison.pollutants[pollutant], item);
      assert.equal(item.change_g, item.scenario_g - item.baseline_g);
    }
    const brief = draft_brief({ cameraId: "222", mode: "synthetic", stoppedTimeReductionPct: 50 });
    assert.match(brief.text, /synthetic/i);
    assert.match(brief.text, /CO₂|CO2/);
    assert.match(brief.text, /NOₓ|NOx/);
    const briefAssumptions = brief.text.split("\n").filter((line) => /assumptions for/.test(line)).join(" ");
    assert.match(briefAssumptions, /70/, "The exported brief must retain the applied temperature assumption.");
    assert.match(brief.text, /humidity|RH/i, "The exported brief must retain the humidity assumption.");
    const form = new FormData();
    form.set("text", brief.text);
    form.set("filename", "emission-lens-brief-222-synthetic.txt");
    const attachment = await exportBrief(new Request("http://localhost/api/brief", { method: "POST", body: form }));
    assert.equal(await attachment.text(), brief.text.replaceAll("\r\n", "\n"));

    // The exact end minute belongs to the next reporting window, on every read path.
    const endBoundary = controlledMeasurement();
    endBoundary.batch_id = "00000000-0000-4000-8000-000000000225";
    endBoundary.run = { ...endBoundary.run, run_id: "synthetic-end-boundary-only", started_at: "2026-11-07T19:59:30Z", ended_at: null };
    endBoundary.minute = "2026-11-07T20:05:00Z";
    endBoundary.timing.sessions[0].anchor_utc = "2026-11-07T19:59:30Z";
    endBoundary.traversals[0].completed_at = "2026-11-07T20:05:30Z";
    assert.equal((await postMeasurement(post("/api/measurements", endBoundary))).status, 202);
    assert.equal((await (await read()).json()).minutes.length, 1);
    assert.equal(get_traffic_window({ cameraId: "222", mode: "synthetic" }).totals.count, 1);

    const ref = model.evidence_refs[0];
    assert.match(ref, /^[a-f0-9]{64}$/);
    assert.equal((await getEvidence(new Request(`http://localhost/api/measurements/evidence?reference=${ref}`))).status, 401);
    const evidence = await getEvidence(new Request(`http://localhost/api/measurements/evidence?reference=${ref}`, { headers: { authorization: `Bearer ${token}` } }));
    assert.equal(evidence.status, 200);
    assert.doesNotMatch(await evidence.text(), /synthetic-private-session|synthetic-private-traversal/);
    for (const mode of ["live", "replay"]) {
      const separated = await (await read(mode)).json();
      assert.equal(separated.minutes.length, 0);
      assert.equal(separated.registry.physical_calibration_approved, false);
      assert.equal(separated.scenario.pollutants.co2.baseline_g, null);
      assert.equal(separated.scenario.pollutants.nox.scenario_g, null);
    }

    // Different minute assumptions stay distinct; the UI must not invent one window weather value.
    const mixed = controlledMeasurement();
    mixed.batch_id = "00000000-0000-4000-8000-000000000224";
    mixed.run = { ...mixed.run, run_id: "synthetic-mixed-weather-only", started_at: "2026-11-07T19:57:30Z", ended_at: "2026-11-07T20:03:45Z" };
    mixed.minute = "2026-11-07T20:03:00Z";
    mixed.timing.sessions[0].anchor_utc = "2026-11-07T19:57:30Z";
    mixed.traversals[0].completed_at = "2026-11-07T20:03:30Z";
    mixed.meteorology.temperature_f = 80;
    assert.equal((await postMeasurement(post("/api/measurements", mixed))).status, 202);
    const mixedView = await (await read()).json();
    assert.equal(mixedView.minutes.length, 2);
    assert.deepEqual(mixedView.minutes.map((minute: { meteorology: { temperature_f: number } }) => minute.meteorology.temperature_f), [80, 70]);
    assert.match(mixedView.scenario.assumptions.join(" "), /temperature 80 °F/);
    assert.match(mixedView.scenario.assumptions.join(" "), /temperature 70 °F/);
    const mixedBrief = draft_brief({ cameraId: "222", mode: "synthetic", stoppedTimeReductionPct: 50 });
    assert.match(mixedBrief.text, /temperature 80 °F/);
    assert.match(mixedBrief.text, /temperature 70 °F/);

    // Revocation takes effect on reads; it does not destroy independent counts.
    registry.calibrations[0].approval.status = "pending";
    writeFileSync(registryPath, JSON.stringify(registry), { mode: 0o600 });
    const revoked = await (await read()).json();
    assert.equal(revoked.scenario.pollutants.co2.baseline_g, null);
    assert.equal(revoked.registry.physical_calibration_approved, false);
    assert.equal(get_traffic_window({ cameraId: "222", mode: "synthetic" }).totals.count, 2);
    assert.equal((await refreshMeasurements(post("/api/measurements/refresh", {}, false))).status, 401);
    const refresh = await refreshMeasurements(post("/api/measurements/refresh", {}));
    assert.ok([200, 202].includes(refresh.status));
    assert.equal((await (await read()).json()).scenario.pollutants.nox.baseline_g, null);
  } finally {
    for (const key of envKeys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    rmSync(dir, { recursive: true, force: true });
  }
});
