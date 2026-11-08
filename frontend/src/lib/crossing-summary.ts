/** A partial known-class subtotal is never presented as a complete traffic total. */
export function crossingSummary(rows:readonly {count:number|null}[]){
 const known=rows.filter(row=>typeof row.count==="number"&&Number.isFinite(row.count)&&row.count>=0);
 return {count:known.length?known.reduce((sum,row)=>sum+row.count!,0):null,partial:known.length<rows.length,label:known.length<rows.length?"Known-class crossings":"Line crossings"};
}

/** Match compact map labels to the subtotal used by the register and overview. */
export function crossingMapLabel(rows:readonly {count:number|null}[]){
 const view=crossingSummary(rows);
 return view.count===null?"Collecting crossing records":`${view.count.toLocaleString("en-US")} ${view.partial?"known-class crossings":"crossings"}`;
}
