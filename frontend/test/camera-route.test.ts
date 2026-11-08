import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GET } from "../src/app/api/cameras/route.ts";

test("an unconfigured live aggregate route does not borrow the synthetic counts or grams", async () => {
  const dir = mkdtempSync(join(tmpdir(), "emission-lens-frontend-route-"));
  const original = process.env.EMISSION_LENS_STORE_PATH;
  process.env.EMISSION_LENS_STORE_PATH = join(dir, "empty-worker-store.json");
  try {
    const response = GET(new Request("http://localhost/api/cameras?mode=live"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const live = await response.json();
    assert.equal(live.mode, "live");
    assert.equal(live.cameras.length, 4);
    for (const item of live.cameras) {
      assert.equal(item.status.displayed_state, "offline");
      assert.equal(item.traffic.totals.count, null);
      assert.equal(item.emissions.estimate_g_by_pollutant.co2, null);
      assert.equal(item.emissions.estimate_g_by_pollutant.nox, null);
    }
    const sample = await GET(new Request("http://localhost/api/cameras?mode=synthetic")).json();
    assert.equal(sample.mode, "synthetic");
    assert.equal(sample.cameras.find((item: { camera: { id: string } }) => item.camera.id === "222").traffic.totals.count, 24);
    const replay = await GET(new Request("http://localhost/api/cameras?mode=replay")).json();
    assert.equal(replay.mode, "replay");
    assert.ok(replay.cameras.every((item: { traffic: { totals: { count: number | null } } }) => item.traffic.totals.count === null));
    assert.doesNotMatch(JSON.stringify(live), /traversal_id|session_id|authorization|Bearer |registry_path/);
  } finally {
    if (original === undefined) delete process.env.EMISSION_LENS_STORE_PATH;
    else process.env.EMISSION_LENS_STORE_PATH = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("an unsupported aggregate mode is rejected rather than silently selecting live", () => {
  assert.equal(GET(new Request("http://localhost/api/cameras?mode=fixture-live")).status, 400);
});
