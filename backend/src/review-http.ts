import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Mode } from "../../contracts/src/index.ts";
import { append_review, read_reviews, reviewWriteConfigured } from "./reviews.ts";
import { IngestError } from "./persistence.ts";
const COOKIE="emission_lens_review";
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const json=(value:unknown,status=200,extra:Record<string,string>={})=>Response.json(value,{status,headers:{...headers,...extra}});
const sign=(value:string)=>createHmac("sha256",process.env.EMISSION_LENS_REVIEW_SESSION_SECRET??"").update(value).digest("hex");
const equal=(a:string,b:string)=>a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
function origin(request:Request) {
  const url=new URL(request.url); const supplied=request.headers.get("origin");
  return ["localhost","127.0.0.1","[::1]"].includes(url.hostname)&&supplied===url.origin&&request.headers.get("sec-fetch-site")==="same-origin";
}
export async function handleReviewSessionPost(request:Request,now=Date.now()) {
  if(!reviewWriteConfigured())return json({error:"Local review editing is disabled."},503);
  if(!origin(request))return json({error:"Review editing requires the opted-in same-origin local browser."},403);
  const payload=Buffer.from(JSON.stringify({id:randomBytes(24).toString("hex"),expires:now+8*3600000})).toString("base64url");
  const session=payload+"."+sign(payload);
  return json({csrf:sign("csrf:"+session),expires_at:new Date(now+8*3600000).toISOString()},200,{"Set-Cookie":`${COOKIE}=${session}; HttpOnly; SameSite=Strict; Path=/api/reviews; Max-Age=28800`});
}
function authorized(request:Request,now:number) {
  if(!reviewWriteConfigured()||!origin(request))return false;
  const session=(request.headers.get("cookie")??"").split(";").map(p=>p.trim()).find(p=>p.startsWith(COOKIE+"="))?.slice(COOKIE.length+1)??"";
  const [payload,signature]=session.split(".");if(!payload||!signature||!equal(signature,sign(payload)))return false;
  try{const p=JSON.parse(Buffer.from(payload,"base64url").toString());return typeof p.expires==="number"&&p.expires>now&&p.expires<=now+8*3600000&&equal(request.headers.get("x-csrf-token")??"",sign("csrf:"+session));}catch{return false;}
}
export async function handleReviewPost(request:Request,now=new Date()) {
  if(!authorized(request,now.getTime()))return json({error:"A current local review session and CSRF token are required."},403);
  try {
    if(request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new IngestError("Expected application/json.",415);
    if(!request.body)throw new IngestError("Expected a review body.",400);
    const reader=request.body.getReader();let size=0;const chunks:Uint8Array[]=[];
    try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>16384){await reader.cancel();throw new IngestError("Review request exceeds 16 KiB.",413);}chunks.push(r.value);}}finally{reader.releaseLock();}
    let value;try{value=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new IngestError("Invalid review JSON.",400);}
    return json({review_version:"1.0",event:append_review(value,now)},201);
  }catch(e){return json({error:e instanceof IngestError?e.message:"Review could not be committed; preserve its history."},e instanceof IngestError?e.status:503);}
}
export function handleReviewGet(request:Request) {
  try{const p=new URL(request.url).searchParams;if([...p.keys()].some(k=>!["camera","mode","from","to"].includes(k)||p.getAll(k).length!==1))throw new IngestError("Unsupported review query.",400);
    return json(read_reviews({cameraId:p.get("camera")??"222",mode:(p.get("mode")??"live") as Mode,from:p.get("from")??undefined,to:p.get("to")??undefined}));
  }catch(e){return json({error:e instanceof IngestError?e.message:"Review history unavailable."},e instanceof IngestError?e.status:503);}
}
