import assert from "node:assert/strict";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { buildBriefPdf } from "../src/lib/brief-pdf.ts";
import { briefSourceHash,sealBriefReport,openBriefReport,buildBriefReport,reportRecommendation,plainBriefSummary,type BriefReport } from "../src/lib/brief-report.ts";
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

test("long drafts stay a concise two-page report while attaching the complete exact source", async () => {
  const long = draft + "\n" + Array.from({ length: 100 }, (_, i) => `Evidence ${i}: ${"abcdef0123456789".repeat(10)} - missing values remain unavailable.`).join("\n");
  const pdf = await buildBriefPdf(long, "emission-lens-brief-223-replay.pdf", new Date("2026-11-08T13:55:00Z"));
  assert.equal((pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,2);
  assert.ok(streams(pdf).some((stream) => stream.equals(Buffer.from(long))));
});

test("PDF route rejects malformed, empty, oversized and injected export names", async () => {
  for (const [text, filename] of [["", "emission-lens-brief-222-live.pdf"], ["a".repeat(64001), "emission-lens-brief-222-live.pdf"], [draft, "../../evidence.json"], [draft, "emission-lens-brief-" + "2".repeat(120) + "-live.pdf"], [draft, "emission-lens-brief-222-live.pdf\r\nX-Test: injected"]]) {
    const response = await POST(request(text, filename)); assert.equal(response.status, 400); assert.equal(response.headers.has("content-disposition"), false);
  }
  assert.equal((await POST(new Request("http://localhost/api/brief/pdf", { method: "POST", body: "invalid" }))).status, 400);
});

function report():BriefReport {
 return {version:1,camera_id:"222",camera_name:"Carson Boulevard",mode:"live",from:"2026-11-08T13:25:00Z",to:"2026-11-08T13:26:00Z",generated_at:"2026-11-08T13:27:00Z",reduction_pct:20,source_sha256:briefSourceHash(draft),crossings:{value:2,complete:false},requested_minutes:1,recorded_minutes:1,supported_minutes:1,supported_co2_g:4.2,completed_vehicles:2,cohort_minutes:1,linked_stopped_s:0,minutes:[{minute:"2026-11-08T13:25:00Z",crossings:2,partial:true,supported:true}],classes:[{label:"car",count:2},{label:"unknown",count:null}],pollutants:[{key:"co2",baseline_g:4.2,scenario_g:4.4,change_g:.2,change_pct:4.7619},{key:"nox",baseline_g:null,scenario_g:null,change_g:null,change_pct:null}],assumptions:{calibration:"test-camera-calibration",mappings:["test-mapping"],meteorology:"70 F / 60% RH",timing:"estimated_hls_media_utc",factor:"CARB EMFAC2025 / RUNEX"},regional:{state:"unavailable",valid_at:null,retrieved_at:null,values:null},evidence_refs:["fixture-only"]};
}
test("signed report snapshot is bound to exact reviewed text, scope and export identity",()=>{const sealed=sealBriefReport(report(),draft);assert.deepEqual(openBriefReport(sealed.payload,sealed.signature,draft,"emission-lens-brief-222-live.pdf"),report());assert.throws(()=>openBriefReport(sealed.payload.replace('4.2','44.2'),sealed.signature,draft,"emission-lens-brief-222-live.pdf"));assert.throws(()=>openBriefReport(sealed.payload,sealed.signature,draft+"changed","emission-lens-brief-222-live.pdf"));assert.throws(()=>openBriefReport(sealed.payload,sealed.signature,draft,"emission-lens-brief-223-live.pdf"));});
test("structured PDF route freezes the reviewed chart snapshot with signed increases and pending values",async()=>{const sealed=sealBriefReport(report(),draft);const form=new FormData();form.set('text',draft);form.set('filename','emission-lens-brief-222-live.pdf');form.set('report',sealed.payload);form.set('signature',sealed.signature);const response=await POST(new Request('http://localhost/api/brief/pdf',{method:'POST',body:form}));assert.equal(response.status,200);const pdf=Buffer.from(await response.arrayBuffer());assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)??[]).length,2);assert.ok(streams(pdf).some(v=>v.equals(Buffer.from(draft))));assert.ok(streams(pdf).some(v=>v.toString().includes('"scenario_g": 4.4')));form.set('text',draft+'tampered');assert.equal((await POST(new Request('http://localhost/api/brief/pdf',{method:'POST',body:form}))).status,400);});

test("plain-language recommendations respond to evidence rather than promising traffic benefits",()=>{
 const base=report();
 const missing={...base,supported_minutes:0};assert.match(reportRecommendation(missing).text,/five-minute sample/);assert.match(reportRecommendation(missing).steps[0],/marked road section/);
 assert.match(reportRecommendation(base).text,/no recorded stopped time/);assert.match(reportRecommendation(base).steps.join(" "),/busy period/);
 const stopped={...base,linked_stopped_s:12};assert.match(reportRecommendation(stopped).text,/higher CO2/);assert.match(reportRecommendation(stopped).steps.join(" "),/do not|before considering/i);
 const lower={...stopped,pollutants:stopped.pollutants.map(p=>p.key==="co2"?{...p,scenario_g:4,change_g:-.2,change_pct:-4.76}:p)};const advice=reportRecommendation(lower);assert.match(advice.steps.join(" "),/red-light waiting|blocked exits/);assert.match(advice.steps.join(" "),/traffic engineer/);assert.doesNotMatch(advice.text,/will reduce|guaranteed|savings achieved/);
 const partial={...lower,requested_minutes:5,supported_minutes:1};assert.match(reportRecommendation(partial).text,/Only 1 of 5 minutes/);
 const demo=plainBriefSummary({...lower,mode:"synthetic"});assert.match(demo,/invented for demonstration/);assert.match(demo,/Location: Carson Boulevard/);assert.match(demo,/Recommended follow-up/);
});
