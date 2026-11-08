import { AppShell } from "@/components/AppShell";
import { ReviewPanel } from "@/components/ReviewPanel";
import { hrefWith,parseMode } from "@/lib/format";
import { listCameras } from "@emission-lens/backend";
export default async function ReviewPage({searchParams}:{searchParams:Promise<{mode?:string;camera?:string;from?:string;to?:string}>}){
  const q=await searchParams,mode=parseMode(q.mode),cameraId=listCameras().some(c=>c.id===q.camera)?q.camera!:"222";
  return <AppShell mode={mode} section="review" modeHref={option=>hrefWith("/review",{mode:option,camera:cameraId,from:q.from,to:q.to})}><div className="page"><header className="page-head"><p className="section-kicker">Original evidence stays intact</p><h1 className="page-title">Evidence review</h1><p className="prose">Record an evidence question, add investigation notes and preserve the full review history.</p></header><ReviewPanel cameraId={cameraId} mode={mode} from={q.from||undefined} to={q.to||undefined}/></div></AppShell>;
}
