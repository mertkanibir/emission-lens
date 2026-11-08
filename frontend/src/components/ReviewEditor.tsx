"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { read_reviews } from "../../../backend/src/reviews";
type View=ReturnType<typeof read_reviews>;
export function ReviewEditor({initial,query}:{initial:View;query:string}){
  const router=useRouter(),[view,setView]=useState(initial),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  async function save(event:React.FormEvent<HTMLFormElement>,reviewId?:string){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setBusy(true);setMessage("Saving review…");try{
    const session=await fetch("/api/reviews/session",{method:"POST",credentials:"same-origin"});const s=await session.json();if(!session.ok)throw new Error(s.error??"Local review editing unavailable.");
    const payload=reviewId?{action:"update",review_id:reviewId,state:data.get("state"),note:data.get("note"),author:data.get("author")}:{action:"create",camera_id:view.camera_id,mode:view.mode,target:view.targets[Number(data.get("target"))],issue:data.get("issue"),note:data.get("note"),author:data.get("author")};
    const response=await fetch("/api/reviews",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-CSRF-Token":s.csrf},body:JSON.stringify(payload)});const result=await response.json();if(!response.ok)throw new Error(result.error??"Review could not be saved.");
    const updated=await fetch("/api/reviews?"+query,{cache:"no-store"});if(updated.ok)setView(await updated.json());form.reset();setMessage("Review saved to durable history. Original measurements are unchanged.");router.refresh();
  }catch(e){setMessage(e instanceof Error?e.message:"Review could not be saved.");}finally{setBusy(false);}}
  const author=(id:string)=><div className="field"><label className="field-label" htmlFor={id}>Reviewer</label><select id={id} name="author"><option>Mert</option><option>Carter</option></select></div>;
  return <div className="stack"><p className="fine">{view.items.length} review item{view.items.length===1?"":"s"} in this camera, mode and interval. Notes preserve original evidence; resolving an item does not approve calibration or alter calculations.</p>
    {!view.write_available?<p className="context-note">Editing is disabled for this server. Existing audit history remains readable.</p>:view.targets.length?<form className="form-grid" onSubmit={e=>save(e)}>
      <div className="field"><label className="field-label" htmlFor="review-target">Evidence minute</label><select id="review-target" name="target">{view.targets.map((t,i)=><option key={t.reference} value={i}>{t.minute} · {t.kind}</option>)}</select></div>
      <div className="field"><label className="field-label" htmlFor="review-issue">Issue</label><select id="review-issue" name="issue"><option value="coverage">Incomplete observations</option><option value="classification">Vehicle classification</option><option value="camera_view">Camera view / calibration</option><option value="timing">Timing</option><option value="other">Other evidence question</option></select></div>
      {author("review-author")}<div className="field"><label className="field-label" htmlFor="review-note">Review note</label><textarea id="review-note" name="note" required maxLength={2000} rows={3} placeholder="Describe the evidence issue and what should be checked."/></div><button className="button button-primary" disabled={busy}>Record review</button>
    </form>:<p className="context-note">No retained aggregate targets in this interval. Select a dated retained minute to review earlier evidence.</p>}
    <p role="status" aria-live="polite" className="fine">{message}</p>
    {view.items.map(item=><article key={item.review_id} className="context-note"><p><strong>{item.issue.replaceAll("_"," ")}</strong> · {item.state}</p><p>{item.note}</p><p className="fine">{item.target.minute} UTC · {item.author} · updated {item.updated_at}</p>
      <details className="disclosure"><summary>Original reference and audit history</summary><p className="fine" style={{overflowWrap:"anywhere"}}>{item.target.reference}{item.target.evidence_ref?` · derivation ${item.target.evidence_ref}`:""}</p><ol className="limits">{view.events.filter(e=>e.review_id===item.review_id).map(e=><li key={e.event_id}>{e.recorded_at} · {e.author} · {e.state}: {e.note}</li>)}</ol></details>
      {view.write_available?<form className="form-grid" onSubmit={e=>save(e,item.review_id)}><div className="field"><label className="field-label" htmlFor={`state-${item.review_id}`}>Next state</label><select name="state" id={`state-${item.review_id}`} defaultValue={item.state}><option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option></select></div>{author(`author-${item.review_id}`)}<div className="field"><label className="field-label" htmlFor={`note-${item.review_id}`}>Add an audit note</label><textarea id={`note-${item.review_id}`} name="note" rows={2} required maxLength={2000}/></div><button className="button" disabled={busy}>Save state and note</button></form>:null}
    </article>)}
  </div>;
}
