import { cameraById, type Mode } from "../../contracts/src/index.ts";
import { asOf } from "./clock.ts";
import { visibleDerived } from "./measurement-core.ts";
import { IngestError, readSnapshotView, storePath } from "./persistence.ts";
import { loadRegistry } from "./registry.ts";
import { richSyntheticDemo, richSyntheticEnabled } from "./synthetic-demo.ts";
/** A dated navigation index, never a substitute for a requested reporting window. */
export function retained_measurement_minutes(input:{cameraId:string;mode:Mode;now?:Date}) {
  if(!cameraById(input.cameraId)||!["live","replay","synthetic"].includes(input.mode))throw new IngestError("Unknown camera or mode.",400);
  const p=storePath();
  const persisted=p?readSnapshotView(p):{schema_version:1 as const,next_sequence:0,batches:[],measurement_batches:[]};
  const demo=richSyntheticEnabled(input.mode)&&!(persisted.measurement_batches??[]).some(e=>e.source.mode==="synthetic")?richSyntheticDemo():null;
  const snapshot=demo?.snapshot??persisted,registry=demo?.registry??loadRegistry(),at=Date.parse(asOf(input.mode,input.now));
  return(snapshot.measurement_batches??[]).filter(e=>!e.source.retract&&e.source.camera_id===input.cameraId&&e.source.mode===input.mode&&Date.parse(e.source.minute)>=at-86400000&&Date.parse(e.source.minute)+60000<=at).map(e=>{
    const d=visibleDerived(e,snapshot,registry);return{minute:e.source.minute,from:e.source.minute,to:new Date(Date.parse(e.source.minute)+60000).toISOString(),supported:d.state==="ready"&&e.source.traversals.length>0,completed_count:d.state==="ready"?e.source.traversals.length:null};
  }).sort((a,b)=>Date.parse(b.minute)-Date.parse(a.minute)).slice(0,1440);
}
