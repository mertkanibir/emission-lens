import test from 'node:test';
import assert from 'node:assert/strict';
import {read_measurement_window} from '../../backend/src/measurements.ts';
import {latestSupportedMapEstimate,isRichSyntheticWindow,metricCameraEligible} from '../src/lib/map-emissions.ts';
test('all four map examples require the explicit synthetic demo registry namespace',()=>{
 const before=process.env.EMISSION_LENS_SYNTHETIC_DEMO;process.env.EMISSION_LENS_SYNTHETIC_DEMO='rich';
 try{for(const cameraId of ['222','223','220','228']){
  const view=read_measurement_window({cameraId,mode:'synthetic'});
  assert.ok(isRichSyntheticWindow(view));assert.ok(latestSupportedMapEstimate(view)?.co2_g!>0);
  assert.ok(metricCameraEligible(cameraId,'synthetic',isRichSyntheticWindow(view)));
  for(const altered of [ {...view,registry:{...view.registry,revision:'unrelated-registry'}}, {...view,registry:{...view.registry,calibration_version:'synthetic-demo-other'}}, {...view,registry:{...view.registry,physical_calibration_approved:false}}, {...view,mode:'live' as const}, {...view,mode:'replay' as const} ]) assert.equal(isRichSyntheticWindow(altered),false);
  assert.equal(latestSupportedMapEstimate({...view,registry:{...view.registry,revision:'unrelated-registry'}}),null);
 }}finally{if(before===undefined)delete process.env.EMISSION_LENS_SYNTHETIC_DEMO;else process.env.EMISSION_LENS_SYNTHETIC_DEMO=before;}
});
test('fictional eligibility never enables excluded real cameras or arbitrary synthetic inputs',()=>{
 for(const id of ['220','228']){for(const mode of ['live','replay'] as const)assert.equal(metricCameraEligible(id,mode,true),false);assert.equal(metricCameraEligible(id,'synthetic',false),false);assert.equal(metricCameraEligible(id,'synthetic',true),true);}
 assert.equal(metricCameraEligible('999','synthetic',true),false);
 for(const id of ['222','223'])for(const mode of ['live','replay','synthetic'] as const)assert.equal(metricCameraEligible(id,mode,false),true);
});

test('camera 220/228 examples explain that real quantitative processing remains excluded', async()=>{
 const before=process.env.EMISSION_LENS_SYNTHETIC_DEMO;process.env.EMISSION_LENS_SYNTHETIC_DEMO='rich';
 try{
  const {createElement}=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');
  const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);const cssLoader=require.extensions['.css'];require.extensions['.css']=()=>{};
  let CameraDetail: typeof import('../src/components/CameraDetail.tsx').CameraDetail;try{({CameraDetail}=await import('../src/components/CameraDetail.tsx'));}finally{if(cssLoader)require.extensions['.css']=cssLoader;else delete require.extensions['.css'];}
  for(const id of ['220','228']){
   const html=renderToStaticMarkup(createElement(CameraDetail,{id,query:{mode:'synthetic'},embedded:true}));
   assert.match(html,/Fictional demonstration only/);assert.match(html,/remains excluded from quantitative processing/);assert.match(html,/Labeled sample estimates/);assert.doesNotMatch(html,/<strong>Metric camera excluded/);
  }
 }finally{if(before===undefined)delete process.env.EMISSION_LENS_SYNTHETIC_DEMO;else process.env.EMISSION_LENS_SYNTHETIC_DEMO=before;}
});
