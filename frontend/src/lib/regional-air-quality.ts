import { cameraById, type Mode } from "@emission-lens/contracts";
import { read_measurement_window } from "../../../backend/src/measurements";
export const AIR_DOCS = "https://open-meteo.com/en/docs/air-quality-api";
const fields = ["pm2_5", "nitrogen_dioxide", "ozone"] as const;
type Field = typeof fields[number];
export interface AirModelData { latitude:number; longitude:number; hourly:{time:string[]} & Record<Field,Array<number|null>> }
interface Entry { data:AirModelData; retrieved_at:string; source_url:string }
export function parseAirModel(input:unknown):AirModelData {
  const d=input as AirModelData & {utc_offset_seconds?:number;hourly_units?:Record<string,string>};
  if(!d||!Number.isFinite(d.latitude)||Math.abs(d.latitude)>90||!Number.isFinite(d.longitude)||Math.abs(d.longitude)>180||d.utc_offset_seconds!==0||!d.hourly||!Array.isArray(d.hourly.time)||!d.hourly.time.length||d.hourly.time.length>120)throw new Error("Invalid regional model response.");
  const times=d.hourly.time;
  if(times.some((v,i)=>typeof v!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:00$/.test(v)||!Number.isFinite(Date.parse(v+"Z"))||(i>0&&Date.parse(v+"Z")<=Date.parse(times[i-1]+"Z"))))throw new Error("Invalid model timestamps.");
  for(const field of fields){const a=d.hourly[field];if(!["μg/m³","µg/m³"].includes(d.hourly_units?.[field]??"")||!Array.isArray(a)||a.length!==times.length||a.some(v=>v!==null&&(typeof v!=="number"||!Number.isFinite(v)||v<0||v>100000)))throw new Error("Invalid model units or values.");}
  return {latitude:d.latitude,longitude:d.longitude,hourly:{time:[...times],pm2_5:[...d.hourly.pm2_5],nitrogen_dioxide:[...d.hourly.nitrogen_dioxide],ozone:[...d.hourly.ozone]}};
}
export function selectAirModel(entry:Entry|undefined,from:string,to:string,now:Date,failed=false){
  const result={state:"unavailable" as "available"|"stale"|"unavailable",model:"CAMS global atmospheric composition forecast",source_url:entry?.source_url??null,documentation_url:AIR_DOCS,retrieved_at:entry?.retrieved_at??null,applicable_at:null as string|null,grid:entry?{latitude:entry.data.latitude,longitude:entry.data.longitude}:null,values:null as Record<Field,number|null>|null,reason:"No recent regional model data overlap this interval."};
  const age=entry?now.getTime()-Date.parse(entry.retrieved_at):Infinity;
  if(!entry||age<0||age>6*3600000||!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))||Date.parse(from)>=Date.parse(to))return result;
  const times=entry.data.hourly.time;
  for(let i=times.length-1;i>=0;i--){const t=Date.parse(times[i]+"Z");if(t<Date.parse(to)&&t+3600000>Date.parse(from))return {...result,state:failed||age>600000?"stale" as const:"available" as const,applicable_at:times[i]+":00Z",values:Object.fromEntries(fields.map(f=>[f,entry.data.hourly[f][i]])) as Record<Field,number|null>,reason:"Latest API hourly model value overlapping this interval. Underlying global model resolution is about 45 km and 3 hours; hourly API values are regional context."};}
  return result;
}
const cache=new Map<string,Entry>(),pending=new Map<string,Promise<Entry>>();
export async function getRegionalAirQuality(input:{cameraId:string;mode:Mode;from?:string;to?:string;now?:Date}){
  const now=input.now??new Date();const window=read_measurement_window(input);const camera=cameraById(input.cameraId);if(!camera)throw new Error("Unknown camera.");
  if(input.mode==="synthetic")return {...selectAirModel(undefined,window.from,window.to,now),reason:"Regional model data are not attached to synthetic observations."};
  let entry=cache.get(camera.id),failed=false;
  if(!entry||now.getTime()-Date.parse(entry.retrieved_at)>600000){
    try{
      let task=pending.get(camera.id);
      if(!task){task=(async()=>{const url=new URL("https://air-quality-api.open-meteo.com/v1/air-quality");url.search=new URLSearchParams({latitude:String(camera.latitude),longitude:String(camera.longitude),hourly:fields.join(","),domains:"cams_global",timezone:"UTC",past_days:"1",forecast_days:"1"}).toString();const r=await fetch(url,{signal:AbortSignal.timeout(4000),redirect:"error",cache:"no-store"});if(!r.ok)throw new Error("Regional model unavailable.");const body=await r.text();if(body.length>1000000)throw new Error("Response too large.");const e={data:parseAirModel(JSON.parse(body)),retrieved_at:now.toISOString(),source_url:url.href};cache.set(camera.id,e);return e;})();pending.set(camera.id,task);}
      try{entry=await task;}finally{pending.delete(camera.id);}
    }catch{failed=true;}
  }
  return selectAirModel(entry,window.from,window.to,now,failed);
}
export type RegionalAirQuality = Awaited<ReturnType<typeof getRegionalAirQuality>>;
export function regionalAirBrief(value:RegionalAirQuality):string {
  const v=value.values;
  return [`Regional atmospheric context: ${value.state}; ${value.model}; applicable ${value.applicable_at??"unavailable"}; retrieved ${value.retrieved_at??"unavailable"}.`,v?`Regional model concentrations (ug/m3): PM2.5 ${v.pm2_5??"unavailable"}; NO2 ${v.nitrogen_dioxide??"unavailable"}; ozone ${v.ozone??"unavailable"}.`:"Regional modeled concentrations are unavailable.","CAMS global model has about 45 km spatial and 3-hour native temporal resolution. These are regional modeled concentrations, independent of camera-based tailpipe estimates; no intersection attribution, measured air quality, exposure or health inference. Weather and retained EMFAC inputs are unchanged.",`Source: ${value.source_url??AIR_DOCS}. Data: Copernicus Atmosphere Monitoring Service (CAMS) via Open-Meteo. ${value.reason}`].join("\n");
}
