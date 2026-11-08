import assert from "node:assert/strict";
import test from "node:test";
import { isNewPreview, medianPreviewInterval, parseSelectedPreview, type ProcessedPreview } from "../src/lib/preview-cadence.ts";
const now = Date.parse("2026-11-08T13:00:10Z");
const frame: ProcessedPreview = { camera_id: "222", mode: "live", run_id: "one", session: 1, sequence: 1, received_at: "2026-11-08T13:00:00Z", processed_at: "2026-11-08T13:00:01Z", image_data_url: "data:image/jpeg;base64,/9j/2Q==" };
test("preview timing preserves the camera/mode boundary and rejects expired or future frames",()=>{
  assert.equal(parseSelectedPreview(frame,"222","live",now),frame);
  for (const bad of [{...frame,camera_id:"223"},{...frame,mode:"replay"},{...frame,received_at:"2026-11-08T12:58:00Z"},{...frame,processed_at:"2026-11-08T13:01:00Z"}]) assert.throws(()=>parseSelectedPreview(bad,"222","live",now));
  assert.throws(()=>parseSelectedPreview(frame,"222","synthetic",now));
});
test("duplicate and out-of-order delivery never become new displayed frames or frame-rate samples",()=>{
  assert.equal(isNewPreview(frame,null),true);
  assert.equal(isNewPreview({...frame},frame),false);
  assert.equal(isNewPreview({...frame,sequence:2,processed_at:"2026-11-08T13:00:00Z"},frame),false);
  assert.equal(isNewPreview({...frame,sequence:2,processed_at:"2026-11-08T13:00:04Z"},frame),true);
  assert.equal(isNewPreview({...frame,run_id:"two",processed_at:"2026-11-08T13:00:04Z"},frame),true);
  assert.equal(isNewPreview({...frame,session:2,processed_at:"2026-11-08T13:00:04Z"},frame),true);
});
test("observed snapshot cadence uses recent positive intervals, not poll attempts",()=>{
  assert.equal(medianPreviewInterval([]),null);
  assert.equal(medianPreviewInterval([0,-1,NaN]),null);
  assert.equal(medianPreviewInterval([3,3.2,2.8]),3);
  assert.equal(medianPreviewInterval([100,3,3,3,3,3,3]),3);
});
