import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { buildBriefPdf } from "../src/lib/brief-pdf.ts";
import { POST } from "../src/app/api/brief/pdf/route.ts";

function streams(pdf: Buffer) {
  return [...pdf.toString("latin1").matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((match) => {
    const value = Buffer.from(match[1], "latin1");
    try { return inflateSync(value); } catch { return value; }
  });
}
function request(text: string, filename = "emission-lens-brief-222-live.pdf") {
  const form = new FormData(); form.set("text", text); form.set("filename", filename);
  return new Request("http://localhost/api/brief/pdf", { method: "POST", body: form });
}
const draft = ["Investigation brief", "Camera: SR-107 at Carson Boulevard (222).", "Mode: live. Replay remains separate.", "Window: 2026-11-08T13:25:00Z to 2026-11-08T13:26:00Z (UTC, end exclusive).", "Crossings in selected interval: 2.", "Estimated CO₂: baseline 4.2 g; hypothetical scenario 4.4 g; signed change +0.2 g.", "Estimated NOₓ: unavailable; this is not zero.", "Evidence: " + "f".repeat(64), "Review: Mert - preserve ≥2 visible vehicles, °C, → and a Unicode note 🌱."].join("\n");

test("PDF export preserves exact reviewed UTF-8 content as an attachment, including signed increases and missing evidence", async () => {
  const response = await POST(request(draft));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("content-disposition"), 'attachment; filename="emission-lens-brief-222-live.pdf"');
  const pdf = Buffer.from(await response.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(streams(pdf).some((stream) => stream.equals(Buffer.from(draft, "utf8"))));
  assert.ok(pdf.toString("latin1").includes(createHash("sha256").update(draft).digest("hex")));
  assert.ok(pdf.toString("latin1").includes("/EmbeddedFile"));
});

test("long drafts paginate without truncating the exact source or long evidence references", async () => {
  const long = draft + "\n" + Array.from({ length: 100 }, (_, i) => `Evidence ${i}: ${"abcdef0123456789".repeat(10)} - missing values remain unavailable.`).join("\n");
  const pdf = await buildBriefPdf(long, "emission-lens-brief-223-replay.pdf", new Date("2026-11-08T13:55:00Z"));
  assert.ok((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length > 2);
  assert.ok(streams(pdf).some((stream) => stream.equals(Buffer.from(long))));
});

test("PDF route rejects malformed, empty, oversized and injected export names", async () => {
  for (const [text, filename] of [["", "emission-lens-brief-222-live.pdf"], ["a".repeat(64001), "emission-lens-brief-222-live.pdf"], [draft, "../../evidence.json"], [draft, "emission-lens-brief-" + "2".repeat(120) + "-live.pdf"], [draft, "emission-lens-brief-222-live.pdf\r\nX-Test: injected"]]) {
    const response = await POST(request(text, filename)); assert.equal(response.status, 400); assert.equal(response.headers.has("content-disposition"), false);
  }
  assert.equal((await POST(new Request("http://localhost/api/brief/pdf", { method: "POST", body: "invalid" }))).status, 400);
});
