import { handleFrameGet } from "@emission-lens/backend";
import { readProducerPreview } from "@/lib/preview-source";
import { processedPreviewStream } from "@/lib/preview-stream";
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const id=(await params).id;
  return processedPreviewStream(request,id,async(req,cameraId)=>(await readProducerPreview(req,cameraId))??handleFrameGet(req,cameraId));
}
