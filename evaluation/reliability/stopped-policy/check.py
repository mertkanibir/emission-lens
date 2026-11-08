"""Mert's isolated CPU acceptance of Carter's exact stopped-time attachment.

Controlled trajectories and an injected missing prior are software evidence only.
The approved registry and policy bytes are copied unchanged; no video accuracy
or positive real stopped cohort is established by these checks.
"""
from datetime import datetime,timedelta,timezone
import argparse,copy,hashlib,json,math,os,secrets,shutil,subprocess,sys
from pathlib import Path
from types import SimpleNamespace
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import uuid
ROOT=Path(__file__).resolve().parents[3];sys.path.insert(0,str(ROOT))
from worker.metrics import MetricsConfig,CameraMetrics
from worker.aggregate import MinuteAggregator
from worker.publish import TraversalBridge,Outbox,HttpSender


def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write(path,value):
 path=Path(path);path.write_text(json.dumps(value,indent=2,allow_nan=False)+'\n');path.chmod(0o600)


def run_case(out,policy,geometry,registry,kind):
 directory=out/kind;directory.mkdir(mode=0o700)
 token=secrets.token_urlsafe(40)
 env={k:v for k,v in os.environ.items() if not k.startswith('EMISSION_LENS_')}
 env.update(EMISSION_LENS_REGISTRY_PATH=str(registry),EMISSION_LENS_STORE_PATH=str(directory/'store.json'),EMISSION_LENS_WORKER_TOKEN=token)
 server=None;log=(directory/'server.private.log').open('w')
 def start():
  process=subprocess.Popen(['node','--import','tsx','backend/scripts/222-handoff-server.ts'],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=log,text=True)
  ready=process.stdout.readline();assert ready,'Isolated server readiness failed'
  return process,'http://127.0.0.1:'+str(json.loads(ready)['port'])
 def stop(process):
  if process and process.poll() is None:process.terminate();process.wait(timeout=10)
  if process:process.stdout.close()
 try:
  server,base=start()
  def request(path,payload=None,auth=False):
   body=None if payload is None else json.dumps(payload,separators=(',',':'),allow_nan=False).encode()
   headers={'Content-Type':'application/json'}
   if auth:headers['Authorization']='Bearer '+token
   try:
    with urlopen(Request(base+path,data=body,headers=headers),timeout=15) as response:return response.status,json.load(response)
   except HTTPError as error:return error.code,json.load(error)
  anchor=datetime.now(timezone.utc).replace(second=0,microsecond=0)-timedelta(minutes=2)
  run={'run_id':str(uuid.uuid4()),'model_version':'controlled-software-only|v:'+sha(out/'policy.json')[:16],'device':'cpu-controlled-no-inference','started_at':anchor.isoformat(),'ended_at':None,'mode':'replay'}
  config=MetricsConfig.from_dict(geometry);metrics=CameraMetrics(config);aggregate=MinuteAggregator(config,run['run_id'],'replay','count-1',frozenset({'car'}))
  worker=Outbox(directory/'new-outbox',HttpSender(base+'/api/worker',token))
  measurements=Outbox(directory/'new-outbox/measurements',HttpSender(base+'/api/measurements',token))
  bridge=TraversalBridge.from_config(policy,config,run,measurements.directory/'bridge.checkpoint')
  hold_frames=17 if kind=='known-stop-bin-change' else 16
  ys=[.78,.72,.66,.60,.54,.52]+([.52]*hold_frames if kind!='known-zero' else [])+[.46,.40,.34,.28,.25]
  for index,y in enumerate(ys):
   t=index*.2
   frame=SimpleNamespace(camera_id='222',session=1,sequence=index+1,media_time_s=t,received_at=anchor+timedelta(seconds=t),image=SimpleNamespace(shape=(720,1280,3)))
   vehicles=[SimpleNamespace(track_id=121212,label='car',detection=SimpleNamespace(x1=.64*1280,y1=(y-.04)*720,x2=.66*1280,y2=y*720))]
   # Explicit software missing-observation control: remove the classifier's
   # previous image point while retaining the producer's existing trajectory.
   if kind=='partial-unknown' and index==9:bridge._positions.pop(121212,None)
   aggregate.observe(frame,metrics.update(frame,vehicles));bridge.observe(frame,vehicles)
  batches=aggregate.batches(run)
  for batch in batches:worker.enqueue(batch)
  assert worker.flush(limit=256)==len(batches) and not worker.pending()
  bridge.publish(run,batches,measurements)
  exact=[json.loads(path.read_bytes()) for path in measurements.pending()]
  traversals=[t for batch in exact for t in batch['traversals']]
  assert len(traversals)==1
  t=traversals[0];stopped=t['stopped_time_s'];duration=t['traversal_time_s']
  if kind.startswith('known-stop'):assert stopped is not None and 0<stopped<=duration
  elif kind=='known-zero':assert stopped==0
  else:assert stopped is None
  assert measurements.flush(limit=256)==len(exact) and not measurements.pending()
  status,view=request('/api/measurements?camera=222&mode=replay');assert status==200
  cohort=view['scenario']['completed_cohort'];assert cohort['count']==1
  for pollutant,row in view['scenario']['pollutants'].items():
   assert row['baseline_g'] is not None and row['baseline_g']>0
   if stopped is None:assert row['scenario_g'] is None
   else:assert row['scenario_g'] is not None and row['scenario_g']>0
   if stopped==0:assert row['scenario_g']==row['baseline_g'] and row['change_g']==0
  # The source's stopped component belongs to the exact completed traversal,
  # not the separate aggregate minute stopped-seconds observation.
  assert cohort['baseline']['stopped_time_s']==stopped
  if stopped is not None:
   assert math.isclose(cohort['scenario']['traversal_time_s'],duration-.2*stopped,rel_tol=1e-10,abs_tol=1e-6)
   assert math.isclose(cohort['scenario']['stopped_time_s'],.8*stopped,rel_tol=1e-10,abs_tol=1e-6)
  else:assert cohort['scenario']['traversal_time_s'] is None
  assert request('/api/measurements/evidence?reference='+view['evidence_refs'][0])[0]==401
  code,evidence=request('/api/measurements/evidence?reference='+view['evidence_refs'][0],auth=True);assert code==200
  assert evidence['source']['traversals'][0]['stopped_time_s']==stopped
  assert evidence['source']['observation_ref']=={'batch_id':batches[0]['batch_id'],'revision':batches[0]['revision']}
  assert all(minute['state']=='ready' for minute in view['minutes'])
  # Independent arithmetic directly from the source g/vehicle-mile grid and
  # approved VMT mixture: distance scaling only, with no extra idle quantity.
  catalog=json.loads((ROOT/'emissions/data/la-2026/factors.json').read_text());assert catalog['process']=='RUNEX'
  approved=evidence['approved_input'];distance=approved['traversals'][0]['distance_m'];mixture=approved['class_mapping']['classes']['car']
  def oracle(pollutant,seconds):
   speed_mph=distance/seconds*3600/1609.344;speed_bin=math.ceil(speed_mph/5)*5
   rate=0.
   for item in mixture:
    factor=next(row for row in catalog['factors'] if row['vehicle_class']==item['emfac_class'] and row['pollutant']==pollutant and row['speed_bin_mph']==speed_bin and row['temperature_f']==policy['meteorology']['temperature_f'] and row['relative_humidity_pct']==policy['meteorology']['relative_humidity_pct'])
    rate+=item['vmt_share']*factor['source_g_per_vehicle_mile']
   return rate*distance/1609.344
  for pollutant,row in view['scenario']['pollutants'].items():
   assert math.isclose(row['baseline_g'],oracle(pollutant,duration),rel_tol=1e-10,abs_tol=1e-12)
   if stopped is not None:assert math.isclose(row['scenario_g'],oracle(pollutant,duration-.2*stopped),rel_tol=1e-10,abs_tol=1e-12)
  if kind=='known-stop-bin-change':assert any(row['change_g']!=0 for row in view['scenario']['pollutants'].values())
  assert request('/api/222-read?mode=live')[1]['traffic']['rows']==[]
  # Exact retry cannot increase traffic, stopped time or estimated grams.
  snapshot_before_retry=sha(directory/'store.json')
  for payload in exact:
   code,receipt=request('/api/measurements',payload,True);assert code==200 and receipt['duplicate']
  retry_view=request('/api/measurements?camera=222&mode=replay')[1]
  assert retry_view['minutes']==view['minutes'] and retry_view['scenario']==view['scenario']
  # Malformed linked stop totals must reject the whole batch without mutation.
  original=sha(directory/'store.json')
  for bad in [duration+.001,-.1]:
   payload=copy.deepcopy(exact[0]);payload['batch_id']=str(uuid.uuid4());payload['traversals'][0]['stopped_time_s']=bad
   assert request('/api/measurements',payload,True)[0]==400 and sha(directory/'store.json')==original
  broken=copy.deepcopy(exact[0]);broken['revision']+=1;broken['observation_ref']['batch_id']=str(uuid.uuid4())
  code,receipt=request('/api/measurements',broken,True);assert code==202 and receipt['state']=='unavailable'
  missing=request('/api/measurements?camera=222&mode=replay')[1]
  assert all(row['baseline_g'] is None and row['scenario_g'] is None for row in missing['scenario']['pollutants'].values())
  restored=copy.deepcopy(exact[0]);restored['revision']+=2
  assert request('/api/measurements',restored,True)[0]==202
  code,receipt=request('/api/measurements',restored,True);assert code==200 and receipt['duplicate']
  linked=request('/api/measurements?camera=222&mode=replay')[1]
  assert linked['scenario']['pollutants']==view['scenario']['pollutants']
  assert linked['scenario']['completed_cohort']==view['scenario']['completed_cohort']
  write(directory/'linkage-controls.private.json',{'broken':broken,'restored':restored})
  # Revoking this private copy's calibration approval withholds estimates;
  # then restore exact source bytes before the durable reload comparison.
  registry_bytes=registry.read_bytes();doc=json.loads(registry_bytes)
  selected=next(c for c in doc['calibrations'] if c['camera_id']=='222' and c['version']==policy['calibration_version'])
  selected['approval']['modes']=[m for m in selected['approval']['modes'] if m!='replay'];write(registry,doc)
  revoked=request('/api/measurements?camera=222&mode=replay')[1]
  assert all(row['baseline_g'] is None and row['scenario_g'] is None for row in revoked['scenario']['pollutants'].values())
  registry.write_bytes(registry_bytes)
  before=request('/api/measurements?camera=222&mode=replay')[1];write(directory/'before-reload.private.json',before)
  snapshot=sha(directory/'store.json');stop(server);server=None;server,base=start()
  after=request('/api/measurements?camera=222&mode=replay')[1];write(directory/'after-reload.private.json',after)
  assert all(before[k]==after[k] for k in ['minutes','registry','scenario','evidence_refs']) and sha(directory/'store.json')==snapshot
  write(directory/'wire-batches.private.json',exact)
  result={'kind':kind,'software_controlled_not_video':True,'completed_traversals':1,'stopped_time_s':stopped,'traversal_time_s':duration,
   'independent_runex_only_oracle_pass':True,'missing_link_withheld_then_revision_restored':True,'zero_or_null_preserved':True,'stop_not_greater_than_duration':True,'exact_idempotency':True,'invalid_totals_http400_no_mutation':True,
   'private_approval_scope_revocation_withholds':True,'private_evidence_authenticated':True,'live_rows':0,'durable_reload_equal':True,
   'pollutants':view['scenario']['pollutants'],'snapshot_sha256':snapshot,'source_policy_unchanged':sha(out/'policy.json')}
  write(directory/'result.private.json',result);return result
 finally:stop(server);log.close()


