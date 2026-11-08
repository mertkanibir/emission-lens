import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { richSyntheticDemo,richSyntheticEnabled } from '../src/synthetic-demo.ts';
import { read_measurement_window } from '../src/measurements.ts';
import { get_traffic_window,get_emissions_window } from '../src/queries.ts';
import { retained_measurement_minutes } from '../src/retained.ts';
import { validateStoredMeasurement } from '../src/measurement-core.ts';

test('the rich demo has sixty complete minutes per eligible camera and uses validated calculation records',()=>{
 const d=richSyntheticDemo();assert.equal(d.snapshot.measurement_batches!.length,240);
 for(const entry of d.snapshot.measurement_batches!){validateStoredMeasurement(entry);assert.equal(entry.source.mode,'synthetic');assert.equal(entry.derived.state,'ready');assert.ok(entry.source.traversals.length>0);}
 assert.equal(d.store.traffic.length,960);assert.equal(d.store.emissions.length,480);
 assert.ok(d.registry.document!.calibrations.every(x=>x.approval.modes.join()==='synthetic'));
 assert.ok(d.registry.document!.mappings.every(x=>x.approval.modes.join()==='synthetic'));
});

test('rich synthetic scenarios and interval navigation remain isolated from persisted live/replay data',()=>{
 const keys=['EMISSION_LENS_SYNTHETIC_DEMO','EMISSION_LENS_STORE_PATH','EMISSION_LENS_REGISTRY_PATH'];const old=keys.map(k=>process.env[k]);const dir=mkdtempSync(join(tmpdir(),'rich-demo-'));const path=join(dir,'store.json');
 writeFileSync(path,JSON.stringify({schema_version:1,next_sequence:0,batches:[]}));const before=readFileSync(path,'utf8');
 process.env.EMISSION_LENS_SYNTHETIC_DEMO='rich';process.env.EMISSION_LENS_STORE_PATH=path;delete process.env.EMISSION_LENS_REGISTRY_PATH;
 try{
  assert.equal(richSyntheticEnabled('live'),false);assert.equal(richSyntheticEnabled('replay'),false);
  for(const cameraId of ['222','223','220','228']){
   const view=read_measurement_window({cameraId,mode:'synthetic',stoppedTimeReductionPct:30});assert.equal(view.minutes.length,60);assert.equal(view.registry.physical_calibration_approved,true);assert.equal(view.scenario.available,true);assert.ok(view.scenario.completed_cohort.count!>1000);assert.ok(view.scenario.pollutants.co2.baseline_g!>0);assert.notEqual(view.scenario.pollutants.co2.change_g,0);
   assert.equal(get_traffic_window({cameraId,mode:'synthetic'}).rows.length,240);assert.ok(get_emissions_window({cameraId,mode:'synthetic'}).estimate_g_by_pollutant.co2!>0);assert.equal(retained_measurement_minutes({cameraId,mode:'synthetic'}).length,60);
   const selected=read_measurement_window({cameraId,mode:'synthetic',from:'2026-11-07T19:55:00Z',to:'2026-11-07T20:00:00Z',stoppedTimeReductionPct:0});assert.equal(selected.minutes.length,5);assert.equal(selected.scenario.pollutants.co2.change_g,0);assert.equal(selected.scenario.completed_cohort.baseline.distance_m,selected.scenario.completed_cohort.scenario.distance_m);
   for(const mode of ['live','replay'] as const){assert.equal(get_traffic_window({cameraId,mode}).rows.length,0);assert.equal(get_emissions_window({cameraId,mode}).rows.length,0);assert.equal(read_measurement_window({cameraId,mode}).minutes.length,0);}
  }
  assert.equal(readFileSync(path,'utf8'),before);
  assert.equal(new Set(richSyntheticDemo().snapshot.measurement_batches!.map(x=>x.source.batch_id)).size,240);
  assert.equal(new Set(['222','223','220','228'].map(cameraId=>get_traffic_window({cameraId,mode:'synthetic'}).totals.count)).size,4);
 }finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i]});rmSync(dir,{recursive:true,force:true});}
});
