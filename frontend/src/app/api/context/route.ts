import { get_external_context } from "../../../../../backend/src/context";
import type { Mode } from "@emission-lens/contracts";
import { IngestError } from "../../../../../backend/src/persistence";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>!["camera","mode","from","to"].includes(k)||p.getAll(k).length!==1))return Response.json({error:"Unsupported context query."},{status:400});return Response.json(await get_external_context({cameraId:p.get("camera")??"222",mode:(p.get("mode")??"live") as Mode,from:p.get("from")??undefined,to:p.get("to")??undefined}),{headers:{"Cache-Control":"no-store"}});}catch(e){return Response.json({error:e instanceof IngestError?e.message:"External context unavailable."},{status:e instanceof IngestError?e.status:503});}}
