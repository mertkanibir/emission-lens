import test from "node:test";
import assert from "node:assert/strict";
import { preferredInvestigationWindow } from "../src/lib/preferred-window.ts";
import { crossingSummary } from "../src/lib/crossing-summary.ts";
import type { MeasurementWindowView } from "@emission-lens/backend";
const window = {camera_id:"222",mode:"live",from:"2026-11-08T13:00:00Z",to:"2026-11-08T14:00:00Z",registry:{state:"configured",physical_calibration_approved:true,calibration_version:"c1",mapping_versions:["m1"]},minutes:[{minute:"2026-11-08T13:58:00Z",state:"ready",calibration_version:"c1",mapping_version:"m1",emissions:[{camera_id:"222",mode:"live",minute:"2026-11-08T13:58:00Z",pollutant:"co2",estimate_g:2,quality_state:"ok"}]}]} as unknown as MeasurementWindowView;
test("the dated default selects only a recently completed supported minute",()=>{assert.deepEqual(preferredInvestigationWindow({},window),{from:"2026-11-08T13:58:00.000Z",to:"2026-11-08T13:59:00.000Z"});assert.deepEqual(preferredInvestigationWindow({}, {...window,to:"2026-11-08T14:30:00Z"}),{});});
test("explicit intervals and the reporting-hour choice always win",()=>{for(const q of [{from:"x",to:"y"},{window:""},{window:"invalid"},{from:"invalid"}])assert.equal(preferredInvestigationWindow(q,window),q);assert.deepEqual(preferredInvestigationWindow({}, {...window,mode:"synthetic"}),{});});
test("partial crossing subtotals retain their scope and never fill missing values",()=>{assert.deepEqual(crossingSummary([{count:5},{count:null},{count:0}]),{count:5,partial:true,label:"Known-class crossings"});assert.deepEqual(crossingSummary([]),{count:null,partial:false,label:"Line crossings"});assert.equal(crossingSummary([{count:null}]).count,null);assert.equal(crossingSummary([{count:0}]).count,0);});
