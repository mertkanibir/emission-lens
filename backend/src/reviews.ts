import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { cameraById, type Mode } from "../../contracts/src/index.ts";
import { read_measurement_window } from "./measurements.ts";
import { IngestError, readSnapshot, storePath } from "./persistence.ts";
import { get_traffic_window } from "./queries.ts";
import { trafficFor } from "./store.ts";

export const REVIEW_ISSUES = ["classification", "camera_view", "coverage", "timing", "other"] as const;
export const REVIEW_STATES = ["open", "investigating", "resolved"] as const;
export interface ReviewTarget { kind: "measurement" | "traffic"; reference: string; minute: string; evidence_ref?: string }
export interface ReviewEvent { event_id: string; review_id: string; recorded_at: string; author: "Mert" | "Carter"; action: "create" | "update"; camera_id: string; mode: Mode; target: ReviewTarget; issue: typeof REVIEW_ISSUES[number]; note: string; state: typeof REVIEW_STATES[number] }
export interface ReviewItem extends ReviewEvent { created_at: string; updated_at: string }
function path(): string | null {
  const value = process.env.EMISSION_LENS_REVIEW_PATH;
  if (!value) return null;
  if (!isAbsolute(value)) throw new IngestError("Review storage must use an absolute private path.", 503);
  return value;
}
function validateEvent(e: ReviewEvent) {
  if (!e || !/^[\da-f-]{36}$/.test(e.event_id) || !/^[\da-f-]{36}$/.test(e.review_id) || !cameraById(e.camera_id) || !["live", "replay", "synthetic"].includes(e.mode) || !["Mert", "Carter"].includes(e.author) || !REVIEW_ISSUES.includes(e.issue) || !REVIEW_STATES.includes(e.state) || !["create", "update"].includes(e.action) || !Number.isFinite(Date.parse(e.recorded_at)) || !e.target || !["measurement", "traffic"].includes(e.target.kind) || !Number.isFinite(Date.parse(e.target.minute)) || typeof e.target.reference !== "string" || e.target.reference.length > 160 || typeof e.note !== "string" || !e.note.trim() || e.note.length > 2000) throw new Error("Invalid review event.");
}
function events(): ReviewEvent[] {
  const p = path();
  if (!p || !existsSync(p)) return [];
  try {
    if (statSync(p).size > 4 * 1024 * 1024) throw new Error();
    const value = JSON.parse(readFileSync(p, "utf8"));
    if (value.review_version !== "1.0" || !Array.isArray(value.events) || value.events.length > 3000) throw new Error();
    const seen = new Set<string>(), reviews = new Set<string>();
    for (const e of value.events) { validateEvent(e); if (seen.has(e.event_id) || (e.action === "create" ? reviews.has(e.review_id) : !reviews.has(e.review_id))) throw new Error(); seen.add(e.event_id); reviews.add(e.review_id); }
    return value.events;
  } catch { throw new IngestError("Review history cannot be validated; preserve it for recovery.", 503); }
}
export function reviewWriteConfigured() { return !!path() && process.env.EMISSION_LENS_REVIEW_WRITE_ENABLED === "1" && (process.env.EMISSION_LENS_REVIEW_SESSION_SECRET?.length ?? 0) >= 32; }
export function read_reviews(input: { cameraId: string; mode: Mode; from?: string; to?: string; now?: Date }) {
  const window = read_measurement_window(input);
  const selected = events().filter(e => e.camera_id === input.cameraId && e.mode === input.mode && Date.parse(e.target.minute) >= Date.parse(window.from) && Date.parse(e.target.minute) < Date.parse(window.to));
  const items = new Map<string, ReviewItem>();
  for (const e of selected) items.set(e.review_id, { ...e, created_at: items.get(e.review_id)?.created_at ?? e.recorded_at, updated_at: e.recorded_at });
  const targets: ReviewTarget[] = window.minutes.map(m => ({kind:"measurement", reference:`measurement:${m.batch_id}`, minute:m.minute, evidence_ref:m.evidence_ref}));
  for (const row of get_traffic_window(input).rows) if (Date.parse(row.minute) >= Date.parse(window.from) && Date.parse(row.minute) < Date.parse(window.to) && !targets.some(t => Date.parse(t.minute) === Date.parse(row.minute))) targets.push({kind:"traffic",reference:`traffic:${input.cameraId}:${input.mode}:${new Date(row.minute).toISOString()}`,minute:new Date(row.minute).toISOString()});
  return { review_version: "1.0" as const, camera_id: input.cameraId, mode: input.mode, from: window.from, to: window.to, items: [...items.values()].reverse(), events: selected, targets, write_available: reviewWriteConfigured() };
}
function exact(value: unknown, keys: string[]) { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) throw new IngestError("Unsupported review fields.",400); return value as Record<string, any>; }
function safeTarget(raw: unknown, camera: string, mode: Mode, now: Date): ReviewTarget {
  const t = exact(raw,["kind","reference","minute","evidence_ref"]);
  if (typeof t.minute !== "string" || !Number.isFinite(Date.parse(t.minute))) throw new IngestError("A retained aggregate minute is required.",400);
  const at = Date.parse(t.minute), minute = new Date(at).toISOString();
  if (at % 60000 || at < now.getTime()-86400000 || at > now.getTime()) throw new IngestError("Review target is outside retained source time.",400);
  if (t.kind === "measurement") {
    const p = storePath();
    const e = p ? readSnapshot(p).measurement_batches?.find(e=>!e.source.retract && `measurement:${e.source.batch_id}`===t.reference && e.source.camera_id===camera && e.source.mode===mode && Date.parse(e.source.minute)===at && e.derived.evidence_ref===t.evidence_ref) : undefined;
    if (!e) throw new IngestError("This measurement generation changed or is unavailable. Refresh before reviewing.",409);
    return {kind:"measurement",reference:t.reference,minute,evidence_ref:e.derived.evidence_ref};
  }
  if (t.kind === "traffic" && t.reference===`traffic:${camera}:${mode}:${minute}` && trafficFor(mode).some(r=>r.camera_id===camera&&Date.parse(r.minute)===at)) return {kind:"traffic",reference:t.reference,minute};
  throw new IngestError("Unknown retained aggregate target.",400);
}
export function append_review(value: unknown, now = new Date()): ReviewEvent {
  const body = exact(value,["action","camera_id","mode","target","issue","note","author","review_id","state"]);
  if (!["Mert","Carter"].includes(body.author) || typeof body.note!=="string" || !body.note.trim() || body.note.length>2000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body.note)) throw new IngestError("Use a named reviewer and a note of 1–2000 characters.",400);
  const p=path(); if (!p) throw new IngestError("Review storage is not configured.",503);
  mkdirSync(dirname(p),{recursive:true,mode:0o700}); const lock=p+".lock"; let fd:number;
  try { fd=openSync(lock,"wx",0o600); } catch { throw new IngestError("Review history is busy; retry after refreshing.",503); }
  let temp: string|undefined;
  try {
    const prior=events(); if(prior.length>=3000) throw new IngestError("Review history capacity reached; preserve and archive it before continuing.",507);
    let event: ReviewEvent;
    if(body.action==="create") {
      if(!cameraById(body.camera_id)||!["live","replay","synthetic"].includes(body.mode)||!REVIEW_ISSUES.includes(body.issue)) throw new IngestError("Unknown camera, mode or review issue.",400);
      event={event_id:randomUUID(),review_id:randomUUID(),recorded_at:now.toISOString(),author:body.author,action:"create",camera_id:body.camera_id,mode:body.mode,target:safeTarget(body.target,body.camera_id,body.mode,now),issue:body.issue,note:body.note.trim(),state:"open"};
    } else if(body.action==="update") {
      const previous=[...prior].reverse().find(e=>e.review_id===body.review_id);
      if(!previous) throw new IngestError("Review item is not retained.",404);
      if(!REVIEW_STATES.includes(body.state)) throw new IngestError("Unsupported review state.",400);
      event={...previous,event_id:randomUUID(),recorded_at:now.toISOString(),author:body.author,action:"update",note:body.note.trim(),state:body.state};
    } else throw new IngestError("Unsupported review action.",400);
    validateEvent(event); const content=JSON.stringify({review_version:"1.0",events:[...prior,event]});
    if(Buffer.byteLength(content)>4*1024*1024) throw new IngestError("Review capacity reached.",507);
    temp=`${p}.${randomUUID()}.tmp`; const out=openSync(temp,"wx",0o600); try{writeFileSync(out,content);fsyncSync(out);}finally{closeSync(out);} renameSync(temp,p);temp=undefined;
    const dir=openSync(dirname(p),"r");try{fsyncSync(dir);}finally{closeSync(dir);}return event;
  } finally { if(temp&&existsSync(temp))unlinkSync(temp);closeSync(fd);unlinkSync(lock); }
}
