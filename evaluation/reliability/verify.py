"""Verify private replay receipts, durable reload and safe scalar conclusions."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import time
from urllib.request import urlopen


def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory',type=Path,required=True)
    args=parser.parse_args();directory=args.directory.resolve()
    if '/runs/reliability/' not in str(directory): parser.error('Use private reliability evidence.')
    connection=json.loads((directory/'connection.private.json').read_text())
    def read(path):
        with urlopen(connection['url']+path,timeout=15) as response:return json.load(response)
    runtime=json.loads((directory/'runtime.private.json').read_text())
    job=json.loads((directory/'job-result.private.json').read_text())
    captured=json.loads((directory/'outage-ready.private.json').read_text())['queued']
    events=json.loads((directory/'events.private.json').read_text())
    posts=[e for e in events if e['body_sha256']]
    assert any(e['status']==503 for e in posts),'No actual outage HTTP requests.'
    for queued in captured:
        assert any(e['body_sha256']==queued['sha256'] and e['status'] in [200,202] for e in posts), 'A captured queued body lacks a successful receipt.'
    dropped=[e for e in posts if e.get('dropped_ack')]
    assert len(dropped)==1
    assert any(e['body_sha256']==dropped[0]['body_sha256'] and e.get('duplicate') for e in posts)
    assert all(e['status'] in [200,202,503] for e in posts),'Unexpected runtime rejection.'
    before=read('/api/measurements?camera=222&mode=replay');summary=read('/read?mode=replay')
    live=read('/read?mode=live')
    assert live['traffic']['rows']==[] and live['emissions']['rows']==[]
    assert summary['status']['state']=='offline' and summary['status']['displayed_state']=='offline'
    assert runtime['run']['mode']=='replay' and runtime['run']['device']=='cuda:0'
    assert runtime['delivery']['enabled'] and runtime['measurement_delivery']['enabled']
    assert runtime['delivery']['pending_batches']==runtime['measurement_delivery']['pending_batches']==0
    count=sum(runtime['measurements']['selected_gate_crossings_by_class'].values())
    assert summary['traffic']['totals']['count']==count and count>0
    traversals=before['scenario']['completed_cohort']['count']
    assert traversals==runtime['completed_traversals']['completed_traversals'] and traversals>0
    snapshot=json.loads((directory/'store.json').read_text())
    active=[row for row in snapshot['measurement_batches'] if not row['source']['retract']]
    identities=[(t['session_id'],t['traversal_id']) for row in active for t in row['source']['traversals']]
    assert len(identities)==len(set(identities))==traversals, 'Completed evidence duplicated or missing.'
    contribution_totals={pollutant:0.0 for pollutant in ['co2','nox']}
    for entry in active:
        calculation=entry['derived']['calculation']
        for pollutant in contribution_totals:
            rows=[row for row in entry['derived']['emissions'] if row['pollutant']==pollutant and row['quality_state']=='ok']
            if rows:
                contribution=sum(item[pollutant+'_g'] for item in calculation['evidence'])
                assert math.isclose(contribution,rows[0]['estimate_g'],rel_tol=1e-12,abs_tol=1e-12)
                contribution_totals[pollutant]+=contribution
    assert all(e['range_low_g'] is None and e['range_high_g'] is None for minute in before['minutes'] for e in minute['emissions'])
    for name,value in [('before.private.json',before),('summary.private.json',summary)]:
        (directory/name).write_text(json.dumps(value,indent=2))
    snapshot_sha=sha(directory/'store.json')
    provenance=json.loads((directory/'provenance.private.json').read_text())
    root=Path(__file__).resolve().parents[2]
    for name,digest in provenance['source_sha256'].items():
        if name.startswith(('backend/src/','contracts/src/','emissions/src/')) or name=='evaluation/reliability/server.ts':
            assert sha(root/name)==digest, 'Backend source changed before reload: '+name
    (directory/'restarted.json').unlink(missing_ok=True)
    (directory/'restart').touch()
    for _ in range(100):
        if (directory/'restarted.json').exists():break
        time.sleep(.2)
    assert (directory/'restarted.json').exists(),'Isolated backend restart did not complete.'
    after=read('/api/measurements?camera=222&mode=replay');after_summary=read('/read?mode=replay')
    assert all(after[key]==before[key] for key in ['minutes','registry','scenario','evidence_refs'])
    # Reporting-window envelope timestamps advance with the read clock.
    # Compare persisted rows/totals and their supported estimate semantics.
    assert all({k:v for k,v in after_summary[section].items() if k not in ['from','to']}==
               {k:v for k,v in summary[section].items() if k not in ['from','to']}
               for section in ['traffic','emissions'])
    assert sha(directory/'store.json')==snapshot_sha
    supported={pollutant:sum(e['estimate_g'] for minute in before['minutes'] for e in minute['emissions'] if e['pollutant']==pollutant and e['quality_state']=='ok') for pollutant in ['co2','nox']}
    assert all(value>0 for value in supported.values())
    assert all(math.isclose(supported[p],contribution_totals[p],rel_tol=1e-12,abs_tol=1e-12) for p in supported)
    result={'owner':'Mert','checked_at_utc':datetime.now(timezone.utc).isoformat(),'job_id':job['job_id'],
            'status':'bounded_delivery_recovery_passed_with_abrupt_status_gap',
            'replay_seconds':runtime['settings']['duration_s'],'actual_device':runtime['run']['device'],
            'processed_frames':runtime['cameras']['222']['processed_frames'],
            'buffer_drops':runtime['cameras']['222']['reader_frames_dropped'],
            'queued_exact_batches_during_outage':len(captured),'http_503_requests':sum(e['status']==503 for e in posts),
            'captured_bodies_successfully_delivered':len(captured),'dropped_acknowledgements':len(dropped),
            'duplicate_receipts':sum(e.get('duplicate') is True for e in posts),
            'crossings':count,'completed_traversals':traversals,
            'unique_completed_evidence_matches_runtime':True,
            'per_traversal_emission_arithmetic_checked':True,
            'supported_minute_estimated_g_only':supported,'whole_window_estimated_g':summary['emissions']['estimate_g_by_pollutant'],
            'legacy_delivery':runtime['delivery'],'measurement_delivery':runtime['measurement_delivery'],
            'live_traffic_rows':0,'live_emissions_rows':0,'backend_reload_records_equal':True,
            'snapshot_bytes_unchanged_on_reload':True,'graceful_status':'offline','abrupt_122s_controlled_status':'degraded',
            'abrupt_offline_acceptance':False,'source_capture_utc_available':False,
            'hashes':{'runtime':sha(directory/'runtime.private.json'),'queue_capture':sha(directory/'outage-ready.private.json'),
                      'events':sha(directory/'events.private.json'),'snapshot':snapshot_sha,'recipe':sha(directory/'runtime'/'recipe.private.json')},
            'limitations':['Bounded replay delivery, not field accuracy or continuous loss-free performance.',
                          'Controlled publication omission tests stale status; abrupt mid-inference termination was not performed.',
                          'Supported-minute sums omit insufficient-evidence minutes; they are not full-window totals.',
                          'Carter approvals retain assumption-based scale/fleet/weather limits; no additional scientific validation.',
                          'No source-stream outage, disk-full/power-loss or shared-host persistence test.']}
    (directory/'verified.private.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
