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

/** Practical review tasks, conditional on the records; never a promise that retiming works. */
export function reportRecommendation(r:BriefReport):{title:string;text:string;steps:string[]} {
 const where=r.camera_name;
 const noInputs=r.assumptions.calibration.startsWith("Pending")||r.assumptions.mappings.length===0||r.supported_minutes===0;
 if(noInputs)return{title:"Check the camera setup and collect a usable sample",text:`At ${where}, check the marked road section and vehicle categories, then collect a fresh five-minute sample before comparing changes.`,steps:[`Confirm that both ends of the marked road section at ${where} are visible.`,"Manually check a small sample of counted vehicles against the video and review any missed or misclassified vehicles.","Record five complete minutes with vehicles entering and leaving the marked section; keep missing time visible."]};
 if(r.supported_minutes<r.requested_minutes)return{title:"Extend the sample before deciding on a change",text:`Only ${r.supported_minutes} of ${r.requested_minutes} minutes have enough movement data for emissions. Collect another five-minute sample at ${where} and review the missing time first.`,steps:["Find the missing minutes in the timeline and check for feed outages or vehicles that did not finish the marked road section.",`Collect another five-minute sample at ${where} in similar traffic and check the counts manually.`,"Repeat during a busier period before choosing a traffic intervention; this short sample alone cannot establish a typical pattern."]};
 if(r.linked_stopped_s===null)return{title:"Check stopped-time records before testing a change",text:`The camera recorded completed trips at ${where}, but their stopped time is not linked reliably enough for this comparison. Review those vehicle paths first.`,steps:["Review the same vehicles from entry to exit and check which stops belong to each completed trip.","Collect a fresh five-minute sample if stops or vehicle paths are missing.","Compare emissions only after those records and the road-distance checks agree."]};
 if(r.linked_stopped_s===0)return{title:"Observe a busier period before changing signal timing",text:"The vehicles used in this estimate had no recorded stopped time. A shorter-stop assumption therefore changes nothing in this sample; check a busier period before proposing a timing study.",steps:[`Review the approach at ${where} during the next busy period.`,"Record five minutes and check which waiting vehicles actually travel across the marked road section.","Only consider a timing study if repeated observations show queues and the vehicle counts and road-distance checks pass."]};
 const co2=r.pollutants.find(p=>p.key==="co2");
 if(co2?.baseline_g===null||co2?.scenario_g===null||co2?.change_g===null||!co2)return{title:"Complete the emissions check before choosing an intervention",text:`Stopping was recorded at ${where}, but the emissions comparison still lacks required data. Check the vehicle paths, road distance and vehicle-category assumptions first.`,steps:["Review the vehicles used in the estimate and their full paths across the marked road section.","Check the road-distance and vehicle-category assumptions against an independent review.","Collect another comparable five-minute sample before comparing a shorter-stop option."]};
 if(co2.change_g>0)return{title:"Check the calculation before interpreting this result",text:"The model gives higher CO2 when stopped time is reduced. A change in the model's speed range can cause this; do not describe this result as emissions savings.",steps:[`Check the marked travel distance and stopped time for vehicles at ${where}.`,"Review which emissions rate the model used before and after the hypothetical change.","Repeat the comparison with another similar period before considering any street or signal change."]};
 if(co2.change_g<0)return{title:"Investigate why vehicles are stopping",text:`The model gives lower emissions if the same vehicles stop less. This does not show which street change would work; review the cause of waiting at ${where} first.`,steps:[`Use the video at ${where} to distinguish red-light waiting from turning vehicles, blocked exits or loading activity.`,"Collect two comparable busy-period samples and independently check the counts and marked road distance.","If queues recur and the checks pass, ask a traffic engineer to assess timing and pedestrian needs before testing a change."]};
 return{title:"Check whether the model can distinguish this change",text:"Reducing stopped time does not change estimated CO2 for this sample. Review the observed stops and model inputs before investing in an intervention.",steps:[`Review why vehicles stopped at ${where}, using the video rather than the scenario result alone.`,"Check the road-distance and vehicle-category assumptions and repeat the comparison with another similar period.","Prioritize changes only after repeated observations establish a consistent issue."]};
}
export function plainBriefSummary(r:BriefReport):string {
 const advice=reportRecommendation(r),show=(v:number|null)=>v===null?"still being checked":Number.isInteger(v)?v.toLocaleString("en-US"):v.toLocaleString("en-US",{maximumSignificantDigits:4});
 return ["Planning summary",`Location: ${r.camera_name} (camera ${r.camera_id}).`,`Time covered: ${r.from} to ${r.to} UTC.`,r.mode==="synthetic"?"SYNTHETIC EXAMPLE: these numbers are invented for demonstration and cannot support a real traffic decision.":r.mode==="replay"?"These are recorded replay observations, not current live traffic.":"These are live-mode camera records for the dated period above.",`What was recorded: ${show(r.crossings.value)} vehicles counted${r.crossings.complete?"":" in the vehicle categories with usable records"}; ${r.recorded_minutes} of ${r.requested_minutes} minutes recorded.`,`Emissions estimate: ${show(r.supported_co2_g)} grams of carbon dioxide from ${r.supported_minutes} minutes with enough data. ${show(r.completed_vehicles)} vehicles were followed across the marked road section in ${r.cohort_minutes} of those minutes.`,`Recommended follow-up: ${advice.title}.`,advice.text,...advice.steps.map((step,i)=>`${i+1}. ${step}`),"A hypothetical comparison is not proof that changing a signal or street layout will work. Review repeated observations and the camera's road-distance and vehicle-category checks before a public decision."].join("\n");
}
