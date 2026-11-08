"""Mert: private, read-only 228 practice diagnostic with baseline initialization.

The existing count function makes every detector/tracker/sampler/metrics decision.
Observers copy state before/after calls; no images or trace identities are exported
to source control. Only [60,110] is processed and [83,110) is traced in detail.
"""

from collections import Counter
import contextlib
from dataclasses import asdict
from datetime import datetime, timezone
import gzip
import hashlib
from importlib.metadata import version
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

from worker.metrics import EPSILON, VEHICLE_CLASSES, point_in_polygon, segment_intersection

ROOT = Path(__file__).resolve().parents[1]
START, TRACE_START, END = 60.0, 83.0, 110.0
ORIGIN_PTS = 3025948946


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def metrics_snapshot(metrics):
    """Copy values, not mutable references to state the next update changes."""
    return {identity: {"point": list(state.point), "last_media_s": state.media_time_s,
                       "first_media_s": state.first_media_time_s, "hits": state.hits,
                       "gates": {key: {"stable_side": gate.stable_side, "pending_direction": gate.pending_direction}
                                 for key, gate in state.gates.items()}}
            for identity, state in metrics._tracks.items()}


def eligibility(config, box, label, width, height):
    finite = all(math.isfinite(x) for x in box)
    point = ((box[0] + box[2]) / (2 * width), box[3] / height) if finite else None
    valid = finite and 0 <= box[0] < box[2] <= width and 0 <= box[1] < box[3] <= height and label in VEHICLE_CLASSES
    road = bool(point is not None and point_in_polygon(point, config.road_region))
    exclusions = [i for i, polygon in enumerate(config.excluded_regions) if point is not None and point_in_polygon(point, polygon)]
    return {"bottom_center": point, "valid_box_and_class": valid, "inside_road_polygon": road,
            "excluded_region_indices": exclusions, "eligible": valid and road and not exclusions}


def gate_explanation(config, gate, vehicle, width, height, media, prior, counted, reset=False):
    """Reconstruct predicates using copied inputs and the same pure helpers.

    Actual states/crossings are recorded separately; this never alters a decision.
    """
    box = (vehicle.detection.x1, vehicle.detection.y1, vehicle.detection.x2, vehicle.detection.y2)
    admitted = eligibility(config, box, vehicle.label, width, height)
    point = admitted["bottom_center"]
    prior_gap = None if prior is None else media - prior["last_media_s"]
    effective = prior if not reset and prior_gap is not None and prior_gap <= config.max_gap_s and admitted["eligible"] else None
    old_gate = (effective or {}).get("gates", {}).get(gate.id, {"stable_side": 0, "pending_direction": 0})
    hits = 1 if effective is None else effective["hits"] + 1
    distance = None if point is None else gate.signed_distance(point)
    side = 1 if distance is not None and distance > config.hysteresis else -1 if distance is not None and distance < -config.hysteresis else 0
    crossing = None if effective is None else segment_intersection(tuple(effective["point"]), point, gate.start, gate.end)
    crossing_admitted = bool(crossing is not None and point_in_polygon(crossing, config.road_region)
                              and not any(point_in_polygon(crossing, polygon) for polygon in config.excluded_regions))
    pending = old_gate["pending_direction"]
    if crossing_admitted and abs(distance) > EPSILON:
        pending = 1 if distance > 0 else -1
    direction = "positive" if side > 0 else "negative" if side < 0 else None
    dedup = bool(direction and (vehicle.track_id, gate.id, direction) in counted)
    predicates = {"admitted": admitted["eligible"], "had_effective_prior": effective is not None,
                  "opposite_stable_side": bool(side and old_gate["stable_side"] and side != old_gate["stable_side"]),
                  "pending_matches_side": bool(side and pending == side), "minimum_hits": hits >= config.min_track_hits,
                  "not_deduplicated": not dedup, "permitted_direction": direction is not None and gate.direction in ("both", direction)}
    if not admitted["eligible"]:
        reason = "eligibility_rejected"
    elif effective is None:
        reason = "no_prior_after_reset_expiry_or_first_admission"
    elif not side:
        reason = "inside_hysteresis_band"
    elif not old_gate["stable_side"]:
        reason = "establishing_stable_side"
    elif side == old_gate["stable_side"]:
        reason = "same_stable_side"
    elif pending != side:
        reason = "no_matching_finite_gate_crossing"
    elif hits < config.min_track_hits:
        reason = "insufficient_hits"
    elif dedup:
        reason = "deduplicated"
    elif not predicates["permitted_direction"]:
        reason = "direction_disallowed"
    else:
        reason = "would_emit"
    return {**admitted, "prior_gap_s": prior_gap, "effective_prior": effective,
            "hits_if_admitted": hits, "signed_gate_distance": distance, "hysteresis_side": side,
            "stable_side_before": old_gate["stable_side"], "pending_before": old_gate["pending_direction"],
            "finite_intersection": crossing, "intersection_in_admitted_road": crossing_admitted,
            "pending_before_confirmation_reconstructed": pending, "dedup_key_already_present": dedup,
            "predicates": predicates, "predicted_emit": all(predicates.values()), "reason": reason}


