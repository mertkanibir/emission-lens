"use client";
import { useEffect, useRef, useState } from "react";

/** Deep links reveal their section; routine refreshes retain the reader's choice. */
export function WorkspaceDisclosure({id,title,summary,eyebrow,children,className="",defaultOpen=false}:{id:string;title:string;summary?:string;eyebrow?:string;children:React.ReactNode;className?:string;defaultOpen?:boolean}){
 const [open,setOpen]=useState(defaultOpen);const ref=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{const reveal=()=>{const target=document.getElementById(decodeURIComponent(window.location.hash.slice(1)));if(target&&(target===ref.current||ref.current?.contains(target)))setOpen(true);};reveal();window.addEventListener("hashchange",reveal);return()=>window.removeEventListener("hashchange",reveal);},[]);
 return <details id={id} ref={ref} className={`workspace-disclosure ${className}`} open={open} onToggle={event=>setOpen(event.currentTarget.open)}><summary><div>{eyebrow?<span className="section-kicker">{eyebrow}</span>:null}<h2>{title}</h2>{summary?<p>{summary}</p>:null}</div><span className="workspace-disclosure-action" aria-hidden="true">{open?"Collapse":"Explore"}<i/></span></summary><div className="workspace-disclosure-content">{children}</div></details>;
}
