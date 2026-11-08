import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../src/app/api/brief/route.ts";

function request(text: string, filename = "emission-lens-brief-222-synthetic.txt") {
  const form = new FormData();
  form.set("text", text);
  form.set("filename", filename);
  return new Request("http://localhost/api/brief", { method: "POST", body: form });
}

test("local export preserves reviewed pollutant values, signed changes, modes and evidence exactly", async () => {
  const draft = [
    "Investigation brief",
    "Mode: synthetic sample. Not live or a field measurement.",
    "CO₂ baseline: 100 g; scenario: 120 g; change: +20 g (+20%).",
    "NOₓ baseline: 0 g; scenario: 0 g; change: 0 g; percent unavailable.",
    "Assumptions: original completed cohort; fixed distances; explicit test meteorology.",
    "Evidence: synthetic-fixture-only. No real calibration approved.",
  ].join("\r\n");
  const response = await POST(request(draft));
  assert.equal(response.status, 200);
  assert.equal(await response.text(), draft.replaceAll("\r\n", "\n"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="emission-lens-brief-222-synthetic.txt"');
});

test("invalid export names and empty or oversized drafts cannot become attachments", async () => {
  for (const [text, filename] of [
    ["draft", "../../evidence.json"],
    ["draft", "emission-lens-brief-222-live.txt\r\nX-Extra: value"],
    ["", "emission-lens-brief-222-live.txt"],
    ["a".repeat(64001), "emission-lens-brief-222-live.txt"],
  ]) {
    const response = await POST(request(text, filename));
    assert.equal(response.status, 400);
    assert.equal(response.headers.has("content-disposition"), false);
  }
});
