from pathlib import Path
from datetime import datetime,timezone
from dataclasses import replace
import json,hashlib,time
import torch
from worker.metrics import CameraMetrics,MetricsConfig
from worker.detect import load_model,PRETRAINED_VEHICLE_LABELS
from worker.track import CameraTracker,TRACKING_MIN_CONFIDENCE
from worker.stream import Frame,MediaTimeSampler
from evaluation.check_counts import frames_between
root=Path.cwd();clip=root/'clip.ts';weights=Path.home()/'emission-lens/yolo11n.pt'
assert torch.cuda.is_available()
model=load_model(weights).to('cuda:0')
tracker=CameraTracker(labels=PRETRAINED_VEHICLE_LABELS,image_size=640,model=model)
configs={'Carter-drawing':json.loads((root/'config/cameras/222.measurement.json').read_text()),'separate-proposal':json.loads((root/'proposal.json').read_text())['proposal_config']}
metrics={name:CameraMetrics(replace(MetricsConfig.from_dict(raw),enabled=True,image_geometry_status='reviewed')) for name,raw in configs.items()}
events={name:[] for name in configs};sampler=MediaTimeSampler(5);n=0;begin=time.monotonic()
for t,image in frames_between(clip,0,141):
 if not sampler.should_keep(t):continue
 n+=1;frame=Frame('222',1,n,t,datetime.now(timezone.utc),image)
 vehicles=tracker.update(frame)
 for name,m in metrics.items():
  for e in m.update(frame,vehicles).crossings:
   events[name].append({'gate_id':e.gate_id,'direction':e.direction,'vehicle_class':e.vehicle_class,'confirmation_media_s':e.media_time_s})
assert model.predictor.results[0].boxes.data.is_cuda
report={'owner':'Mert','camera_id':'222','mode':'replay','job_id':__import__('os').environ['SLURM_JOB_ID'],'recorded_at_utc':datetime.now(timezone.utc).isoformat(),'clip_sha256':hashlib.sha256(clip.read_bytes()).hexdigest(),'weights_sha256':hashlib.sha256(weights.read_bytes()).hexdigest(),'model':'YOLO11n pretrained','image_size':640,'sample_fps':5,'confidence':TRACKING_MIN_CONFIDENCE,'tracker':'ByteTrack','torch':torch.__version__,'device':str(model.predictor.results[0].boxes.data.device),'gpu':torch.cuda.get_device_name(0),'processed_frames':n,'processing_wall_s':time.monotonic()-begin,'configs':configs,'events':events,'production_configs_modified':False,'execution_only_not_field_approval':True,'human_ground_truth':None,'count_error':None,'limitations':['Each metrics object uses an in-memory reviewed flag solely to exercise unvalidated drawings offline. Saved production configurations remain disabled/unvalidated.','Events use hysteresis confirmation time, not interpolated crossing time.','No independent human answer key, count accuracy, physical calibration or emissions evidence is established.','Per-gate events must not be summed as unique traffic flow.']}
(root/'runtime-check.json').write_text(json.dumps(report,indent=2)+'\n')
print('RESULT',n,report['device'],{k:len(v) for k,v in events.items()},flush=True)
