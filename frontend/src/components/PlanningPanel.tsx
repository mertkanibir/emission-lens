import { getRegionalAirQuality,regionalAirBrief } from "@/lib/regional-air-quality";
import Link from "next/link";
import type { Mode } from "@emission-lens/contracts";
import { draft_planning_brief } from "../../../backend/src/brief";
import { retained_measurement_minutes } from "../../../backend/src/retained";
import { BriefActions } from "./BriefActions";
import { ReductionInput } from "./ReductionInput";
import { Panel } from "./ui";
import { hrefWith,isValidReduction,formatInstant,PACIFIC } from "@/lib/format";
export async function PlanningPanel(input:{cameraId:string;mode:Mode;reduction:number;from?:string;to?:string;now?:Date}){
  let brief=null,error:string|null=null;
  try{if(!isValidReduction(input.reduction))throw new Error("Enter a stopped-time reduction from 0 to 100.");const [draft,air]=await Promise.all([draft_planning_brief({...input,stoppedTimeReductionPct:input.reduction}),getRegionalAirQuality(input)]);brief={...draft,text:draft.text+"\n"+regionalAirBrief(air)};}catch(e){error=e instanceof Error?e.message:"Brief unavailable.";}
  const latest=retained_measurement_minutes(input).find(m=>m.supported);
  return <Panel title="Planning brief" meta="Evidence → assumptions → next investigation"><p>Build a reviewable investigation draft for this exact camera, mode and selected interval. Hypothetical changes are not demonstrated savings.</p><form action="/#planning" method="get" className="form-grid"><input type="hidden" name="camera" value={input.cameraId}/><input type="hidden" name="mode" value={input.mode}/><div className="field"><label className="field-label" htmlFor="planning-reduce">Hypothetical reduction in stopped time</label><ReductionInput key={`${input.cameraId}-${input.mode}-${input.reduction}`} id="planning-reduce" defaultValue={isValidReduction(input.reduction)?input.reduction:20}/></div><div className="field"><label className="field-label" htmlFor="planning-from">From UTC minute (blank for reporting hour)</label><input id="planning-from" name="from" placeholder="2026-11-08T07:18:00Z" defaultValue={input.from??""}/></div><div className="field"><label className="field-label" htmlFor="planning-to">To UTC minute (exclusive)</label><input id="planning-to" name="to" placeholder="2026-11-08T07:19:00Z" defaultValue={input.to??""}/></div><button className="button button-primary">Build selected brief</button></form>
    {latest?<p className="fine"><Link href={hrefWith("/",{camera:input.cameraId,mode:input.mode,reduce:input.reduction,from:latest.from,to:latest.to})+"#planning"}>Select latest retained supported minute · {formatInstant(latest.minute,PACIFIC)}</Link>. This is dated retained evidence, not a current live total.</p>:null}
    {error?<p role="alert">{error}</p>:null}{brief?<><details className="disclosure" open><summary>Draft text · {input.from?"explicit selected interval":"reporting hour"}</summary><pre className="context-note" style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",maxHeight:"36rem",overflowY:"auto",fontFamily:"inherit",fontSize:".86rem",lineHeight:1.6}}>{brief.text}</pre></details><BriefActions text={brief.text} filename={`emission-lens-brief-${input.cameraId}-${input.mode}.txt`}/><details className="disclosure"><summary>Evidence references</summary>{brief.evidence_references.map(r=><p className="fine" style={{overflowWrap:"anywhere"}} key={r}>{r}</p>)}</details></>:null}
  </Panel>;
}
