import PDFDocument from "pdfkit";
import { briefSourceHash, type BriefReport } from "./brief-report";

const C={ink:"#193C31",green:"#347956",mint:"#D9E8CE",gold:"#BF9650",cream:"#F7F3E9",paper:"#FFFD F7".replace(" ",""),muted:"#69766C",line:"#D7DDCE",soft:"#EDE9DE",red:"#A65842"};
const L=42,W=528;
export function pdfDisplayText(text:string){return text.replaceAll("₂","2").replaceAll("ₓ","x").replaceAll("≥",">=").replaceAll("≤","<=").replaceAll("→","->").replaceAll("×","x").replaceAll("−","-").replace(/[\u2010-\u2015]/g,"-").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/gu,"?");}
const num=(v:number|null,unit="",signed=false)=>v===null?"Pending evidence":`${signed&&v>0?"+":""}${v===0?"0":Math.abs(v)>=100?v.toFixed(1):Math.abs(v)>=1?v.toFixed(2):Math.abs(v)>=.001?v.toFixed(6).replace(/0+$/,""):Math.abs(v)>=.000000001?v.toFixed(9).replace(/0+$/,""):v.toExponential(3)}${unit?` ${unit}`:""}`;
const instant=(v:string,zone="America/Los_Angeles")=>new Intl.DateTimeFormat("en-US",{timeZone:zone,month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(v));
const clock=(v:string)=>new Intl.DateTimeFormat("en-US",{timeZone:"America/Los_Angeles",hour:"numeric",minute:"2-digit",timeZoneName:"short"}).format(new Date(v));

/** A two-page analytical report; full reviewed text and data remain attached, not dumped. */
export async function buildBriefPdf(text:string,filename:string,exportedAt=new Date(),report?:BriefReport):Promise<Buffer>{
 const source=text.replaceAll("\r\n","\n"),digest=briefSourceHash(source);
 const doc=new PDFDocument({size:"LETTER",autoFirstPage:false,bufferPages:true,margin:0,info:{Title:"Emission Lens - Intersection investigation",Author:"Mert and Carter",Subject:"Scoped observations, estimated emissions and evidence",Keywords:`draft, source-sha256:${digest}`,Creator:"Emission Lens",Producer:"Emission Lens",CreationDate:exportedAt}});
 const chunks:Buffer[]=[];const result=new Promise<Buffer>((resolve,reject)=>{doc.on("data",c=>chunks.push(Buffer.from(c)));doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
 const txt=(value:string,x:number,y:number,size=10,color=C.ink,width=W,font="Helvetica",align:"left"|"right"|"center"="left")=>{doc.font(font).fontSize(size).fillColor(color).text(pdfDisplayText(value),x,y,{width,lineGap:3,align,paragraphGap:0});};
 const line=(x:number,y:number,w:number,color=C.line)=>doc.moveTo(x,y).lineTo(x+w,y).lineWidth(.6).strokeColor(color).stroke();
 const rect=(x:number,y:number,w:number,h:number,color:string,r=5)=>doc.roundedRect(x,y,w,h,r).fill(color);
 const label=(value:string,x:number,y:number,width=W)=>txt(value.toUpperCase(),x,y,8,C.muted,width,"Helvetica-Bold");
 function page(number:number,title:string){doc.addPage();doc.rect(0,0,612,792).fill(C.cream);doc.rect(0,0,612,6).fill(C.ink);txt("Emission Lens",L,27,15,C.ink,220,"Helvetica-Bold");txt("FIELD BRIEF / TORRANCE",340,31,8,C.muted,230,"Helvetica-Bold","right");line(L,61,W);label(title,L,75);line(L,744,W);txt("Mert and Carter  /  Draft for review",L,754,7.5,C.muted,350);txt(`${number} / 2`,520,754,8,C.ink,50,"Helvetica-Bold","right");}
 const scope=source.split("\n").filter(v=>/^(Camera:|Mode:|Window:)/.test(v));
 page(1,"01 / Observation and evidence");
 txt("Intersection\ninvestigation",L,96,29,C.ink,400,"Helvetica-Bold");
 if(report)txt(report.camera_id,438,94,58,"#BCD0B6",132,"Helvetica-Bold","right");
 const camera=report?.camera_name??scope.find(v=>v.startsWith("Camera:"))?.replace(/^Camera:\s*/,"")??"Selected camera evidence";
 txt(camera,L,170,12,C.ink,W,"Helvetica-Bold");
 rect(L,196,W,62,C.ink);
 label("DATA MODE",L+14,209,110);txt(report?`${report.mode.toUpperCase()} / DRAFT`:"REVIEWED DRAFT",L+14,225,10,"#F6F4E7",110,"Helvetica-Bold");
 label("SELECTED INTERVAL",L+143,209,244);txt(report?`${instant(report.from)} - ${clock(report.to)}`:"Scope retained in the attached source",L+143,225,9,"#F6F4E7",244);
 label("EXPORTED / UTC",L+402,209,112);txt(exportedAt.toISOString().slice(0,16).replace("T"," "),L+402,225,8.5,"#F6F4E7",112);
 const summary=report?report.supported_minutes>0?`${report.supported_minutes} supported minute snapshot${report.supported_minutes===1?"":"s"} ${report.supported_minutes===1?"yields":"yield"} ${num(report.supported_co2_g,"g CO2")}. ${report.completed_vehicles===null?"Linked vehicle counts are still being collected.":`${report.completed_vehicles} completed movement vehicles are linked across ${report.cohort_minutes} snapshot${report.cohort_minutes===1?"":"s"}.`} Coverage stays scoped to this camera and interval.`:`${report.recorded_minutes} of ${report.requested_minutes} minute anchors contain observations. A completed movement cohort is still needed for an emissions comparison; the recorded traffic remains useful evidence.`:"This report preserves the reviewed scope, evidence and source text. Open the attached draft for the complete investigation record.";
 txt(summary,L,276,10.5,C.ink,W);
 const kpis=report?[
  {label:"Supported-minute CO2",value:num(report.supported_co2_g,"g"),caption:"Completed movement estimates"},
  {label:"Movement cohort",value:report.completed_vehicles===null?"Collecting":`${report.completed_vehicles}`,caption:`Vehicles in ${report.cohort_minutes} linked snapshot${report.cohort_minutes===1?"":"s"}`},
  {label:report.crossings.complete?"Line crossings":"Known-class crossings",value:report.crossings.value===null?"Collecting":`${report.crossings.value}`,caption:report.crossings.complete?"Recorded classes in this interval":"Numeric classes; mix is partial"},
  {label:"Observation coverage",value:`${report.recorded_minutes} / ${report.requested_minutes}`,caption:`${report.supported_minutes} supported CO2 snapshot${report.supported_minutes===1?"":"s"}`},
 ]:[{label:"Reviewed source",value:"Attached",caption:"Complete UTF-8 original"},{label:"Evidence scope",value:"Preserved",caption:"No live re-query on export"},{label:"Report status",value:"Draft",caption:"Review before sharing"},{label:"Source integrity",value:digest.slice(0,8),caption:"SHA-256 on page 2"}];
 const gap=8,cw=(W-gap*3)/4;
 kpis.forEach((v,i)=>{const x=L+i*(cw+gap);rect(x,329,cw,98,i===0?C.mint:C.paper);label(v.label,x+11,341,cw-22);txt(v.value,x+11,368,v.value.length>13?15:23,C.ink,cw-22,"Helvetica-Bold");txt(v.caption,x+11,404,7.5,C.muted,cw-22);});
 label("Traffic / evidence timeline",L,439);txt(report?"Recorded numeric class crossings by minute":"A structured data snapshot was not supplied",L,455,9,C.muted,W);
 const plot={x:L,y:486,w:W,h:93};
 if(report?.minutes.length){
  const bins:Array<{count:number|null;partial:boolean;supported:number;size:number}>=[];const step=Math.max(1,Math.ceil(report.minutes.length/60));
  for(let i=0;i<report.minutes.length;i+=step){const m=report.minutes.slice(i,i+step),present=m.filter(v=>v.crossings!==null);bins.push({count:present.length?present.reduce((a,b)=>a+b.crossings!,0):null,partial:m.some(v=>v.partial)||present.length!==m.length,supported:m.filter(v=>v.supported).length,size:m.length});}
  const max=Math.max(1,...bins.map(v=>v.count??0));label(`0 - ${max} crossings${step>1?` / ${step}-minute bin`:""}`,L+330,439,198);
  line(plot.x,plot.y+plot.h,plot.w);const unit=plot.w/bins.length,bw=Math.min(26,Math.max(2,unit-3));
  bins.forEach((b,i)=>{const x=plot.x+i*unit+(unit-bw)/2;
   if(b.count===null){doc.rect(x,plot.y+4,bw,plot.h-4).fill(C.soft);doc.save().rect(x,plot.y+4,bw,plot.h-4).clip();for(let q=-plot.h;q<bw;q+=7)doc.moveTo(x+q,plot.y+plot.h).lineTo(x+q+plot.h,plot.y).lineWidth(.5).strokeColor("#C8C7BB").stroke();doc.restore();}
   else{const h=Math.max(1,b.count/max*(plot.h-8));doc.rect(x,plot.y+plot.h-h,bw,h).fill(b.partial?"#709575":C.green);if(bins.length<=8)txt(String(b.count),x-8,plot.y+plot.h-h-15,8,C.ink,bw+16,"Helvetica-Bold","center");}
   doc.rect(x,plot.y+plot.h+6,bw,5).fill(b.supported>0?C.gold:"#D9D7CD");
  });
  txt(clock(report.from),L,598,8,C.muted,210);txt(clock(report.to),L+318,598,8,C.muted,210,"Helvetica","right");
 }else{rect(L,486,W,93,C.soft);txt("No recorded minute series in the reviewed payload",L+18,520,11,C.muted,W-36);}
 [{name:"Counted classes",color:C.green},{name:"Missing records",color:C.soft},{name:"Supported CO2 minute",color:C.gold}].forEach((v,i)=>{doc.rect(L+i*177,622,7,7).fill(v.color);txt(v.name,L+12+i*177,620,7.5,C.muted,165);});
 rect(L,652,W,67,C.mint);label("Investigation focus",L+13,665,W-26);
 const co2=report?.pollutants.find(p=>p.key==="co2");
 const focus=!report?"Review the attached scope and source evidence before drawing a conclusion.":co2?.baseline_g===null||co2?.scenario_g===null?"Collect a fully supported movement interval before comparing a shorter-stop scenario. Recorded counts are retained; gaps are not filled with zero.":report.linked_stopped_s===0?"The selected completed cohort has zero linked stopped time. A shorter-stop assumption leaves this cohort unchanged; investigate a fuller observation window before proposing timing changes.":co2?.change_g!==null&&co2?.change_g!==undefined&&co2.change_g>0?"The hypothetical result increases modeled CO2. Inspect the nonlinear factor-bin response before interpreting a stopped-time change as a benefit.":"Review the same-cohort comparison and movement assumptions. A hypothetical reduction is an investigation prompt, not demonstrated signal-timing savings.";
 txt(focus,L+13,680,9,C.ink,W-26);

 page(2,"02 / Scenario and decision context");
 txt("Scenario and evidence",L,98,26,C.ink,W,"Helvetica-Bold");txt(report?`Hypothetical ${report.reduction_pct}% less stopping / same original completed vehicles` : "Reviewable source and analytical boundaries",L,133,10,C.muted,W);
 const comparisons=report?.pollutants??[{key:"co2" as const,baseline_g:null,scenario_g:null,change_g:null,change_pct:null},{key:"nox" as const,baseline_g:null,scenario_g:null,change_g:null,change_pct:null}];
 comparisons.forEach((p,i)=>{const x=L+i*270;rect(x,164,258,171,C.paper);label(p.key==="co2"?"Estimated CO2 / grams":"Estimated NOx / grams",x+14,179,230);
  if(p.baseline_g===null||p.scenario_g===null){txt("Comparison pending",x+14,207,17,C.ink,230,"Helvetica-Bold");txt("A fully linked completed cohort is needed. Supported observations remain in the report; no estimate is substituted.",x+14,239,9,C.muted,230);}
  else{const max=Math.max(p.baseline_g,p.scenario_g,.0000000001);[["Baseline",p.baseline_g,C.green],["Scenario",p.scenario_g,C.gold]].forEach(([name,value,color],j)=>{const v=value as number,y=207+j*39;txt(name as string,x+14,y,8,C.muted,110);txt(num(v),x+118,y,9,C.ink,126,"Helvetica-Bold","right");doc.rect(x+14,y+16,230,6).fill(C.soft);doc.rect(x+14,y+16,v===0?1:Math.max(1,v/max*230),6).fill(color as string);});txt(`Change ${num(p.change_g,"g",true)}${p.change_pct===null?"":` (${num(p.change_pct,"%",true)})`}`,x+14,299,10,p.change_g!==null&&p.change_g>0?C.red:C.ink,230,"Helvetica-Bold");}
 });
 txt("The scenario preserves vehicle count, distances, moving time and original completion minutes. RUNEX already includes ordinary stops; no separate idle process is added.",L,349,8.5,C.muted,W);
 rect(L,391,258,168,C.paper);label("Observed class mix",L+14,405,230);txt("Image classes / recorded numeric crossings",L+14,421,7.5,C.muted,230);
 const classes=report?.classes.filter(c=>c.count!==null).sort((a,b)=>b.count!-a.count!).slice(0,4)??[];const classMax=Math.max(1,...classes.map(c=>c.count!));
 if(classes.length)classes.forEach((v,i)=>{const y=446+i*24;txt(v.label,L+14,y,9,C.ink,145);txt(v.count===null?"Pending":String(v.count),L+169,y,9,C.ink,75,"Helvetica-Bold","right");doc.rect(L+14,y+14,230,3).fill(C.soft);doc.rect(L+14,y+14,v.count===0?1:v.count!/classMax*230,3).fill(C.green);});else txt("Class records pending",L+14,458,12,C.muted,230);
 txt("Image labels are not measured regulatory fleet shares.",L+14,543,7.5,C.muted,230);
 rect(L+270,391,258,168,C.mint);label("Independent regional context",L+284,405,230);txt("CAMS global atmospheric model",L+284,421,9,C.ink,230,"Helvetica-Bold");
 const regional=report?.regional;
 if(regional?.values){const vs=[["PM2.5",regional.values.pm2_5],["NO2",regional.values.nitrogen_dioxide],["Ozone",regional.values.ozone]] as const;vs.forEach(([name,v],i)=>{const x=L+284+i*77;txt(name,x,447,8,C.muted,70);txt(num(v),x,464,16,C.ink,70,"Helvetica-Bold");});txt(`ug/m3 / ${regional.state} / valid ${regional.valid_at?clock(regional.valid_at):"time pending"}`,L+284,489,7.5,C.muted,230);}
 else txt("No overlapping regional model value",L+284,452,11,C.ink,230);
 txt("About 45 km / 3-hour native scale. Independent modeled concentrations; no intersection attribution or exposure inference.",L+284,515,8,C.ink,230);
 label("Evidence and assumptions",L,582);
 const boxes=[{title:"MOVEMENT / MODEL",body:report?`${report.assumptions.factor}\n${report.assumptions.meteorology}\n${report.assumptions.calibration.split("-").slice(0,4).join("-")}`:"Original modeling assumptions remain attached."},{title:"COVERAGE / PROVENANCE",body:report?`${report.recorded_minutes}/${report.requested_minutes} recorded minute anchors\n${report.supported_minutes} supported CO2 snapshot${report.supported_minutes===1?"":"s"}\n${report.evidence_refs.length} calculation reference${report.evidence_refs.length===1?"":"s"}`:"The exact source text is attached.\nNo live records were re-queried."},{title:"REVIEW / NEXT STEP",body:"Validate movement calibration and class mapping. Review source gaps before using this draft in a planning decision."}];
 boxes.forEach((v,i)=>{const x=L+i*180;label(v.title,x,605,166);txt(v.body,x,624,8.2,C.ink,166);});
 line(L,688,W);txt("Full reviewed draft + structured aggregate snapshot are embedded as attachments.",L,700,8,C.muted,W);txt(`Source SHA-256: ${digest}`,L,717,6.6,C.muted,W,"Courier");
 doc.file(Buffer.from(source,"utf8"),{name:filename.replace(/\.pdf$/,".txt"),type:"text/plain",description:"Exact reviewed investigation draft (UTF-8)",creationDate:exportedAt,modifiedDate:exportedAt});
 if(report)doc.file(Buffer.from(JSON.stringify(report,null,2)),{name:filename.replace(/\.pdf$/,"-snapshot.json"),type:"application/json",description:"Frozen aggregate chart and report snapshot",creationDate:exportedAt,modifiedDate:exportedAt});
 doc.end();return result;
}
