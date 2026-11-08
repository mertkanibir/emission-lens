import { AppShell } from "@/components/AppShell";
import { PlanningPanel } from "@/components/PlanningPanel";
import { hrefWith,parseMode,parseReduction } from "@/lib/format";
import { listCameras } from "@emission-lens/backend";
export default async function BriefPage({searchParams}:{searchParams:Promise<{mode?:string;camera?:string;reduce?:string;from?:string;to?:string}>}){
  const q=await searchParams,mode=parseMode(q.mode),cameraId=listCameras().some(c=>c.id===q.camera)?q.camera!:"222";
  return <AppShell mode={mode} section="brief" modeHref={option=>hrefWith("/brief",{mode:option,camera:cameraId,reduce:q.reduce,from:q.from,to:q.to})}><div className="page"><header className="page-head"><p className="section-kicker">Reviewable investigation draft</p><h1 className="page-title">Planning brief</h1><p className="prose">Choose an explicit retained interval or the reporting hour. Every exported number retains that scope.</p></header><PlanningPanel cameraId={cameraId} mode={mode} reduction={parseReduction(q.reduce)} from={q.from||undefined} to={q.to||undefined}/></div></AppShell>;
}
