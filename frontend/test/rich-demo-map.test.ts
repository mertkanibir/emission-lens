import test from 'node:test';
import assert from 'node:assert/strict';
import {read_measurement_window} from '../../backend/src/measurements.ts';
import {latestSupportedMapEstimate} from '../src/lib/map-emissions.ts';
test('map examples require the explicit synthetic demo registry namespace',()=>{
 const before=process.env.EMISSION_LENS_SYNTHETIC_DEMO;process.env.EMISSION_LENS_SYNTHETIC_DEMO='rich';
 try{const view=read_measurement_window({cameraId:'222',mode:'synthetic'});assert.ok(latestSupportedMapEstimate(view)?.co2_g!>0);assert.equal(latestSupportedMapEstimate({...view,registry:{...view.registry,revision:'unrelated-registry'}}),null);assert.equal(latestSupportedMapEstimate({...view,mode:'live'}),null);}finally{if(before===undefined)delete process.env.EMISSION_LENS_SYNTHETIC_DEMO;else process.env.EMISSION_LENS_SYNTHETIC_DEMO=before;}
});