def sampler_record(media, before, after, keep):
    return {"media_time_s": media, "raw_pts_from_verified_decoder_offset": ORIGIN_PTS + round(media * 90000),
            "next_due_before_s": before, "media_minus_next_due_s": media - before,
            "media_minus_next_due_ticks": (media - before) * 90000,
            "next_due_after_s": after, "kept": keep, "detail_window": TRACE_START <= media < END}


def tracker_states(model):
    """Installed Ultralytics STrack exposes xyxy, not the older tlbr name."""
    predictor = getattr(model, "predictor", None)
    result = {}
    for tracker in getattr(predictor, "trackers", ()):
        for category in ("tracked_stracks", "lost_stracks", "removed_stracks"):
            result[category] = [{"track_id": int(t.track_id), "bbox": [float(x) for x in t.xyxy],
                                 "score": float(t.score), "state": int(t.state), "activated": bool(t.is_activated),
                                 "last_frame_id": int(t.frame_id), "start_frame_id": int(t.start_frame)}
                                for t in getattr(tracker, category, ())]
    return result


def main():
    import torch
    import evaluation.check_counts as checker
    from ultralytics.trackers.byte_tracker import STrack
    from ultralytics.trackers.track import on_predict_postprocess_end as tracking_callback

    out = ROOT / "data/raw/count_check/228-practice-trace-20261107"
    out.mkdir(parents=True, exist_ok=True, mode=0o700)
    trace_path = out / "trace.jsonl.gz"
    assert not trace_path.exists(), "Preserve the original diagnostic; do not overwrite it."
    clip = ROOT / "data/raw/clips/228/228_20261107T220646Z.ts"
    weights = ROOT / "weights/yolo11n.pt"
    config_path = ROOT / "config/cameras/228.measurement.json"
    plan_path = ROOT / "data/raw/count_check/baseline-223-228-20261107/run-plan.json"
    plan = json.loads(plan_path.read_text())
    frozen = next(row for row in plan["cameras"] if row["camera_id"] == "228")
    original_config = json.loads(config_path.read_text())
    assert sha(clip) == frozen["clip_sha256"]
    assert sha(config_path) == frozen["raw_geometry_sha256"]
    assert canonical(original_config) == frozen["canonical_full_json_sha256"]
    assert sha(weights) == "0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1"
    semantic = canonical({"camera_id": "228", "selected_gate": frozen["selected_gate"],
                          "road_region": original_config["road_region"], "excluded_regions": original_config["excluded_regions"],
                          "counting_rule": plan["counting_rule"], "metrics_policy": frozen["metrics_policy"],
                          "comparison_policy": plan["comparison_policy"]})
    assert semantic == frozen["selected_geometry_sha256"]
    assert torch.cuda.is_available(), "One allocated CUDA slice is required."
    assert isinstance(STrack.xyxy, property), "Check the actual installed tracker box API before inference."
    torch.set_num_threads(1)
    torch.cuda.set_device(0)
    began = time.monotonic()
    counts, samples, prefix_events, loaded = Counter(), [], [], []
    context = {"raw_detections": None, "frame": None, "smoke_check": None, "raw_callback_seen": False}
    source_paths = ("evaluation/check_counts.py", "worker/metrics.py", "worker/stream.py", "worker/track.py", "worker/detect.py")
    source_hashes = {name: sha(ROOT / name) for name in source_paths}
    header = {"kind": "header", "owner": "Mert", "mode": "replay", "camera_id": "228",
              "started_at_utc": datetime.now(timezone.utc).isoformat(), "job_id": os.environ["SLURM_JOB_ID"],
              "node": os.environ.get("SLURMD_NODENAME"), "gpu": torch.cuda.get_device_name(0),
              "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "source_sha256": source_hashes, "runner_sha256": sha(Path(__file__)), "weights_sha256": sha(weights),
              "clip_sha256": sha(clip), "raw_geometry_sha256": sha(config_path), "selected_geometry_sha256": semantic,
              "settings": {"initialization_media_s": START, "detailed_window": [TRACE_START, END], "processing_end_s": END,
                           "sample_fps": 15, "image_size": 640, "gate": "count-1", "metrics_policy": frozen["metrics_policy"]},
              "raw_pts_origin": ORIGIN_PTS, "raw_pts_time_base": "1/90000",
              "clock_mapping": "OpenCV media = (original raw PTS - observed first PTS)/90000; verified on same clip in 175884",
              "detection_scope": "post-NMS vehicle detections at original conf=0.1, copied before ByteTrack association",
              "gate_predicate_scope": "copied before/after state and same pure geometry helpers; actual emitted events recorded independently",
              "packages": {name: version(name) for name in ("torch", "ultralytics", "opencv-python", "lap")}}

    def row(handle, value):
        handle.write(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n")

    original_load = checker.load_model
    original_tracker, original_metrics, original_sampler = checker.CameraTracker, checker.CameraMetrics, checker.MediaTimeSampler
    with gzip.open(trace_path, "wt", encoding="utf-8", compresslevel=3) as trace:
        row(trace, header)

        def raw_observer(predictor):
            frame = context["frame"]
            if frame is None:
                return
            assert all(result.boxes.id is None for result in predictor.results), "Observer must precede ByteTrack association."
            context["raw_callback_seen"] = True
            if not TRACE_START <= frame.media_time_s < END:
                return
            detections = []
            for result in predictor.results:
                for box, score, cls in zip(result.boxes.xyxy.detach().cpu().tolist(), result.boxes.conf.detach().cpu().tolist(), result.boxes.cls.detach().cpu().tolist()):
                    label = result.names[int(cls)]
                    detections.append({"bbox": box, "confidence": score, "class": label,
                                       **eligibility(context["config"], box, label, frame.image.shape[1], frame.image.shape[0])})
            context["raw_detections"] = detections

        def observed_load(path):
            model = original_load(path)
            # Added before model.track registers its tracking callback. Refreshing
            # that callback preserves its position in the installed library.
            model.add_callback("on_predict_postprocess_end", raw_observer)
            loaded.append(model)
            return model

        class ObservedSampler(original_sampler):
            def should_keep(self, media):
                before = self._next_due_s
                keep = super().should_keep(media)
                value = sampler_record(media, before, self._next_due_s, keep)
                assert START <= media <= END
                samples.append(value)
                row(trace, {"kind": "sample_decision", **value})
                return keep

        class ObservedTracker(original_tracker):
            def update(self, frame):
                context["frame"] = frame
                context["raw_detections"] = None
                context["raw_callback_seen"] = False
                detailed = TRACE_START <= frame.media_time_s < END
                if detailed:
                    assert context["smoke_check"] is not None, "Complete the actual tracker/callback smoke check before detailed tracing."
                    context["tracker_before"] = tracker_states(self._model)
                result = super().update(frame)
                assert context["raw_callback_seen"]
                if context["smoke_check"] is None:
                    callbacks = self._model.callbacks["on_predict_postprocess_end"]
                    observer_index = next(i for i, cb in enumerate(callbacks) if cb is raw_observer)
                    tracker_index = next(i for i, cb in enumerate(callbacks) if getattr(cb, "func", None) is tracking_callback)
                    assert observer_index < tracker_index
                    states = tracker_states(self._model)
                    if sum(len(rows) for rows in states.values()):
                        context["smoke_check"] = {"media_time_s": frame.media_time_s,
                                                  "actual_xyxy_boxes_read": True, "raw_callback_before_tracker": True,
                                                  "observer_callback_index": observer_index, "tracking_callback_index": tracker_index}
                        row(trace, {"kind": "smoke_check", **context["smoke_check"]})
                if detailed:
                    assert context["raw_detections"] is not None
                    context["tracker_after"] = tracker_states(self._model)
                return result

        class ObservedMetrics(original_metrics):
            def __init__(self, config):
                super().__init__(config)
                context["config"] = config

            def update(self, frame, vehicles):
                vehicles = tuple(vehicles)
                detailed = TRACE_START <= frame.media_time_s < END
                if detailed:
                    before = metrics_snapshot(self)
                    counted = set(self._counted)
                    old_session, old_media = self._session, self._last_media
                result = super().update(frame, vehicles)
                prefix_events.extend(asdict(event) for event in result.crossings)
                if not detailed:
                    return result
                after = metrics_snapshot(self)
                gate = next(g for g in self.config.gates if g.id == "count-1")
                source_gap = None if old_media is None else frame.media_time_s - old_media
                reset = old_session != frame.session or (source_gap is not None and source_gap > self.config.max_gap_s)
                output_events = [asdict(event) for event in result.crossings]
                records = []
                observed_ids = {vehicle.track_id for vehicle in vehicles}
                for vehicle in vehicles:
                    detail = gate_explanation(self.config, gate, vehicle, frame.image.shape[1], frame.image.shape[0],
                                              frame.media_time_s, before.get(vehicle.track_id), counted, reset)
                    emitted = any(event.track_id == vehicle.track_id and event.gate_id == gate.id for event in result.crossings)
                    detail.update({"track_id": vehicle.track_id, "class": vehicle.label,
                                   "detection": asdict(vehicle.detection), "metric_state_before": before.get(vehicle.track_id),
                                   "metric_state_after": after.get(vehicle.track_id), "actual_selected_gate_emit": emitted,
                                   "predicate_matches_observed_event": detail["predicted_emit"] == emitted})
                    records.append(detail)
                    counts["tracked_vehicle_observations"] += 1
                    counts["eligible_track_observations"] += int(detail["eligible"])
                    counts["outside_road_track_observations"] += int(not detail["inside_road_polygon"])
                    counts["excluded_track_observations"] += int(bool(detail["excluded_region_indices"]))
                    counts["prior_removed_by_eligibility_observations"] += int(before.get(vehicle.track_id) is not None and not detail["eligible"] and after.get(vehicle.track_id) is None)
                    counts["observer_gate_predicate_disagreements"] += int(not detail["predicate_matches_observed_event"])
                    counts["gate_reason_" + detail["reason"]] += 1
                counts["detailed_sampled_frames"] += 1
                counts["raw_post_nms_detection_observations"] += len(context["raw_detections"])
                counts["source_gap_resets_in_detail"] += int(result.discontinuity)
                counts["selected_gate_emissions_in_detail"] += sum(event.gate_id == "count-1" for event in result.crossings)
                row(trace, {"kind": "frame", "media_time_s": frame.media_time_s,
                            "raw_pts_from_verified_decoder_offset": ORIGIN_PTS + round(frame.media_time_s * 90000),
                            "session": frame.session, "processed_sequence": frame.sequence,
                            "source_gap_s": source_gap, "metric_discontinuity": result.discontinuity,
                            "raw_detections": context["raw_detections"], "tracker_before": context["tracker_before"],
                            "tracker_after": context["tracker_after"], "vehicles": records,
                            "previous_metric_ids_not_returned_by_tracker": sorted(set(before) - observed_ids),
                            "metric_ids_removed_on_update": sorted(set(before) - set(after)),
                            "actual_crossings": output_events, "metrics_skipped_detections": result.skipped_detections})
                return result

        checker.load_model = observed_load
        checker.CameraTracker, checker.CameraMetrics, checker.MediaTimeSampler = ObservedTracker, ObservedMetrics, ObservedSampler
        with (out / "console.private.log").open("w") as console:
            with contextlib.redirect_stdout(console), contextlib.redirect_stderr(console):
                result = checker.count("228", START, END - START, weights=weights, image_size=640, sample_fps=15, clip=clip)
        row(trace, {"kind": "end", "max_processed_media_s": max(s["media_time_s"] for s in samples if s["kept"])})
    assert len(loaded) == 1
    device = str(next(loaded[0].predictor.model.model.parameters()).device)
    assert device == "cuda:0"
    (out / "prefix-count.private.json").write_text(json.dumps(result, indent=2) + "\n")
    (out / "prefix-events.private.json").write_text(json.dumps(prefix_events, indent=2) + "\n")
    prior_path = ROOT / "data/raw/count_check/baseline-223-228-20261107/228_60s_120s_yolo11n_640_15fps_counts.json"
    prior = json.loads(prior_path.read_text())
    equivalence = {}
    for gate in {g["id"] for g in original_config["gates"]}:
        old = [(round(e["clip_time_s"], 3), e["direction"]) for e in prior.get("gates", {}).get(gate, {}).get("events", []) if START <= e["clip_time_s"] < END]
        new = [(round(e["media_time_s"], 3), e["direction"]) for e in prefix_events if e["gate_id"] == gate and START <= e["media_time_s"] < END]
        equivalence[gate] = {"matches_original_practice_prefix": old == new, "baseline_events": len(old), "observed_events": len(new)}
    assert all(value["matches_original_practice_prefix"] for value in equivalence.values()), "Observer output differs from original baseline; investigate before attributing causes."
    assert counts["observer_gate_predicate_disagreements"] == 0
    assert sha(config_path) == frozen["raw_geometry_sha256"]
    assert all(sha(ROOT / name) == value for name, value in source_hashes.items())
    def sampling_summary(rows):
        rejected = [s for s in rows if not s["kept"]]
        return {"decoded_frames": len(rows), "kept": sum(s["kept"] for s in rows), "rejected": len(rejected),
                "rejected_within_1ns_of_due": sum(-1e-9 <= s["media_minus_next_due_s"] < 0 for s in rejected),
                "rejected_within_1us_of_due": sum(-1e-6 <= s["media_minus_next_due_s"] < 0 for s in rejected),
                "rejected_within_1ms_of_due": sum(-.001 <= s["media_minus_next_due_s"] < 0 for s in rejected),
                "minimum_rejection_lateness_s": min((-s["media_minus_next_due_s"] for s in rejected), default=None),
                "maximum_rejection_lateness_s": max((-s["media_minus_next_due_s"] for s in rejected), default=None)}
    summary = {**header, "kind": "summary", "finished_at_utc": datetime.now(timezone.utc).isoformat(),
               "actual_inference_device": device, "elapsed_wall_s": time.monotonic() - began,
               "source_and_geometry_unchanged": True, "trace_sha256": sha(trace_path),
               "actual_tracker_callback_smoke_check": context["smoke_check"],
               "baseline_prefix_equivalence": equivalence, "counters": dict(counts),
               "prefix_sampling": sampling_summary(samples),
               "detail_sampling": sampling_summary([s for s in samples if s["detail_window"]]),
               "reserved_window_processed": False,
               "interpretation_limit": "Track/frame observations are not unique physical vehicle counts; no visual pairing or repair efficacy is established."}
    (out / "summary.private.json").write_text(json.dumps(summary, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"status": "trace_complete", "job_id": header["job_id"], "device": device,
                      "detailed_frames": counts["detailed_sampled_frames"], "baseline_prefix_equivalent": True,
                      "trace_sha256": summary["trace_sha256"]}), flush=True)


if __name__ == "__main__":
    main()
