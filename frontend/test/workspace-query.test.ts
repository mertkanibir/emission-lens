import assert from "node:assert/strict";
import test from "node:test";
import { workspaceQuery } from "../src/lib/workspace-query.ts";

test("a native retained-minute choice preserves mode/camera and explicit paired boundaries", () => {
  const from = "2026-11-08T07:18:00Z", to = "2026-11-08T07:19:00Z";
  const query = { camera: "223", mode: "live", reduce: "20", window: `${from}|${to}` };
  assert.deepEqual(workspaceQuery(query), { ...query, from, to });
  assert.equal("from" in query, false);
});
test("returning to the reporting hour clears old explicit bounds and malformed choices stay visibly invalid", () => {
  assert.deepEqual(workspaceQuery({ camera: "222", window: "", from: "old", to: "old" }), { camera: "222", window: "" });
  assert.deepEqual(workspaceQuery({ window: "invalid" }), { window: "invalid", from: "invalid", to: "invalid" });
  const direct = { from: "2026-11-08T07:18:00Z", to: "2026-11-08T07:19:00Z" };
  assert.equal(workspaceQuery(direct), direct);
});
