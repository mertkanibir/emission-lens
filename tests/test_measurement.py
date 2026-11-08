"""Controlled synthetic transport fixtures; no camera or production store access."""

from dataclasses import replace
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import unittest

from worker.measurement import (
    MeasurementBridge, ObservationSnapshot, serialize_measurement_batch,
)
from worker.publish import HttpSender, Outbox, PublishError
from worker.traversal import (
    MovementDefinition, TraversalClock, TraversalConfig, TraversalGate,
    TraversalObservation, TraversalProducer,
)

ROOT = Path(__file__).resolve().parents[1]
ANCHOR = datetime(2026, 11, 7, 20, 4, tzinfo=timezone.utc)
MET = {"temperature_f": 70, "relative_humidity_pct": 60}


def run(**changes):
    return {"run_id": "synthetic-bridge-test", "model_version": "test-only", "device": "test-only",
            "started_at": "2026-11-07T19:58:00Z", "ended_at": None, "mode": "synthetic", **changes}


def events(count=1, *, first_id=1, session=1, mode="synthetic", camera="222", state="moving", label="car", movement_id="test-movement"):
    movement = MovementDefinition(movement_id, "synthetic-path-v1", "synthetic-view-v1",
                                  TraversalGate("entry", (0.2, 0.3), (0.8, 0.3), "positive"),
                                  TraversalGate("exit", (0.2, 0.7), (0.8, 0.7), "positive"),
                                  True, "test-cal", "valid", "synthetic-acceptance-only", 40, "synthetic-distance-only")
    config = TraversalConfig(camera, run()["run_id"], mode, "synthetic-context-v1", "synthetic-view-v1",
                             (movement,), 2, 20, 0.01, 2)
    producer = TraversalProducer(config)
    for t, y in ((0, 0.1), (1, 0.9)):
        observations = [TraversalObservation(n, (0.5, y), label, state, None if state == "unavailable" else "test-stop-v1")
                        for n in range(first_id, first_id + count)]
        result = producer.update(session=session, media_time_s=t, observations=observations,
                                 context_version=config.context_version, view_version=config.view_version)
    return result.completed


def clock(event, anchor=ANCHOR, **changes):
    return replace(TraversalClock(event.session_id, anchor, "hls-min-anchor-v1", "estimated_hls_media",
                                  "synthetic-estimated-anchor-only"), **changes)


def prepare(bridge, *, source=(), clocks=(), **changes):
    kwargs = dict(events=source, clocks=clocks, calibration_version="test-cal", mapping_version=None, meteorology=MET)
    kwargs.update(changes)
    return bridge.prepare(**kwargs)


def observation(minute="2026-11-07T20:04:00Z", *, count=7, ref=None):
    return ObservationSnapshot("222", run()["run_id"], "synthetic", minute,
                               ({"vehicle_class": "car", "count": count, "stopped_vehicle_seconds": 900,
                                 "queue_count": 4, "coverage": 0.5},), ref)


def accept(bridge, plan):
    bridge.commit(plan.plan_id)
    return plan.batches