def main():
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--policy',type=Path,required=True);parser.add_argument('--geometry',type=Path,required=True);parser.add_argument('--registry',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args()
 out=args.out.resolve();assert out.is_relative_to(ROOT/'runs/reliability') and not out.exists();out.mkdir(parents=True,mode=0o700)
 inputs={'policy.json':args.policy,'geometry.json':args.geometry,'registry.json':args.registry};source_hashes={name:sha(path) for name,path in inputs.items()}
 assert source_hashes['policy.json']=='6ffbac2983c8f2d465b2495a3d2238aaa7fd7c679776277b69f71ac607234b36'
 for name,path in inputs.items():shutil.copyfile(path,out/name);(out/name).chmod(0o600)
 policy=json.loads((out/'policy.json').read_text());geometry=json.loads((out/'geometry.json').read_text())
 assert policy['context_version']=='222-context-v1-7f52d53d+stop-v1'
 assert policy['stop_observation']['image_displacement_per_s']==.0225 and policy['stop_observation']['method_version']=='222-image-stop-v1-0.0225'
 results=[run_case(out,policy,geometry,out/'registry.json',kind) for kind in ['known-stop','known-stop-bin-change','known-zero','partial-unknown']]
 assert all(sha(out/name)==digest for name,digest in source_hashes.items())
 summary={'owner':'Mert','checked_at_utc':datetime.now(timezone.utc).isoformat(),'check':'actual_222_stop_v1_policy_controlled_cpu_http_e2e',
  'policy_source_hashes':source_hashes,'literal_threshold_preserved':.0225,'context':policy['context_version'],'method':policy['stop_observation']['method_version'],
  'results':results,'all_checks_pass':True,'new_gpu_job':False,'production_changed':False,'independent_stop_accuracy':None,
  'limits':['Controlled software trajectories, not actual video/detector evidence or independent accuracy.','Known-stop effect is a hypothetical recalculation; real positive stopped cohorts are not promised.','Partial case explicitly injects a missing prior image position as a software control.','Registry approves calibration/mapping by source time/mode/version; stop method authority is Carter attachment and its run configuration hash, not a new dedicated registry field.','No separate idle process or engine-running inference.']}
 write(out/'result.private.json',summary);print(json.dumps(summary,indent=2))
if __name__=='__main__':main()
