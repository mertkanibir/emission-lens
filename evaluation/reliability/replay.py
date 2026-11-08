"""Mert's single-job replay driver; execution requires prior GPU coordination.

Inputs, queue bodies and temporary IDs are private. No new source acquisition,
training, scientific approval, model tuning, or live-store access occurs here.
"""
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run():
    root=Path.cwd()
    recipe=json.loads((root/'recipe.private.json').read_text())
    for name,digest in recipe['source_sha256'].items():
        assert sha(root/name)==digest,name
    for name,digest in recipe['inputs_sha256'].items():
        assert sha(Path(name))==digest,name
    assert os.environ.get('SLURM_JOB_ID'), 'Use the coordinated bounded allocation.'
    token=(root/'token.private').read_text().strip()
    env={**os.environ,'EMISSION_LENS_WORKER_TOKEN':token,
         'EMISSION_LENS_INGEST_URL':'http://127.0.0.1:53221/api/worker',
         'EMISSION_LENS_MEASUREMENT_URL':'http://127.0.0.1:53221/api/measurements'}
    # This login hop belongs only to this job; terminating it leaves other relays intact.
    relay=subprocess.Popen(['ssh','-N','-o','BatchMode=yes','-o','ExitOnForwardFailure=yes',
                            '-o','ControlPath=none','-o','ControlMaster=no','-o','ConnectTimeout=8',
                            '-L','127.0.0.1:53221:127.0.0.1:53221','alpha1'])
    process=None
    try:
        time.sleep(1)
        assert relay.poll() is None,'Independent compute relay failed.'
        command=[sys.executable,'-m','worker.main','--camera','222','--weights',recipe['weights'],
                 '--device','0','--require-cuda','--image-size','640','--fps','15','--seconds','100',
                 '--publish-every','5','--preview-every','0','--replay-file',recipe['clip'],
                 '--measurement-config',str(root/'geometry.json'),'--count-gate-id','count-1',
                 '--traversal-config',str(root/'traversals.json'),'--outbox',str(root/'outbox'),
                 '--output',str(root/'runtime.private.json'),'--require-delivery']
        with (root/'worker.private.log').open('w') as log:
            process=subprocess.Popen(command,env=env,stdout=log,stderr=log)
            deadline=time.monotonic()+60
            while time.monotonic()<deadline:
                paths=list((root/'outbox').glob('*.json'))+list((root/'outbox'/'measurements').glob('*.json'))
                if len(paths)>=6: break
                assert process.poll() is None,'Worker exited before outage evidence.'
                time.sleep(.5)
            assert len(paths)>=6,'No bounded outage queue evidence.'
            captures=root/'outage-captured';captures.mkdir(mode=0o700)
            evidence=[]
            for path in sorted(paths):
                body=path.read_bytes();payload=json.loads(body)
                target=captures/str(path.relative_to(root/'outbox')).replace('/','_')
                target.write_bytes(body)
                evidence.append({'path':str(path.relative_to(root)),'sha256':hashlib.sha256(body).hexdigest(),
                                 'batch_id':payload['batch_id'],'revision':payload['revision']})
            time.sleep(3)
            assert all(sha(root/row['path'])==row['sha256'] for row in evidence)
            (root/'outage-ready.private.json').write_text(json.dumps({'queued':evidence,'at':datetime.now(timezone.utc).isoformat()}))
            code=process.wait(timeout=180)
        assert code==0,'Worker failed; preserve private log and queued batches.'
        runtime=json.loads((root/'runtime.private.json').read_text())
        assert runtime['run']['mode']=='replay' and runtime['run']['ended_at']
        assert runtime['run']['device']=='cuda:0', 'Actual CUDA inference is required.'
        assert runtime['delivery']['enabled'] and runtime['measurement_delivery']['enabled']
        assert runtime['delivery']['pending_batches']==0 and runtime['measurement_delivery']['pending_batches']==0
        (root/'job-result.private.json').write_text(json.dumps({'job_id':os.environ['SLURM_JOB_ID'],
            'queued_at_outage':len(evidence),'runtime_sha256':sha(root/'runtime.private.json'),
            'source_recipe_sha256':sha(root/'recipe.private.json'),'worker_exit':code,
            'ended_at':datetime.now(timezone.utc).isoformat()}))
    finally:
        if process and process.poll() is None:
            process.terminate()
            try: process.wait(timeout=30)
            except subprocess.TimeoutExpired: process.kill();process.wait(timeout=5)
        relay.terminate()
        try: relay.wait(timeout=5)
        except subprocess.TimeoutExpired: relay.kill();relay.wait(timeout=5)
        (root/'token.private').unlink(missing_ok=True)
        (root/'cleanup.private.json').write_text(json.dumps({'relay_closed':relay.poll() is not None,
            'worker_stopped':process is None or process.poll() is not None,'token_removed':not (root/'token.private').exists()}))


def main():
    def interrupted(signum, _frame):
        # Unwind the run's finally: forward termination to the worker, wait for
        # its graceful publication, stop only our relay, then retire the token.
        raise SystemExit(128+signum)
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    try:
        run()
    finally:
        # Covers input/source preflight failures before relay creation as well.
        (Path.cwd()/'token.private').unlink(missing_ok=True)


if __name__=='__main__':main()
