"""Synthetic review invariants; no real answer keys or footage loaded."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import shutil

from evaluation.video_validation import review as r


def events(times, direction="positive"):
    return [{"id":f"e{i:04}","clip_time_s":t,"gate":"g","direction":direction,
             "visual_class":"unknown","uncertainty":"clear","evidence":[1]} for i,t in enumerate(times)]


class VideoValidationTests(unittest.TestCase):
    def fixture(self,tmp):
        key=r.make_key("223","c",[0,2],"g")
        seq={"key":key,"camera_id":"223","clip_sha256":"c","geometry_sha256":"g", "window":[0,2],
             "gate":"g","review_version":r.VERSION,"sheets":[{"file":"sheet-1.jpg"}],"frames":[{}],
             "sample_fps":5,"source_gaps":[]}
        ledger={k:seq[k] for k in ("key","camera_id","clip_sha256","geometry_sha256","window","gate","review_version")}
        ledger.update(review_method="assisted_visual_sequence_review",human_confirmed=False,counting_rule=r.COUNTING_RULE,
                      reviewed_sheets=["sheet-1.jpg"],coverage_status="complete_assisted_sequence",events=events([1]),limitations=[])
        lp,sp=Path(tmp)/"ledger.json",Path(tmp)/"sequence.json"
        r.write_private(lp,ledger);r.write_private(sp,seq)
        return r.freeze(lp,sp),ledger,seq

    def test_crowded_matching_maximizes_pairs_and_retains_legacy(self):
        result=r.match(events([0,2]),events([1.1,3.1]),[0,4],"g")
        self.assertEqual(result["tp"],2)
        self.assertEqual(result["legacy_closest_first_tp"],1)
        self.assertEqual(result["recall"],1)

    def test_direction_and_simultaneous_distinct_events(self):
        a=events([1,1,2])
        b=events([1,1]) + [{**events([2],"negative")[0],"id":"e0002"}]
        result=r.match(a,b,[0,3],"g")
        self.assertEqual((result["tp"],result["fp"],result["fn"]),(2,1,1))
        self.assertEqual(result["direction_error"],{"positive":-1,"negative":1})

    def test_minimum_cost_and_deterministic_ties(self):
        result=r.match(events([1,2]),events([.9,1.9,2.9]),[0,4],"g")
        self.assertEqual([p["observed_id"] for p in result["pairs"]],["e0000","e0001"])
        self.assertEqual(result,r.match(events([1,2]),events([.9,1.9,2.9]),[0,4],"g"))

    def test_half_open_boundaries_and_strict_types(self):
        r.validate_events(events([0,1.999]),[0,2],"g")
        for t in (2,-.001,float("nan"),float("inf"),"1:00",True):
            with self.subTest(t=t), self.assertRaises(ValueError):
                r.validate_events(events([t]),[0,2],"g")
        with self.assertRaises(ValueError):
            r.window([1,1])

    def test_privacy_and_duplicate_identity(self):
        with self.assertRaises(ValueError):
            r.validate_events([{**events([1])[0],"plate":"forbidden"}],[0,2],"g")
        with self.assertRaises(ValueError):
            r.validate_events(events([1])+events([1]),[0,2],"g")
        with self.assertRaises(ValueError):
            r.private_path(r.ROOT/"evaluation/frames.json")

    def test_semantic_geometry_hash_preserves_line_ending_independence(self):
        config={"camera_id":"223","gates":[{"id":"g","start":[0,0],"end":[1,1],"direction":"both"}],
                "road_region":[[0,0],[1,0],[1,1]],"excluded_regions":[]}
        pretty=json.dumps(config,indent=2)
        self.assertEqual(r.geometry_fingerprint(json.loads(pretty),"g"),r.geometry_fingerprint(json.loads(pretty.replace("\n","\r\n")),"g"))
        old=r.geometry_fingerprint(config,"g")
        config["hysteresis"]=.02
        self.assertNotEqual(old,r.geometry_fingerprint(config,"g"))
        for config_sha in ("clip","geometry","version"):
            base=["223","clip",[60,180],"geometry","version"]
            changed=base.copy()
            changed[base.index(config_sha)]=config_sha+"-changed"
            self.assertNotEqual(r.make_key(*base),r.make_key(*changed))

    def test_missing_clip_is_not_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(FileNotFoundError):
                r.file_sha(Path(tmp)/"missing.ts")

    def test_reserved_segment_cannot_be_rendered_or_overlapped(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(r,'PRIVATE',Path(tmp)):
            r.write_private(Path(tmp)/'reservations/r.json',{'camera_id':'228','clip_sha256':'c','window':[720,840],'status':'reserved_unviewed'})
            r.ensure_unreserved('228','c',[600,720])
            r.ensure_unreserved('228','c',[840,900])
            for bounds in ([720,840],[719,721],[839,841]):
                with self.assertRaisesRegex(ValueError,'reserved'):
                    r.ensure_unreserved('228','c',bounds)
            r.ensure_unreserved('223','c',[720,840])

    def test_manual_endpoint_annotations_are_flagged_not_coerced(self):
        interior,flagged,legacy=r.parse_manual_annotations('6:02.4 -\n6:02.4 -\n7:60.0 +\n7:60.0 +',[360,480],'g')
        self.assertEqual(len(interior),2)
        self.assertEqual(len(flagged),2)
        self.assertNotEqual(interior[0]['id'],interior[1]['id'])
        self.assertEqual([e['clip_time_s'] for e in legacy],[362.4,362.4,480,480])
        for text in ('7:61 +','6:99.0 +','nan +','5:59 +','6:10 ?'):
            with self.subTest(text=text),self.assertRaises(ValueError):
                r.parse_manual_annotations(text,[360,480],'g')

    def test_totals_only_and_missing_human_reference_never_get_event_metrics(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(r,"PRIVATE",Path(tmp)):
            frozen,ledger,_=self.fixture(tmp)
            base={k:ledger[k] for k in ("camera_id","clip_sha256","geometry_sha256","window","gate")}
            model={**base,"source":"model","events":[{k:v for k,v in events([1.1])[0].items() if k in ('id','clip_time_s','gate','direction')}],"total":1}
            human={**base,"source":"carter_human","events":None,"total":2}
            mp,hp=Path(tmp)/"model.json",Path(tmp)/"human.json"
            r.write_private(mp,model);r.write_private(hp,human)
            result=json.loads(r.compare(frozen,hp,mp).read_text())
            self.assertIsNone(result['comparisons']['carter_human_vs_model']['recall'])
            self.assertEqual(result['comparisons']['carter_human_vs_model']['relative_total_error'],-.5)
            self.assertFalse(result['automatic_camera_enablement'])

    def test_missing_human_compare_and_geometry_mismatch(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(r,"PRIVATE",Path(tmp)):
            frozen,ledger,_=self.fixture(tmp)
            base={k:ledger[k] for k in ("camera_id","clip_sha256","geometry_sha256","window","gate")}
            model={**base,"source":"model","events":events([1]),"total":1}
            mp=Path(tmp)/"model.json";r.write_private(mp,model)
            result=json.loads(r.compare(frozen,None,mp).read_text())
            self.assertEqual(result['human_reference_status'],'pending_not_supplied')
            self.assertIsNone(result['comparisons']['carter_human_vs_model']['precision'])
            model['geometry_sha256']='changed';r.write_private(mp,model)
            with self.assertRaises(ValueError):r.compare(frozen,None,mp)

    def test_invalid_freeze_blocks_reference_open(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(r,"PRIVATE",Path(tmp)):
            frozen,_,_=self.fixture(tmp)
            value=json.loads(frozen.read_text());value['ledger']['human_confirmed']=True;r.write_private(frozen,value)
            with self.assertRaisesRegex(ValueError,'modified'):
                r.compare(frozen,Path(tmp)/'missing-reference',Path(tmp)/'missing-model')

    def test_post_reference_revision_preserves_original_and_cannot_claim_blind(self):
        with tempfile.TemporaryDirectory() as tmp,patch.object(r,'PRIVATE',Path(tmp)):
            original,ledger,_=self.fixture(tmp)
            before=r.file_sha(original)
            evidence=Path(tmp)/'adjudication.json';r.write_private(evidence,{'reason':'independently inspected adjacent frames'})
            change={'original_ledger_sha256':r.digest(ledger),'adjudication_path':str(evidence),
                    'remove_ids':['e0000'],'add_events':[{**events([1.1])[0],'id':'e0001'}],'reason':'Replace explicitly unsupported candidate with supported passage'}
            cp=Path(tmp)/'changes.json';r.write_private(cp,change)
            revised=r.revise(original,cp)
            self.assertEqual(before,r.file_sha(original))
            self.assertTrue(r.verify_freeze(revised)['references_opened_before_freeze'])
            model={k:ledger[k] for k in ('camera_id','clip_sha256','geometry_sha256','window','gate')}
            model.update(source='model',events=events([1.1]),total=1)
            mp=Path(tmp)/'model.json';r.write_private(mp,model)
            result=json.loads(r.compare(revised,None,mp).read_text())
            self.assertFalse(result['reference_independent'])
            self.assertEqual(result['review_phase'],'post_reference_adjudication')
            self.assertFalse(result['human_confirmed'])

    def test_superseded_ledger_is_retained_but_blocked_from_comparison(self):
        with tempfile.TemporaryDirectory() as tmp,patch.object(r,'PRIVATE',Path(tmp)):
            original,ledger,_=self.fixture(tmp)
            corrected=json.loads(original.read_text())
            corrected['ledger']['limitations']=['Explicit transcription correction']
            corrected['ledger_sha256']=r.digest(corrected['ledger'])
            cp=Path(tmp)/'corrected.json';r.write_private(cp,corrected)
            r.register_supersession(original,cp,'Unsupported exact copied tail block')
            self.assertTrue(original.exists())
            with self.assertRaisesRegex(ValueError,'superseded'):
                r.compare(original,Path(tmp)/'unopened-key',Path(tmp)/'unopened-model')
            self.assertEqual(r.require_current_freeze(cp)['ledger_sha256'],corrected['ledger_sha256'])

    def test_real_error_shape_repeated_21_event_tail_is_flagged(self):
        first=events([1+i*.01 for i in range(21)])
        copied=[{**event,'id':f'e{i+21:04}'} for i,event in enumerate(first)]
        audit=r.audit_event_order_and_repeats(first+copied)
        self.assertFalse(audit['chronological'])
        self.assertEqual(audit['suspicious_repeated_blocks'][0]['length'],21)
        # Equal timestamps by themselves remain distinct observations.
        self.assertTrue(r.audit_event_order_and_repeats(events([1,1]))['chronological'])
        self.assertEqual(r.audit_event_order_and_repeats(events([1,1]))['suspicious_repeated_blocks'],[])

    def test_freeze_rejects_unordered_input_and_requires_explicit_repeat_review(self):
        with tempfile.TemporaryDirectory() as tmp,patch.object(r,'PRIVATE',Path(tmp)):
            _,ledger,seq=self.fixture(tmp)
            lp,sp=Path(tmp)/'new-ledger.json',Path(tmp)/'sequence.json'
            ledger['events']=events([1.2,.8]);r.write_private(lp,ledger)
            with self.assertRaisesRegex(ValueError,'chronological'):r.freeze(lp,sp)
            ledger['events']=events([1,1,1,1]);r.write_private(lp,ledger)
            with self.assertRaisesRegex(ValueError,'repeated'):r.freeze(lp,sp)
            audit=r.audit_event_order_and_repeats(ledger['events'])
            review={'ledger_sha256':r.digest(ledger),'repeat_audit_sha256':r.digest(audit),
                    'reason':'Explicit review supports four distinct simultaneous vehicles in this frame','author':'Mert'}
            rp=Path(tmp)/'repeat-review.json';r.write_private(rp,review)
            frozen=r.verify_freeze(r.freeze(lp,sp,rp))
            self.assertEqual(len(frozen['ledger']['events']),4)
            self.assertEqual(frozen['repeat_review_sha256'],r.file_sha(rp))

    @unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'),'video tools unavailable')
    def test_real_decode_uses_nonzero_source_pts_without_duplicate_frames(self):
        import subprocess
        with tempfile.TemporaryDirectory() as tmp, patch.object(r,"PRIVATE",Path(tmp)/'private'):
            clip=Path(tmp)/'synthetic.ts';geometry=Path(tmp)/'geometry.json'
            subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=15',
                            '-t','2','-c:v','mpeg2video','-output_ts_offset','10',str(clip)],check=True)
            geometry.write_text(json.dumps({'camera_id':'223','gates':[{'id':'g','start':[0,.5],'end':[1,.5],'direction':'both'}]}))
            info=r.probe(clip)
            self.assertGreater(info['first_pts_s'],10)
            bundle=r.render('223',clip,geometry,'g',[.2,1.2],fps=5)
            sequence=json.loads((bundle/'sequence.json').read_text())
            times=[f['clip_time_s'] for f in sequence['frames']]
            self.assertTrue(all(.2-1e-5<=t<1.2 for t in times))
            self.assertEqual(len(times),len(set(times)))
            self.assertTrue(sequence['sheets'])

    def test_freeze_coverage_tamper_and_idempotence(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(r,"PRIVATE",Path(tmp)):
            key=r.make_key("223","c",[0,2],"g")
            seq={"key":key,"camera_id":"223","clip_sha256":"c","geometry_sha256":"g", "window":[0,2],
                 "gate":"g","review_version":r.VERSION,"sheets":[{"file":"sheet-1.jpg"}],"frames":[{}],
                 "sample_fps":5,"source_gaps":[]}
            ledger={k:seq[k] for k in ("key","camera_id","clip_sha256","geometry_sha256","window","gate","review_version")}
            ledger.update(review_method="assisted_visual_sequence_review",human_confirmed=False,counting_rule=r.COUNTING_RULE,
                          reviewed_sheets=[],coverage_status="complete_assisted_sequence",events=events([1]),limitations=[])
            path=Path(tmp)/"ledger.json"
            sequence=Path(tmp)/"sequence.json"
            r.write_private(sequence,seq)
            r.write_private(path,ledger)
            with self.assertRaises(ValueError):r.freeze(path,sequence)
            ledger["reviewed_sheets"]=["sheet-1.jpg"]
            r.write_private(path,ledger)
            frozen=r.freeze(path,sequence)
            self.assertEqual(frozen,r.freeze(path,sequence))
            modified=json.loads(frozen.read_text())
            modified["ledger"]["events"]=[]
            r.write_private(frozen,modified)
            with self.assertRaises(ValueError):r.verify_freeze(frozen)


if __name__=="__main__":unittest.main()