class SnapshotTests(unittest.TestCase):
    def test_exact_v1_projection_omits_worker_physical_authority(self):
        event, = events(state="unavailable", label="unknown")
        bridge = MeasurementBridge("222", run())
        plan = prepare(bridge, source=[event], clocks=[clock(event)])
        batch, = plan.batches
        self.assertEqual(batch["measurement_version"], "1.0")
        self.assertEqual(batch["revision"], 0)
        self.assertEqual(batch["minute"], "2026-11-07T20:04:00.000000Z")
        self.assertEqual(batch["traversals"][0], {
            "session_id": event.session_id, "traversal_id": event.traversal_id,
            "movement_id": "test-movement", "entry_media_s": 0.25, "exit_media_s": 0.75,
            "traversal_time_s": 0.5, "stopped_time_s": None, "vehicle_class": "unknown",
            "completed_at": "2026-11-07T20:04:00.750000Z",
        })
        encoded = serialize_measurement_batch(batch)
        for forbidden in ("distance_m", "transform", "approval", "accepted", "estimate_g", "track_id", "provenance"):
            self.assertNotIn(('"' + forbidden + '"').encode(), encoded)
        self.assertEqual(batch["observations"], [])
        self.assertIsNone(batch["mapping_version"])

    def test_exact_event_replay_is_idempotent_and_later_snapshot_is_complete(self):
        first, second = events(2)
        bridge = MeasurementBridge("222", run())
        initial, = accept(bridge, prepare(bridge, source=[first], clocks=[clock(first)]))
        duplicate = prepare(bridge, source=[first], clocks=[clock(first)])
        self.assertEqual(duplicate.batches, ())
        accept(bridge, duplicate)
        corrected, = accept(bridge, prepare(bridge, source=[second], clocks=[clock(first)]))
        self.assertEqual(corrected["batch_id"], initial["batch_id"])
        self.assertEqual(corrected["revision"], 1)
        self.assertEqual(len(corrected["traversals"]), 2)

    def test_same_id_changed_evidence_rejects_without_advancing_state(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        accept(bridge, prepare(bridge, source=[event], clocks=[clock(event)]))
        before = bridge.checkpoint()
        with self.assertRaisesRegex(ValueError, "different evidence"):
            prepare(bridge, source=[replace(event, vehicle_class="bus")], clocks=[clock(event)])
        self.assertEqual(bridge.checkpoint(), before)

    def test_missing_clock_retains_event_and_later_mapping_exports_same_identity(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        pending = prepare(bridge, source=[event])
        self.assertEqual(pending.batches, ())
        self.assertEqual(pending.retained_events, 1)
        self.assertIn("missing_session_clock", pending.unavailable_reasons)
        accept(bridge, pending)
        exported, = accept(bridge, prepare(bridge, clocks=[clock(event)]))
        self.assertEqual(exported["traversals"][0]["traversal_id"], event.traversal_id)

    def test_missing_or_unsupported_clock_withdraws_prior_cohort_without_a_zero(self):
        for clocks in ([], ["unsupported"]):
            with self.subTest(clocks=clocks):
                event, = events()
                bridge = MeasurementBridge("222", run())
                original, = accept(bridge, prepare(bridge, source=[event], clocks=[clock(event)]))
                unavailable = [] if not clocks else [clock(event, basis="recording_anchor")]
                retracted, = accept(bridge, prepare(bridge, clocks=unavailable))
                self.assertTrue(retracted["retract"])
                self.assertEqual(retracted["traversals"], [])
                self.assertEqual(retracted["observations"], [])
                restored, = accept(bridge, prepare(bridge, clocks=[clock(event)]))
                self.assertEqual((restored["batch_id"], restored["revision"]), (original["batch_id"], 2))

    def test_clock_rebin_retracts_old_minute_before_replacement_and_preserves_media_facts(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        old_clock = clock(event, ANCHOR + timedelta(seconds=59.5))
        original, = accept(bridge, prepare(bridge, source=[event], clocks=[old_clock]))
        plan = prepare(bridge, clocks=[replace(old_clock, anchor_utc=old_clock.anchor_utc - timedelta(seconds=1))])
        retract, replacement = plan.batches
        self.assertTrue(retract["retract"])
        self.assertFalse(replacement["retract"])
        self.assertEqual(retract["batch_id"], original["batch_id"])
        self.assertEqual(retract["revision"], 1)
        self.assertNotEqual(replacement["batch_id"], original["batch_id"])
        self.assertEqual(replacement["revision"], 0)
        self.assertEqual(replacement["traversals"][0]["traversal_id"], event.traversal_id)
        self.assertEqual(replacement["traversals"][0]["traversal_time_s"], original["traversals"][0]["traversal_time_s"])

    def test_partial_cohort_move_retracts_then_republishes_remaining_old_members(self):
        first, = events()
        second, = events(first_id=2, session=2)
        bridge = MeasurementBridge("222", run())
        old_clock, other_clock = clock(first, ANCHOR + timedelta(seconds=59.5)), clock(second, ANCHOR + timedelta(seconds=59.5))
        original, = accept(bridge, prepare(bridge, source=[first, second], clocks=[old_clock, other_clock]))
        plan = prepare(bridge, clocks=[replace(old_clock, anchor_utc=old_clock.anchor_utc - timedelta(seconds=1)), other_clock])
        self.assertEqual(len(plan.batches), 3)
        self.assertTrue(plan.batches[0]["retract"])
        replacements = [b for b in plan.batches if not b["retract"]]
        old_replacement = next(b for b in replacements if b["batch_id"] == original["batch_id"])
        self.assertEqual(old_replacement["revision"], 2)
        self.assertEqual([t["traversal_id"] for t in old_replacement["traversals"]], [second.traversal_id])

    def test_independent_observations_and_legacy_ref_do_not_become_completed_stops(self):
        event, = events()
        ref = {"batch_id": "00000000-0000-4000-8000-000000000001", "revision": 3}
        bridge = MeasurementBridge("222", run())
        batch, = accept(bridge, prepare(bridge, source=[event], clocks=[clock(event)], observations=[observation(ref=ref)]))
        self.assertEqual(batch["observation_ref"], ref)
        self.assertEqual(batch["observations"][0]["stopped_vehicle_seconds"], 900)
        self.assertEqual(batch["traversals"][0]["stopped_time_s"], 0)
        self.assertEqual(prepare(bridge, clocks=[clock(event)]).batches, ())

    def test_explicit_observation_rebin_removes_old_ref_and_updates_matching_minute(self):
        bridge = MeasurementBridge("222", run())
        original, = accept(bridge, prepare(bridge, observations=[observation()]))
        plan = prepare(bridge, remove_observation_minutes=[original["minute"]],
                       observations=[observation("2026-11-07T20:03:00Z")])
        self.assertEqual(len(plan.batches), 2)
        self.assertTrue(plan.batches[0]["retract"])

    def test_known_stopped_time_and_shared_context_revision_are_explicit(self):
        event, = events(state="stopped")
        bridge = MeasurementBridge("222", run())
        original, = accept(bridge, prepare(bridge, source=[event], clocks=[clock(event)]))
        self.assertEqual(original["traversals"][0]["stopped_time_s"], 0.5)
        revised, = accept(bridge, prepare(bridge, clocks=[clock(event)], mapping_version="explicit-mapping", meteorology={**MET, "temperature_f": 80}))
        self.assertEqual(revised["revision"], 1)
        self.assertEqual(revised["traversals"], original["traversals"])

    def test_camera_run_mode_and_calibration_mismatch_fail_without_state_change(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        for kwargs in ({"calibration_version": "different-calibration"}, {"run": run(mode="replay")},
                       {"observations": [replace(observation(), camera_id="223")]},
                       {"source": events(mode="replay")}, {"source": events(camera="223")}):
            with self.subTest(kwargs=kwargs):
                before = bridge.checkpoint()
                with self.assertRaises(ValueError):
                    prepare(bridge, **({"source": [event], "clocks": [clock(event)]} | kwargs))
                self.assertEqual(bridge.checkpoint(), before)

    def test_live_replay_synthetic_batch_identities_are_separate(self):
        ids = set()
        for mode in ("live", "replay", "synthetic"):
            event, = events(mode=mode)
            bridge = MeasurementBridge("222", run(mode=mode))
            batch, = accept(bridge, prepare(bridge, source=[event], clocks=[clock(event)]))
            ids.add(batch["batch_id"])
            self.assertEqual(batch["mode"], mode)
        self.assertEqual(len(ids), 3)

    def test_input_order_does_not_change_ids_revisions_or_serialized_bytes(self):
        source = events(3)
        first = prepare(MeasurementBridge("222", run()), source=source, clocks=[clock(source[0])])
        second = prepare(MeasurementBridge("222", run()), source=reversed(source), clocks=[clock(source[0])])
        self.assertEqual(first.plan_id, second.plan_id)
        self.assertEqual(serialize_measurement_batch(first.batches[0]), serialize_measurement_batch(second.batches[0]))

    def test_run_shutdown_metadata_updates_without_changing_traversal_cohort(self):
        event, = events()
        bridge = MeasurementBridge("222", run(device=None))
        original, = accept(bridge, prepare(bridge, source=[event], clocks=[clock(event)]))
        revised, = accept(bridge, prepare(bridge, clocks=[clock(event)], run=run(ended_at="2026-11-07T20:10:00Z")))
        self.assertEqual(revised["revision"], 1)
        self.assertEqual(revised["traversals"], original["traversals"])
        with self.assertRaises(ValueError):
            prepare(bridge, clocks=[clock(event)], run=run())


class ContinuityAndLimitsTests(unittest.TestCase):
    def test_pending_blocks_new_input_and_returned_envelope_mutations_cannot_change_retry(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        plan = prepare(bridge, source=[event], clocks=[clock(event)])
        original = serialize_measurement_batch(plan.batches[0])
        plan.batches[0]["traversals"].clear()
        self.assertEqual(serialize_measurement_batch(bridge.pending().batches[0]), original)
        with self.assertRaisesRegex(ValueError, "pending"):
            prepare(bridge)
        with self.assertRaises(ValueError):
            bridge.commit("wrong-plan")
        bridge.commit(plan.plan_id)
        bridge.commit(plan.plan_id)

    def test_pending_and_committed_checkpoint_restore_preserves_exact_bytes_and_revisions(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        plan = prepare(bridge, source=[event], clocks=[clock(event)])
        checkpoint = json.loads(json.dumps(bridge.checkpoint(), sort_keys=True))
        restarted = MeasurementBridge.restore(checkpoint)
        self.assertEqual(restarted.pending(), bridge.pending())
        self.assertEqual(serialize_measurement_batch(restarted.pending().batches[0]), serialize_measurement_batch(plan.batches[0]))
        restarted.commit(plan.plan_id)
        restored = MeasurementBridge.restore(restarted.checkpoint())
        self.assertIsNone(restored.pending())
        self.assertEqual(prepare(restored, source=[event], clocks=[clock(event)]).batches, ())

    def test_checkpoint_corruption_is_rejected(self):
        saved = MeasurementBridge("222", run()).checkpoint()
        saved["max_events"] = 1
        with self.assertRaisesRegex(ValueError, "integrity"):
            MeasurementBridge.restore(saved)

    def test_retained_event_capacity_is_atomic_and_does_not_evict_prior_cohort(self):
        first, second = events(2)
        bridge = MeasurementBridge("222", run(), max_events=1)
        accept(bridge, prepare(bridge, source=[first], clocks=[clock(first)]))
        before = bridge.checkpoint()
        with self.assertRaisesRegex(ValueError, "capacity"):
            prepare(bridge, source=[second], clocks=[clock(first)])
        self.assertEqual(bridge.checkpoint(), before)

    def test_retained_minute_capacity_does_not_forget_revision_ownership(self):
        event, = events()
        bridge = MeasurementBridge("222", run(), max_minutes=1)
        accept(bridge, prepare(bridge, source=[event], clocks=[clock(event)]))
        before = bridge.checkpoint()
        with self.assertRaisesRegex(ValueError, "minute capacity"):
            prepare(bridge, clocks=[clock(event, ANCHOR + timedelta(minutes=1))])
        self.assertEqual(bridge.checkpoint(), before)

    def test_1000_traversal_limit_fails_whole_preparation_without_pending_plan(self):
        source = events(1001)
        bridge = MeasurementBridge("222", run())
        with self.assertRaisesRegex(ValueError, "1000"):
            prepare(bridge, source=source, clocks=[clock(source[0])])
        self.assertIsNone(bridge.pending())
        self.assertEqual(bridge.checkpoint()["state"]["events"], {})

    def test_1000_traversal_boundary_is_supported_without_chunking(self):
        source = events(1000)
        bridge = MeasurementBridge("222", run())
        plan = prepare(bridge, source=source, clocks=[clock(source[0])])
        self.assertEqual(len(plan.batches), 1)
        self.assertEqual(len(plan.batches[0]["traversals"]), 1000)
        self.assertLessEqual(len(serialize_measurement_batch(plan.batches[0])), 1_048_576)

    def test_32_session_boundary_and_excess_are_checked_atomically(self):
        source = [events(session=n)[0] for n in range(1, 34)]
        bridge = MeasurementBridge("222", run())
        plan = prepare(bridge, source=source[:32], clocks=[clock(e) for e in source[:32]])
        self.assertEqual(len(plan.batches[0]["timing"]["sessions"]), 32)
        accept(bridge, plan)
        before = bridge.checkpoint()
        with self.assertRaisesRegex(ValueError, "32"):
            prepare(bridge, source=[source[32]], clocks=[clock(e) for e in source])
        self.assertEqual(bridge.checkpoint(), before)

    def test_outbox_encoded_ascii_expansion_is_included_in_one_mib_limit(self):
        source = events(700, movement_id="é" * 256)
        bridge = MeasurementBridge("222", run())
        with self.assertRaisesRegex(ValueError, "1 MiB"):
            prepare(bridge, source=source, clocks=[clock(source[0])])
        self.assertIsNone(bridge.pending())

    def test_serializer_rejects_forbidden_fields_bad_units_and_unsafe_values(self):
        event, = events()
        batch = prepare(MeasurementBridge("222", run()), source=[event], clocks=[clock(event)]).batches[0]
        for changes in ({"distance_m": 40}, {"units": {"distance": "pixels", "time": "s"}},
                        {"revision": True}, {"revision": 2**53}, {"meteorology": {**MET, "temperature_f": float("nan")}}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                serialize_measurement_batch({**batch, **changes})
        changed = json.loads(json.dumps(batch))
        changed["traversals"][0]["distance_m"] = 40
        with self.assertRaises(ValueError):
            serialize_measurement_batch(changed)

    def test_duplicate_clock_and_observation_updates_cannot_overwrite_each_other(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        for changes in ({"clocks": [clock(event), clock(event)]}, {"observations": [observation(), observation()]},
                        {"observations": [observation()], "remove_observation_minutes": [observation().minute]}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                prepare(bridge, **changes)


class OutboxAndConformanceTests(unittest.TestCase):
    def test_partial_enqueue_restart_is_identical_and_commit_precedes_flush(self):
        event, = events()
        bridge = MeasurementBridge("222", run())
        accept(bridge, prepare(bridge, source=[event], clocks=[clock(event, ANCHOR + timedelta(seconds=59.5))]))
        plan = prepare(bridge, clocks=[clock(event, ANCHOR + timedelta(seconds=58.5))])
        with tempfile.TemporaryDirectory() as folder:
            box = Outbox(Path(folder), lambda _: False, max_batches=1)
            box.enqueue(plan.batches[0])
            with self.assertRaises(PublishError):
                box.enqueue(plan.batches[1])
            restarted = MeasurementBridge.restore(bridge.checkpoint())
            delivered = []
            resumed = Outbox(Path(folder), lambda body: delivered.append(body) or True, max_batches=4)
            for batch in restarted.pending().batches:
                resumed.enqueue(batch)
            self.assertEqual(len(resumed.pending()), 2)
            restarted.commit(plan.plan_id)
            committed = restarted.checkpoint()
            self.assertIsNone(committed["pending"])
            self.assertEqual(resumed.flush(), 2)
            self.assertEqual(delivered, [serialize_measurement_batch(batch) for batch in plan.batches])

    def test_unchanged_http_sender_posts_only_to_dedicated_endpoint_and_retries_identical_body(self):
        received = []
        token = "controlled-local-test-token-32-characters"
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass
            def do_POST(self):
                received.append((self.path, self.headers.get("Authorization"), self.rfile.read(int(self.headers["Content-Length"]))))
                self.send_response(503 if len(received) == 1 else 202)
                self.end_headers()
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            event, = events()
            bridge = MeasurementBridge("222", run())
            plan = prepare(bridge, source=[event], clocks=[clock(event)])
            with tempfile.TemporaryDirectory() as folder:
                box = Outbox(Path(folder), HttpSender(f"http://127.0.0.1:{server.server_port}/api/measurements", token))
                box.enqueue(plan.batches[0])
                bridge.commit(plan.plan_id)
                bridge.checkpoint()  # Caller would atomically persist this before flush.
                self.assertEqual(box.flush(), 0)
                self.assertEqual(box.flush(), 1)
            self.assertEqual(received[0], received[1])
            self.assertEqual(received[0][0], "/api/measurements")
            self.assertEqual(received[0][1], "Bearer " + token)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    @unittest.skipUnless(shutil.which("node") and (ROOT / "node_modules/tsx").exists(), "TypeScript runtime is not installed")
    def test_python_bytes_conform_to_actual_typescript_parser_and_rebin_ingestion(self):
        first, = events()
        second, = events(first_id=2, session=2, state="unavailable", label="unknown")
        bridge = MeasurementBridge("222", run())
        c1, c2 = clock(first, ANCHOR + timedelta(seconds=59.5)), clock(second, ANCHOR + timedelta(seconds=59.5))
        series = list(accept(bridge, prepare(bridge, source=[first, second], clocks=[c1, c2])))
        series.extend(accept(bridge, prepare(bridge, clocks=[replace(c1, anchor_utc=c1.anchor_utc - timedelta(seconds=1)), c2])))
        series.extend(accept(bridge, prepare(bridge, clocks=[replace(c1, anchor_utc=c1.anchor_utc - timedelta(seconds=1)), c2],
                                            mapping_version="declared-test-reference", observations=[observation(count=0)])))
        script = '''
import fs from 'node:fs';
import {parseMeasurementBatch} from './contracts/src/measurement.ts';
import {ingest_measurement_batch} from './backend/src/measurements.ts';
delete process.env.EMISSION_LENS_REGISTRY_PATH;
let snapshot={schema_version:1,next_sequence:0,batches:[]};
const repository={read:async()=>snapshot,transact:async update=>{const out=update(snapshot);snapshot=out.snapshot;return out.result;}};
const input=JSON.parse(fs.readFileSync(0,'utf8'));
for(const item of input){parseMeasurementBatch(item);await ingest_measurement_batch(item,new Date('2026-11-07T20:10:00Z'),repository);}
const retry=await ingest_measurement_batch(input.at(-1),new Date('2026-11-07T20:10:00Z'),repository);
const active=snapshot.measurement_batches.filter(e=>!e.source.retract);
console.log(JSON.stringify({parsed:input.length,duplicate:retry.duplicate,members:active.reduce((n,e)=>n+e.source.traversals.length,0),physical:active.some(e=>e.derived.emissions.some(r=>r.estimate_g!==null))}));
'''
        result = subprocess.run(["node", "--import", "tsx", "--input-type=module", "-e", script],
                                cwd=ROOT, input=json.dumps(series), capture_output=True, text=True, timeout=25)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {"parsed": len(series), "duplicate": True, "members": 2, "physical": False})


if __name__ == "__main__":
    unittest.main()
