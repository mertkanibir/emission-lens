import type { Mode } from "@emission-lens/contracts";
import { get_factor_catalog_status } from "../../../emissions/src/index";
import { read_measurement_window } from "../../../backend/src/measurements";
import { loadRegistry } from "../../../backend/src/registry";

/** Safe scientific metadata only: registry paths and vehicle identities stay server-side. */
export function ScientificInputs(input:{cameraId:string;mode:Mode;from?:string;to?:string;now?:Date}){
  const catalog=get_factor_catalog_status(),window=read_measurement_window(input),registry=loadRegistry();
  const selectedCalibrations=new Set(window.minutes.map(m=>m.calibration_version));
  const calibrations=registry.document?.calibrations.filter(c=>c.camera_id===input.cameraId&&c.approval.status==="approved"&&c.approval.modes.includes(input.mode)&&(selectedCalibrations.has(c.version)||c.version===window.registry.calibration_version))??[];
  const selectedMappings=new Set(window.minutes.map(m=>m.mapping_version));
  const mappings=registry.document?.mappings.filter(m=>m.approval.status==="approved"&&m.approval.modes.includes(input.mode)&&(selectedMappings.size?selectedMappings.has(m.version):window.registry.mapping_versions.includes(m.version)))??[];
  const meteorology=[...new Set(window.minutes.map(m=>`${m.meteorology.temperature_f} °F / ${m.meteorology.relative_humidity_pct}% RH`))];
  const rows:Array<[string,string,string]>=[
    ["Factor model",catalog.model_version,"CARB EMFAC project-analysis export"],
    ["Geography / fleet year",`${catalog.region} · ${catalog.calendar_year} · ${catalog.season}`,"Annual regional assumptions"],
    ["Process / units",`${catalog.process} · ${catalog.units}`,"Tailpipe CO₂ and NOₓ; ordinary stops already included"],
    ["Factor table",`${catalog.validation.factor_rows.toLocaleString()} validated factors`,"12 categories × 18 speed bins × 3 temperature assumptions × 2 pollutants"],
    ["Movement distance",calibrations.flatMap(c=>c.movements.map(m=>`${m.movement_id}: fixed ${m.distance_m} m`)).join("; ")||"No approved movement available","Owner-approved fixed path assumption; independently surveyed scale and curved-path eligibility remain limited"],
    ["Retained calculation weather",meteorology.join("; ")||"No retained calculation input in this interval","Explicit factor assumptions; external weather below is contextual and does not replace them"],
    ["Factor speed selection","Per completed traversal · upper-edge 5 mph bins","Distance / total traversal time, including linked stops; support ends at 90 mph"],
    ["Metric camera scope",["222","223"].includes(input.cameraId)?`Camera ${input.cameraId}: accepted bounded metric path`:`Camera ${input.cameraId}: excluded from metric production`,"220 and 228 failed count screens; previews or registry presence do not enable their metrics"],
  ];
  return <details className="disclosure" open><summary>Emissions calculation input register</summary><p className="fine">{window.minutes.length} retained measurement snapshot{window.minutes.length===1?"":"s"} in this interval. These are the inputs behind supported estimates, separate from weather context.</p><div style={{overflowX:"auto"}}><table className="source-input-table" style={{width:"100%",borderCollapse:"collapse",fontSize:".84rem",textAlign:"left"}}><thead><tr><th scope="col">Input</th><th scope="col">Retained value / scope</th><th scope="col">Meaning</th></tr></thead><tbody>{rows.map(([label,value,meaning])=><tr key={label}><th scope="row" style={{padding:".7rem .6rem",verticalAlign:"top"}}>{label}</th><td style={{padding:".7rem .6rem",verticalAlign:"top"}}>{value}</td><td style={{padding:".7rem .6rem",verticalAlign:"top"}}>{meaning}</td></tr>)}</tbody></table></div>
    <details className="disclosure"><summary>Visual-to-CARB fleet mixtures</summary>{mappings.length?mappings.map(m=><div key={m.version}><p className="fine">{m.version} · {selectedMappings.size?"Referenced by selected records":"Configured assumption; no selected measurement references"}</p><ul className="limits">{Object.entries(m.mapping.classes).map(([label,weights])=><li key={label}><strong>{label}</strong>: {weights?.map(w=>`${(w.vmt_share*100).toFixed(2)}% ${w.emfac_class}`).join(" + ")}</li>)}</ul></div>):<p className="fine">No approved visual-to-CARB mixture is available.</p>}<p className="fine">VMT mixtures are modeling assumptions; visual labels do not establish regulatory weight class, fuel or model year. Unknown classes stay unmapped. No extra EV discount.</p></details>
    <p className="fine" style={{overflowWrap:"anywhere"}}>Factor version: {catalog.factor_version}. Retrieved {catalog.retrieved_at}. <a href={catalog.source_url} target="_blank" rel="noreferrer">Original CARB export</a>. Estimate ranges are not calculated; owner approval and reproducible arithmetic do not establish field accuracy.</p>
  </details>;
}
