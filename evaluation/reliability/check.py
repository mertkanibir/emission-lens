"""Mert's bounded isolated delivery acceptance. Private artifacts stay in runs/.

Controlled trajectories exercise real producer/publisher/HTTP/backend code, but
are software evidence rather than camera accuracy. --serve supports separately
coordinated replay: switch control.json between outage/open/drop_ack.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timedelta, timezone
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from types import SimpleNamespace
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from worker.aggregate import MinuteAggregator
from worker.metrics import CameraMetrics, MetricsConfig
from worker.publish import HttpSender, Outbox, TraversalBridge, PublishError


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def write(path, value):
    temporary = Path(str(path) + '.tmp')
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + '\n')
    temporary.chmod(0o600)
    temporary.replace(path)


class Isolated:
    def __init__(self, directory, profile, port=0):
        self.directory = directory.resolve()
        self.directory.mkdir(parents=True, mode=0o700)
        self.directory.chmod(0o700)
        for name in ['registry.json', 'geometry.json', 'traversals.json']:
            shutil.copyfile(profile / name, self.directory / name)
            (self.directory / name).chmod(0o600)
        self.token = secrets.token_urlsafe(40)
        self.env = {**os.environ, 'EMISSION_LENS_WORKER_TOKEN': self.token,
                    'EMISSION_LENS_STORE_PATH': str(self.directory / 'store.json'),
                    'EMISSION_LENS_REGISTRY_PATH': str(self.directory / 'registry.json')}
        self.log = (self.directory / 'backend.log').open('w')
        self.backend = None
        self.start_backend()
        self.events = []
        self.lock = threading.RLock()
        self.control('open')
        owner = self

        class Proxy(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                self.forward()

            def do_POST(self):
                self.forward()

            def forward(self):
                body = self.rfile.read(int(self.headers.get('Content-Length', 0))) if self.command == 'POST' else None
                payload = json.loads(body) if body else {}
                with owner.lock:
                    mode = json.loads((owner.directory / 'control.json').read_text())['mode']
                    event = {'at': datetime.now(timezone.utc).isoformat(), 'path': self.path,
                             'body_sha256': hashlib.sha256(body).hexdigest() if body else None,
                             'batch_id': payload.get('batch_id'), 'revision': payload.get('revision')}
                    if mode == 'outage' and self.command == 'POST':
                        code, response = 503, b'{"error":"controlled delivery outage"}'
                    else:
                        headers = {'Content-Type':'application/json'}
                        if self.headers.get('Authorization'):
                            headers['Authorization'] = self.headers['Authorization']
                        try:
                            with urlopen(Request(owner.base + self.path, data=body, headers=headers), timeout=10) as reply:
                                code, response = reply.status, reply.read()
                        except HTTPError as error:
                            code, response = error.code, error.read()
                        receipt = json.loads(response)
                        event['duplicate'] = receipt.get('duplicate')
                        if mode == 'drop_ack' and self.command == 'POST' and code in [200,202]:
                            owner.control('open')
                            event.update(status=code, dropped_ack=True)
                            owner.events.append(event)
                            write(owner.directory / 'events.private.json', owner.events)
                            self.connection.shutdown(socket.SHUT_RDWR)
                            self.connection.close()
                            return
                    event['status'] = code
                    owner.events.append(event)
                    write(owner.directory / 'events.private.json', owner.events)
                self.send_response(code)
                self.send_header('Content-Type','application/json')
                self.send_header('Content-Length', str(len(response)))
                self.end_headers()
                self.wfile.write(response)

        self.proxy = ThreadingHTTPServer(('127.0.0.1', port), Proxy)
        self.url = 'http://127.0.0.1:' + str(self.proxy.server_port)
        self.thread = threading.Thread(target=self.proxy.serve_forever, daemon=True)
        self.thread.start()
        write(self.directory / 'connection.private.json', {'url':self.url, 'token':self.token})
        write(self.directory / 'provenance.private.json', {
            'started_at_utc':datetime.now(timezone.utc).isoformat(),
            'git_commit':subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(),
            'profile_sha256':{name:sha(self.directory/name) for name in ['registry.json','geometry.json','traversals.json']},
            'source_sha256':{str(p.relative_to(ROOT)):sha(p) for parent in ['worker','backend/src','contracts/src','emissions/src','evaluation/reliability']
                             for p in (ROOT/parent).glob('**/*') if p.suffix in ['.py','.ts']}})

    def control(self, mode):
        write(self.directory / 'control.json', {'mode':mode})

    def start_backend(self):
        self.backend = subprocess.Popen(['node','--import','tsx','evaluation/reliability/server.ts'], cwd=ROOT,
                                        env=self.env, stdout=subprocess.PIPE, stderr=self.log, text=True)
        line = self.backend.stdout.readline()
        if not line:
            raise RuntimeError('Isolated backend did not become ready.')
        self.base = 'http://127.0.0.1:' + str(json.loads(line)['port'])

    def stop_backend(self):
        if self.backend and self.backend.poll() is None:
            self.backend.terminate()
            self.backend.wait(timeout=10)
        if self.backend:
            self.backend.stdout.close()

    def restart(self):
        with self.lock:
            self.stop_backend()
            self.start_backend()

    def read(self, path):
        with urlopen(self.base + path, timeout=10) as response:
            return json.load(response)

    def close(self):
        self.proxy.shutdown()
        self.proxy.server_close()
        self.thread.join(timeout=5)
        self.stop_backend()
        self.log.close()


def controlled(check):
    directory = check.directory
    anchor = datetime.now(timezone.utc).replace(second=0, microsecond=0) - timedelta(minutes=2)
    run = {'run_id':str(uuid.uuid4()), 'model_version':'controlled-only|t:hls-min-anchor-v1',
           'device':'controlled-no-inference', 'started_at':anchor.isoformat(), 'ended_at':None, 'mode':'replay'}
    config = MetricsConfig.from_dict(json.loads((directory/'geometry.json').read_text()))
    metrics = CameraMetrics(config)
    aggregate = MinuteAggregator(config, run['run_id'], 'replay', 'count-1', frozenset({'car'}))
    worker = Outbox(directory/'outbox', HttpSender(check.url+'/api/worker', check.token))
    measurements = Outbox(directory/'outbox'/'measurements', HttpSender(check.url+'/api/measurements', check.token))
    bridge = TraversalBridge.from_config(json.loads((directory/'traversals.json').read_text()), config, run,
                                         measurements.directory/'bridge.checkpoint')
    for index,y in enumerate([.78,.69,.62,.52,.43,.30,.25]):
        media=index*.2
        frame=SimpleNamespace(camera_id='222',session=1,sequence=index+1,media_time_s=media,
                              received_at=anchor+timedelta(seconds=media),image=SimpleNamespace(shape=(720,1280,3)))
        vehicles=[SimpleNamespace(track_id=121212,label='car',detection=SimpleNamespace(x1=.64*1280,y1=(y-.04)*720,x2=.66*1280,y2=y*720))]
        aggregate.observe(frame,metrics.update(frame,vehicles)); bridge.observe(frame,vehicles)
    batches=aggregate.batches(run)
    check.control('outage')
    for batch in batches: worker.enqueue(batch)
    bridge.publish(run,batches,measurements)
    exact={str(p.relative_to(directory)):sha(p) for box in [worker,measurements] for p in box.pending()}
    assert len(exact)>=2
    assert worker.flush(limit=256)==0 and measurements.flush(limit=256)==0
    assert all(sha(directory/p)==digest for p,digest in exact.items())
    assert not (directory/'store.json').exists()
    # New publisher instances resume the exact on-disk bytes after an outage.
    worker=Outbox(worker.directory,worker.sender); measurements=Outbox(measurements.directory,measurements.sender)
    check.control('drop_ack')
    assert worker.flush(limit=256)==0 and worker.pending()
    assert worker.flush(limit=256)>0
    measurements.flush(limit=256)
    assert not worker.pending() and not measurements.pending()
    view=check.read('/api/measurements?camera=222&mode=replay')
    before=check.read('/read?mode=replay')
    assert before['traffic']['totals']['count']==1
    assert view['scenario']['completed_cohort']['count']==1
    assert all(value>0 for value in before['emissions']['estimate_g_by_pollutant'].values())
    snapshot_sha=sha(directory/'store.json')
    check.restart()
    after=check.read('/api/measurements?camera=222&mode=replay')
    assert all(after[key]==view[key] for key in ['minutes','registry','scenario','evidence_refs'])
    assert sha(directory/'store.json')==snapshot_sha
    assert check.read('/read?mode=live')['traffic']['rows']==[]
    # A new overlapping run must fail closed and preserve its queued evidence.
    overlap=json.loads(json.dumps(batches[0])); overlap['batch_id']=str(uuid.uuid4())
    overlap['run']['run_id']=str(uuid.uuid4())
    for row in overlap['traffic']: row['run_id']=overlap['run']['run_id']
    rejected=Outbox(directory/'expected-overlap',worker.sender); rejected.enqueue(overlap)
    try:
        rejected.flush()
        raise AssertionError('Expected overlapping run rejection.')
    except PublishError as error:
        assert '409' in str(error)
    assert rejected.pending() and sha(directory/'store.json')==snapshot_sha
    heartbeat=datetime.now(timezone.utc).isoformat()
    status={'camera_id':'222','heartbeat_at':heartbeat,'last_source_timestamp':None,'processing_delay_ms':None,'fps':15,'state':'live','mode':'replay'}
    worker.enqueue({'contract_version':'1.1','batch_id':str(uuid.uuid4()),'revision':0,'run':run,'statuses':[status],'traffic':[],'emissions':[]})
    worker.flush()
    assert check.read('/read?mode=replay')['status']['displayed_state']=='live'
    # No final publication models abrupt loss; the read clock ages naturally.
    start=time.monotonic()
    write(directory/'abrupt-wait.private.json',{'heartbeat':heartbeat,'wait_seconds':122})
    while time.monotonic()-start<122: time.sleep(1)
    stale=check.read('/read?mode=replay')['status']
    assert stale['state']=='live' and stale['displayed_state']=='degraded'
    run['ended_at']=datetime.now(timezone.utc).isoformat(); status['state']='offline'
    worker.enqueue({'contract_version':'1.1','batch_id':str(uuid.uuid4()),'revision':0,'run':run,'statuses':[status],'traffic':[],'emissions':[]})
    worker.flush()
    assert check.read('/read?mode=replay')['status']['displayed_state']=='offline'
    result={'owner':'Mert','kind':'controlled_trajectory_not_video','queued_exact_batches':len(exact),
            'outage_http_503':True,'publisher_restart_exact_bytes':True,'lost_ack_duplicate_receipts':sum(e.get('duplicate') is True for e in check.events),
            'count':1,'completed_traversals':1,'backend_restart_evidence_equal':True,'live_rows':0,
            'expected_overlap_http_409_retained':True,'abrupt_after_122s':'degraded','graceful':'offline',
            'abrupt_offline_not_implemented':True,'finished_at_utc':datetime.now(timezone.utc).isoformat()}
    write(directory/'result.private.json',result)
    print(json.dumps(result),flush=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile',type=Path,required=True)
    parser.add_argument('--directory',type=Path,required=True)
    parser.add_argument('--port',type=int,default=0)
    parser.add_argument('--serve',action='store_true')
    args=parser.parse_args()
    if not args.directory.resolve().is_relative_to(ROOT/'runs'/'reliability'):
        parser.error('Use a new private runs/reliability directory.')
    if args.directory.exists(): parser.error('Refusing to reuse an existing evidence directory.')
    check=Isolated(args.directory,args.profile,args.port)
    try:
        if args.serve:
            print(json.dumps({'port':check.proxy.server_port,'ready':True}),flush=True)
            deadline=time.monotonic()+600
            while time.monotonic()<deadline and not (check.directory/'stop').exists():
                if (check.directory/'restart').exists():
                    check.restart(); (check.directory/'restart').unlink(); write(check.directory/'restarted.json',{'at':datetime.now(timezone.utc).isoformat()})
                time.sleep(.2)
        else: controlled(check)
    finally: check.close()


if __name__=='__main__': main()
