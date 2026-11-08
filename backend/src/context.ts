import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { randomUUID } from "node:crypto";
import { cameraById, type Mode } from "../../contracts/src/index.ts";
import { read_measurement_window } from "./measurements.ts";
const DOCS="https://open-meteo.com/en/docs";
const MAX_AGE=10*60000,STALE_LIMIT=6*3600000;
interface WeatherData { latitude:number;longitude:number;hourly:{time:string[];temperature_2m:Array<number|null>;relative_humidity_2m:Array<number|null>;wind_speed_10m:Array<number|null>;wind_direction_10m:Array<number|null>} }
interface Cached {retrieved_at:string;source_url:string;data:WeatherData}
const cache=new Map<string,Cached>(),pending=new Map<string,Promise<Cached>>();
function cachePath(){const p=process.env.EMISSION_LENS_CONTEXT_CACHE_PATH;return p&&isAbsolute(p)&&![process.env.EMISSION_LENS_STORE_PATH,process.env.EMISSION_LENS_REGISTRY_PATH,process.env.EMISSION_LENS_REVIEW_PATH].includes(p)?p:null;}
export function parseWeather(value:unknown):WeatherData {
  const d=value as WeatherData&{utc_offset_seconds?:number};
  if(!d||!Number.isFinite(d.latitude)||!Number.isFinite(d.longitude)||d.utc_offset_seconds!==0||!d.hourly||!Array.isArray(d.hourly.time)||d.hourly.time.length>120)throw new Error("Unsupported weather response.");
  const times=d.hourly.time;if(!times.length||times.some((t,i)=>typeof t!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:00$/.test(t)||!Number.isFinite(Date.parse(t+"Z"))||(i>0&&Date.parse(t+"Z")<=Date.parse(times[i-1]+"Z"))))throw new Error("Invalid weather time series.");
  for(const [key,min,max] of [["temperature_2m",-100,70],["relative_humidity_2m",0,100],["wind_speed_10m",0,150],["wind_direction_10m",0,360]] as const){const a=d.hourly[key];if(!Array.isArray(a)||a.length!==times.length||a.some(v=>v!==null&&(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)))throw new Error("Invalid weather values.");}
  return {latitude:d.latitude,longitude:d.longitude,hourly:d.hourly};
}
function cached(camera:string):Cached|undefined {
  if(cache.has(camera))return cache.get(camera);
  const p=cachePath();if(!p||!existsSync(p))return;
  try{if(statSync(/* turbopackIgnore: true */ p).size>1048576)return;const d=JSON.parse(readFileSync(/* turbopackIgnore: true */ p,"utf8"));for(const [id,entry]of Object.entries(d.entries??{})){const e=entry as Cached;if(cameraById(id)&&Number.isFinite(Date.parse(e.retrieved_at))&&e.source_url.startsWith("https://api.open-meteo.com/v1/forecast?")){parseWeather({...e.data,utc_offset_seconds:0});cache.set(id,e);}}}catch{/* A context cache is disposable; measurement history is never read or changed here. */}
  return cache.get(camera);
}
async function retrieve(camera:string,now:Date):Promise<Cached>{
  const found=pending.get(camera);if(found)return found;
  const task=(async()=>{const c=cameraById(camera)!;const url=new URL("https://api.open-meteo.com/v1/forecast");url.search=new URLSearchParams({latitude:String(c.latitude),longitude:String(c.longitude),hourly:"temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m",timezone:"UTC",wind_speed_unit:"ms",past_days:"2",forecast_days:"1"}).toString();
    const response=await fetch(url,{signal:AbortSignal.timeout(5000),redirect:"error",cache:"no-store"});if(!response.ok)throw new Error("Weather source unavailable.");
    const text=await response.text();if(text.length>1048576)throw new Error("Weather response too large.");const entry={retrieved_at:now.toISOString(),source_url:url.href,data:parseWeather(JSON.parse(text))};cache.set(camera,entry);
    const p=cachePath();if(p){try{mkdirSync(dirname(p),{recursive:true,mode:0o700});const t=p+"."+randomUUID()+".tmp";writeFileSync(/* turbopackIgnore: true */ t,JSON.stringify({context_version:"1.0",entries:Object.fromEntries(cache)}),{mode:0o600,flag:"wx"});renameSync(/* turbopackIgnore: true */ t,/* turbopackIgnore: true */ p);}catch{/* Retain the valid process cache if optional disk caching is unavailable. */}}
    return entry;})();pending.set(camera,task);try{return await task;}finally{pending.delete(camera);}
}
export function selectWeather(entry:Cached|undefined,from:string,to:string,now:Date,failed=false){
  const base={source:"Open-Meteo weather model",documentation_url:DOCS,source_url:entry?.source_url??null,retrieved_at:entry?.retrieved_at??null,applicable_at:null as string|null,values:null as {temperature_c:number|null;relative_humidity_pct:number|null;wind_speed_m_s:number|null;wind_direction_deg:number|null}|null,units:{temperature_c:"°C",relative_humidity_pct:"%",wind_speed_m_s:"m/s",wind_direction_deg:"°"},grid:entry?{latitude:entry.data.latitude,longitude:entry.data.longitude}:null};
  const age=entry?now.getTime()-Date.parse(entry.retrieved_at):Infinity;
  if(!entry||age<0||age>STALE_LIMIT)return{...base,state:"unavailable" as const,reason:"No recent weather context is retained for this interval."};
  let i=-1;for(let n=entry.data.hourly.time.length-1;n>=0;n--){const t=Date.parse(entry.data.hourly.time[n]+"Z");if(t<Date.parse(to)&&t+3600000>Date.parse(from)){i=n;break;}}
  if(i<0)return{...base,state:"unavailable" as const,reason:"The weather time series does not overlap this selected interval; current weather is not substituted."};
  return{...base,state:failed||age>MAX_AGE?"stale" as const:"available" as const,reason:failed?"Weather refresh failed; dated cached model data are shown.":"Latest hourly model value overlapping the selected interval; not a window average or sensor measurement.",applicable_at:entry.data.hourly.time[i]+":00Z",values:{temperature_c:entry.data.hourly.temperature_2m[i],relative_humidity_pct:entry.data.hourly.relative_humidity_2m[i],wind_speed_m_s:entry.data.hourly.wind_speed_10m[i],wind_direction_deg:entry.data.hourly.wind_direction_10m[i]}};
}
export async function get_external_context(input:{cameraId:string;mode:Mode;from?:string;to?:string;now?:Date}) {
  const now=input.now??new Date(),window=read_measurement_window(input);
  let entry=input.mode==="synthetic"?undefined:cached(input.cameraId),failed=false;
  if(input.mode!=="synthetic"&&(!entry||now.getTime()-Date.parse(entry.retrieved_at)>MAX_AGE)){try{entry=await retrieve(input.cameraId,now);}catch{failed=true;}}
  return{context_version:"1.0" as const,camera_id:input.cameraId,mode:input.mode,from:window.from,to:window.to,weather:selectWeather(entry,window.from,window.to,now,failed),limitations:["Weather is modeled regional context, not measured local air quality or a dispersion model.","The original emissions calibration, fleet mixture and retained temperature/humidity assumptions are unchanged.",...(input.mode==="replay"?["Replay reporting time is estimated playback media UTC, not verified original recording capture UTC; weather alignment is conditional on that clock."]:[]),...(input.mode==="synthetic"?["No real weather is attached to synthetic observations."]:[]),"School/site proximity and exposure are not established by this context layer."]};
}
