import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cameraById, type Mode } from "@emission-lens/contracts";
import type { MeasurementWindowView } from "@emission-lens/backend";
import type { RegionalAirQuality } from "./regional-air-quality";
import { evidenceAnalytics } from "./evidence-analytics";
import type { TrafficMinute } from "@emission-lens/contracts";

export interface BriefReport {
  version: 1; camera_id: string; camera_name: string; mode: Mode;
  from: string; to: string; generated_at: string; reduction_pct: number;
  source_sha256: string;
  crossings: { value: number | null; complete: boolean };
  requested_minutes: number; recorded_minutes: number; supported_minutes: number;
  supported_co2_g: number | null; completed_vehicles: number | null; cohort_minutes:number;
  linked_stopped_s: number | null;
  minutes: Array<{ minute: string; crossings: number | null; partial: boolean; supported: boolean }>;
  classes: Array<{ label: string; count: number | null }>;
  pollutants: Array<{ key: "co2" | "nox"; baseline_g: number | null; scenario_g: number | null; change_g: number | null; change_pct: number | null }>;
  assumptions: { calibration: string; mappings: string[]; meteorology: string; timing: string; factor: string };
  regional: { state: string; valid_at: string | null; retrieved_at: string | null; values: { pm2_5: number | null; nitrogen_dioxide: number | null; ozone: number | null } | null };
  evidence_refs: string[];
}
const nonnegative=(v:unknown):v is number=>typeof v==="number"&&Number.isFinite(v)&&v>=0;
const sumKnown=(values:readonly (number|null)[])=>{const n=values.filter(nonnegative);return n.length?n.reduce((a,b)=>a+b,0):null;};
export const briefSourceHash=(text:string)=>createHash("sha256").update(text.replaceAll("\r\n","\n"),"utf8").digest("hex");

/** Capture the displayed interval once; PDF downloads never query changing live records. */
export function buildBriefReport(input:{measurement:MeasurementWindowView;traffic:readonly TrafficMinute[];text:string;air:RegionalAirQuality;reductionPct:number;now?:Date}):BriefReport {
 const {measurement:m,traffic,text,air}=input,a=evidenceAnalytics(m,traffic);
 const selected=a.eligible?traffic.filter(r=>r.camera_id===m.camera_id&&r.mode===m.mode&&Date.parse(r.minute)>=Date.parse(m.from)&&Date.parse(r.minute)<Date.parse(m.to)):[];
 const minutes=a.slots.map(slot=>{const rows=selected.filter(r=>Date.parse(r.minute)===Date.parse(slot.minute));return{minute:slot.minute,crossings:sumKnown(rows.map(r=>r.count)),partial:rows.some(r=>r.count===null),supported:slot.co2_g!==null};});
 const temperatures=[...new Set(m.minutes.map(v=>`${v.meteorology.temperature_f??"pending"} F / ${v.meteorology.relative_humidity_pct??"pending"}% RH`))];
 return {version:1,camera_id:m.camera_id,camera_name:cameraById(m.camera_id)?.name??`Camera ${m.camera_id}`,mode:m.mode,from:m.from,to:m.to,generated_at:(input.now??new Date()).toISOString(),reduction_pct:input.reductionPct,source_sha256:briefSourceHash(text),crossings:{value:sumKnown(selected.map(r=>r.count)),complete:selected.length>0&&selected.every(r=>r.count!==null)},requested_minutes:a.requested_minutes,recorded_minutes:a.recorded_minutes,supported_minutes:a.supported_minutes,supported_co2_g:sumKnown(a.slots.map(v=>v.co2_g)),completed_vehicles:a.cohort_vehicles,cohort_minutes:a.cohort_minutes,linked_stopped_s:m.scenario.completed_cohort.baseline.stopped_time_s,minutes,classes:a.classes.map(v=>({label:v.vehicle_class.replaceAll("_"," "),count:v.count})),pollutants:(["co2","nox"] as const).map(key=>({key,...m.scenario.pollutants[key]})),assumptions:{calibration:m.registry.calibration_version??"Pending physical calibration",mappings:[...new Set(m.minutes.map(v=>v.mapping_version).filter((v):v is string=>v!==null))],meteorology:temperatures.length===1?temperatures[0]:temperatures.length?"Mixed retained meteorology":"No retained factor weather",timing:[...new Set(m.minutes.map(v=>v.timing_basis))].join(", ")||"Timing evidence pending",factor:"CARB EMFAC2025 / RUNEX"},regional:{state:air.state,valid_at:air.applicable_at,retrieved_at:air.retrieved_at,values:air.values},evidence_refs:[...new Set(m.evidence_refs)]};
}
const KEY=Symbol.for("emission-lens.pdf-report-key.v1");
function signingKey():string {
 const configured=process.env.EMISSION_LENS_REVIEW_SESSION_SECRET;
 if(configured&&configured.length>=32)return `pdf-report-v1:${configured}`;
 const g=globalThis as typeof globalThis&{[KEY]?:string};return g[KEY]??(g[KEY]=randomBytes(32).toString("hex"));
}
export function sealBriefReport(report:BriefReport,text:string){const payload=JSON.stringify(report);return{payload,signature:createHmac("sha256",signingKey()).update(payload).update("\0").update(text.replaceAll("\r\n","\n")).digest("hex")};}
/** Signed aggregate data only, bound to the exact reviewed text and export identity. */
export function openBriefReport(payload:string,signature:string,text:string,filename:string):BriefReport {
 if(payload.length>240000||!/^\w{64}$/.test(signature))throw new Error("Invalid report snapshot.");
 const expected=createHmac("sha256",signingKey()).update(payload).update("\0").update(text.replaceAll("\r\n","\n")).digest();
 const actual=Buffer.from(signature,"hex");if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error("Report snapshot does not match the reviewed draft.");
 const r=JSON.parse(payload) as BriefReport;
 if(r.version!==1||!cameraById(r.camera_id)||!["live","replay","synthetic"].includes(r.mode)||filename!==`emission-lens-brief-${r.camera_id}-${r.mode}.pdf`||r.source_sha256!==briefSourceHash(text)||!Number.isFinite(Date.parse(r.from))||!Number.isFinite(Date.parse(r.to))||Date.parse(r.from)>=Date.parse(r.to)||Date.parse(r.to)-Date.parse(r.from)>86400000||!Array.isArray(r.minutes)||r.minutes.length>1440||!Array.isArray(r.classes)||r.classes.length>20||!Array.isArray(r.pollutants)||r.pollutants.length!==2||!nonnegative(r.reduction_pct)||r.reduction_pct>100)throw new Error("Invalid report scope.");
 return r;
}
