import assert from "node:assert/strict";
import test from "node:test";
import type { TrafficMinute } from "@emission-lens/contracts";
import type { MeasurementWindowView } from "@emission-lens/backend";
import { evidenceAnalytics } from "../src/lib/evidence-analytics.ts";

function window(): MeasurementWindowView {
  return {
    camera_id:"222",mode:"live",from:"2026-11-08T13:00:00Z",to:"2026-11-08T13:04:00Z",
    registry:{state:"configured",revision:"analytics-test",calibration_version:"c1",mapping_versions:["m1"],physical_calibration_approved:true},
    minutes:[],evidence_refs:[],limitations:[],
    scenario:{available:false,pollutants:{co2:{baseline_g:null,scenario_g:null,change_g:null,change_pct:null},nox:{baseline_g:null,scenario_g:null,change_g:null,change_pct:null}},completed_cohort:{count:null,baseline:{distance_m:null,traversal_time_s:null,stopped_time_s:null},scenario:{distance_m:null,traversal_time_s:null,stopped_time_s:null}},evidence_refs:[],assumptions:[],limitations:[]}
  };
}
function traffic(overrides:Partial<TrafficMinute>={}):TrafficMinute {
  return {camera_id:"222",mode:"live",run_id:"analytics-test",minute:"2026-11-08T13:00:00Z",vehicle_class:"car",count:4,completed_traversals:null,stopped_vehicle_seconds:null,traversal_time_s:null,distance_m:null,queue_count:null,queue_length_m:null,coverage:null,...overrides};
}
function snapshot(minute:string, grams:number|null, count:number|null):MeasurementWindowView["minutes"][number] {
  return {minute,batch_id:"analytics-fixture",revision:0,state:"ready",reasons:[],timing_basis:"estimated_hls_media_utc",meteorology:{temperature_f:70,relative_humidity_pct:60},calibration_version:"c1",mapping_version:"m1",evidence_ref:"analytics-reference",traffic:[],completed_cohort:{count,stopped_time_s:0},emissions:[{camera_id:"222",mode:"live",minute,pollutant:"co2",estimate_g:grams,range_low_g:null,range_high_g:null,factor_version:"f1",method_version:"method1",quality_state:grams===null?"insufficient_evidence":"ok"}]};
}

test("minute anchors preserve missing records, supported zero and mixed observation coverage",()=>{
  const w=window();w.minutes=[snapshot("2026-11-08T13:00:00Z",0,1),snapshot("2026-11-08T13:02:00Z",null,null)];
  const a=evidenceAnalytics(w,[traffic({count:0}),traffic({minute:"2026-11-08T13:02:00Z",count:null})]);
  assert.equal(a.requested_minutes,4);assert.equal(a.recorded_minutes,2);assert.equal(a.supported_minutes,1);
  assert.deepEqual(a.slots.map(r=>[r.recorded,r.count,r.co2_g]),[[true,0,0],[false,null,null],[true,null,null],[false,null,null]]);
  assert.equal(a.observed_crossings,null);assert.equal(a.co2_per_completed_vehicle_g,0);
});

test("intensity is a ratio of summed same-snapshot grams and cohort vehicles, never an average of minute ratios",()=>{
  const w=window();w.minutes=[snapshot("2026-11-08T13:00:00Z",10,1),snapshot("2026-11-08T13:01:00Z",90,9),snapshot("2026-11-08T13:02:00Z",500,null)];
  const a=evidenceAnalytics(w,[traffic({count:100})]);
  assert.equal(a.supported_minutes,3);assert.equal(a.cohort_minutes,2);assert.equal(a.cohort_vehicles,10);assert.equal(a.co2_per_completed_vehicle_g,10);
  assert.equal(a.observed_crossings,100);
});

test("equivalent UTC measurement duplicates suppress support instead of selecting or double counting",()=>{
  const w=window();w.minutes=[snapshot("2026-11-08T13:00:00Z",10,2),snapshot("2026-11-08T13:00:00+00:00",10,2)];
  const rows=[traffic({count:2}),traffic({minute:"2026-11-08T13:00:00.000Z",vehicle_class:"truck",count:3})];
  const before=structuredClone(rows);const a=evidenceAnalytics(w,rows);
  assert.equal(a.recorded_minutes,1);assert.equal(a.slots[0].count,5);assert.equal(a.supported_minutes,0);assert.equal(a.co2_per_completed_vehicle_g,null);assert.deepEqual(rows,before);
});

test("camera, mode and half-open boundaries remain isolated; class composition uses the selected records",()=>{
  const w=window();w.minutes=[snapshot(w.to,100,2)];
  const a=evidenceAnalytics(w,[traffic({count:2}),traffic({vehicle_class:"truck",count:3}),traffic({mode:"replay",count:80}),traffic({camera_id:"223",count:90}),traffic({minute:w.to,count:100}),traffic({minute:"2026-11-08T12:59:00Z",count:200})]);
  assert.equal(a.observed_crossings,5);assert.equal(a.recorded_minutes,1);assert.equal(a.supported_minutes,0);assert.deepEqual(a.classes.map(c=>[c.vehicle_class,c.count]),[["truck",3],["car",2]]);
});

test("unapproved versions, duplicate pollutant rows, missing cohorts and excluded cameras do not gain physical analytics",()=>{
  for(const mutate of [
    (w:MeasurementWindowView)=>{w.registry.physical_calibration_approved=false;},
    (w:MeasurementWindowView)=>{w.minutes[0].mapping_version="other";},
    (w:MeasurementWindowView)=>{w.minutes[0].calibration_version="other";},
    (w:MeasurementWindowView)=>{w.minutes[0].emissions.push({...w.minutes[0].emissions[0]});},
    (w:MeasurementWindowView)=>{w.minutes[0].emissions[0].estimate_g=-1;},
  ]){const w=window();w.minutes=[snapshot(w.from,10,2)];mutate(w);const a=evidenceAnalytics(w,[]);assert.equal(a.supported_minutes,0);assert.equal(a.co2_per_completed_vehicle_g,null);}
  const w=window();w.camera_id="228";const a=evidenceAnalytics(w,[traffic({camera_id:"228"})]);assert.equal(a.eligible,false);assert.equal(a.recorded_minutes,0);assert.equal(a.co2_per_completed_vehicle_g,null);
});

test("invalid and oversized intervals fail explicitly, and non-minute reporting-hour boundaries use exact eligible anchors",()=>{
  const w=window();for(const patch of [{from:"bad"},{to:w.from},{to:"2026-11-10T13:00:00Z"}])assert.throws(()=>evidenceAnalytics({...w,...patch},[]),RangeError);
  const a=evidenceAnalytics({...w,from:"2026-11-08T13:00:20Z",to:"2026-11-08T14:00:20Z"},[traffic(),traffic({minute:"2026-11-08T13:01:00Z"})]);assert.equal(a.requested_minutes,60);assert.equal(a.slots[0].minute,"2026-11-08T13:01:00.000Z");assert.equal(a.recorded_minutes,1);
});
