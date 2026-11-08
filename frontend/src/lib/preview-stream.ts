import { parseSelectedPreview, isNewPreview, type ProcessedPreview } from "./preview-cadence";

export const PREVIEW_BOUNDARY = "emission-lens-frame";
type Reader = (request: Request, cameraId: string) => Promise<Response>;
/** Bounded native JPEG playback; every image already contains its own matching overlays. */
export async function processedPreviewStream(request:Request,cameraId:string,readFrame:Reader,options:{intervalMs?:number;durationMs?:number;maxFrames?:number}={}) {
  const mode=new URL(request.url).searchParams.get('mode')??'live';
  if(mode!=='live'&&mode!=='replay')return new Response('Unsupported preview mode.',{status:400});
  const interval=options.intervalMs??66,duration=options.durationMs??60000,maxFrames=options.maxFrames??1000;
  let first:ProcessedPreview;
  try{const response=await readFrame(request,cameraId);if(response.status!==200)return new Response('Processed video is awaiting a frame.',{status:response.status===404?404:503});first=parseSelectedPreview(await response.json(),cameraId,mode,Date.now());}catch{return new Response('Processed video is temporarily unavailable.',{status:503});}
  let alive=true,timer:ReturnType<typeof setTimeout>|undefined,wake:(()=>void)|undefined;
  const stop=()=>{alive=false;if(timer)clearTimeout(timer);wake?.();wake=undefined;};
  const pause=(ms:number)=>new Promise<void>(resolve=>{if(!alive)return resolve();wake=resolve;timer=setTimeout(()=>{wake=undefined;resolve();},ms);});
  const body=new ReadableStream<Uint8Array>({
    async start(controller){
      const start=Date.now();let previous:ProcessedPreview|null=null,sent=0;
      request.signal.addEventListener('abort',stop,{once:true});
      const emit=(frame:ProcessedPreview)=>{
        const jpeg=Buffer.from(frame.image_data_url.slice('data:image/jpeg;base64,'.length),'base64');
        const header=Buffer.from(`--${PREVIEW_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpeg.length}\r\nX-Sequence: ${frame.sequence}\r\nX-Processed-At: ${frame.processed_at}\r\n\r\n`);
        controller.enqueue(new Uint8Array(Buffer.concat([header,jpeg,Buffer.from('\r\n')])));
        previous=frame;sent++;
      };
      try{
        if(!request.signal.aborted)emit(first);else stop();
        while(alive&&Date.now()-start<duration&&sent<maxFrames){
          await pause(interval);if(!alive)break;
          // A slow consumer drops intermediate images instead of building a footage backlog.
          if((controller.desiredSize??0)<=0)continue;
          try{const response=await readFrame(request,cameraId);if(!alive)break;if(response.status!==200){await pause(250);continue;}const next=parseSelectedPreview(await response.json(),cameraId,mode,Date.now());if(isNewPreview(next,previous))emit(next);}catch{await pause(250);}
        }
        if(alive)controller.enqueue(new TextEncoder().encode(`--${PREVIEW_BOUNDARY}--\r\n`));
      }catch{/* Disconnects retain no replay buffer or source footage. */}
      finally{stop();request.signal.removeEventListener('abort',stop);try{controller.close();}catch{/* Already canceled. */}}
    },cancel(){stop();},
  },new ByteLengthQueuingStrategy({highWaterMark:384*1024}));
  return new Response(body,{headers:{'Content-Type':`multipart/x-mixed-replace; boundary=${PREVIEW_BOUNDARY}`,'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no'}});
}
