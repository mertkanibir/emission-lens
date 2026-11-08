import type { Mode } from "@emission-lens/contracts";
import { read_reviews } from "../../../backend/src/reviews";
import { ReviewEditor } from "./ReviewEditor";
import { Panel } from "./ui";
export function ReviewPanel(input:{cameraId:string;mode:Mode;from?:string;to?:string;now?:Date}){
  try{const initial=read_reviews(input);const query=new URLSearchParams({camera:input.cameraId,mode:input.mode,...(input.from&&input.to?{from:input.from,to:input.to}:{})}).toString();return <Panel title="Evidence review" meta="Durable annotations · original records preserved"><ReviewEditor key={query} initial={initial} query={query}/></Panel>;}catch(e){return <Panel title="Evidence review"><p role="alert">{e instanceof Error?e.message:"Review history unavailable."}</p></Panel>;}
}
