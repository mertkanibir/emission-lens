"""Mert: private practice-only score-fusion trial, plus unchanged control.

Only the cloned tracker YAML's fuse_score flag may differ. Original worker,
detector, tracker, metric and sampling source files remain unchanged. Raw track
and association evidence stays private; [720,840) is never opened or processed.
"""

from collections import deque
from dataclasses import asdict
from datetime import datetime, timezone
import gzip
import json
from pathlib import Path
import subprocess
import sys
import time

from evaluation.trace_228_practice import canonical, eligibility, metrics_snapshot, sha

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/raw/count_check/228-fuse-practice-20261107"


def validate_configs(default_path, candidate_path):
    import yaml
    original = yaml.safe_load(Path(default_path).read_bytes())
    candidate = yaml.safe_load(Path(candidate_path).read_bytes())
    if (not isinstance(original, dict) or not isinstance(candidate, dict)
            or set(original) != set(candidate)
            or {key for key in original if original[key] != candidate[key]} != {"fuse_score"}
            or original.get("fuse_score") is not True or candidate.get("fuse_score") is not False):
        raise ValueError("The private candidate must change only fuse_score from true to false.")
    return original, candidate


def plain(value):
    if isinstance(value, dict):
        return {key: plain(item) for key, item in value.items()}
    if isinstance(value, (tuple, list)):
        return [plain(item) for item in value]
    if hasattr(value, "tolist"):
        return plain(value.tolist())
    if hasattr(value, "item"):
        return value.item()
    return value


def predictor_arguments(args):
    # persist is a Model.track/callback argument, not a predictor CFG key in
    # the installed version. Record its actual callback value separately.
    return {key: getattr(args, key) for key in ("imgsz", "conf", "classes", "tracker", "mode", "batch")}


def main():
    import os
    import torch
    import yaml
    import evaluation.check_counts as checker
    from ultralytics.trackers.byte_tracker import BYTETracker, STrack
    from ultralytics.trackers import track as tracking_module
    from ultralytics.trackers.utils import matching
    from ultralytics.utils.checks import check_yaml

    assert torch.cuda.is_available() and isinstance(STrack.xyxy, property)
    torch.set_num_threads(1)
    torch.cuda.set_device(0)
    plan_path = OUT / "recipe.json"
    plan = json.loads(plan_path.read_text())
    assert not (OUT / "execution.private.json").exists(), "Preserve prior experiment outputs."
    default_path, candidate_path = OUT / "default.bytetrack.yaml", OUT / "candidate.bytetrack.yaml"
    original_cfg, candidate_cfg = validate_configs(default_path, candidate_path)
    assert sha(default_path) == plan["default_yaml_sha256"]
    assert sha(candidate_path) == plan["candidate_yaml_sha256"]
    clip = ROOT / "data/raw/clips/228/228_20261107T220646Z.ts"
    geometry = ROOT / "config/cameras/228.measurement.json"
    weights = ROOT / "weights/yolo11n.pt"
    assert sha(clip) == plan["clip_sha256"] and sha(geometry) == plan["raw_geometry_sha256"]
    assert sha(weights) == plan["weights_sha256"]
    originals = (checker.load_model, checker.CameraTracker, checker.CameraMetrics, checker.MediaTimeSampler)
    original_dists, original_assignment = BYTETracker.get_dists, matching.linear_assignment
    sources = {name: sha(ROOT / name) for name in ("evaluation/check_counts.py", "worker/detect.py", "worker/track.py", "worker/metrics.py", "worker/stream.py")}
    report = {"owner": "Mert", "mode": "replay", "job_id": os.environ["SLURM_JOB_ID"],
              "node": os.environ.get("SLURMD_NODENAME"), "gpu": torch.cuda.get_device_name(0),
              "started_at_utc": datetime.now(timezone.utc).isoformat(), "recipe_sha256": sha(plan_path),
              "runner_sha256": sha(Path(__file__)), "source_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
              "source_sha256": sources, "runs": [], "reserved_window_processed": False,
              "production_files_changed": False}

    def write_line(handle, value):
        handle.write(json.dumps(plain(value), separators=(",", ":"), allow_nan=False) + "\n")

    def track_row(track):
        return {"track_id": int(track.track_id), "bbox": [float(x) for x in track.xyxy],
                "score": float(track.score), "class_id": int(track.cls), "raw_detection_index": int(track.idx),
                "activated": bool(track.is_activated), "state": int(track.state),
                "start_frame_id": int(track.start_frame), "last_frame_id": int(track.frame_id)}

    def states(model):
        return {category: [track_row(t) for tracker in getattr(model.predictor, "trackers", ()) for t in getattr(tracker, category, ())]
                for category in ("tracked_stracks", "lost_stracks")}

    for name, expected_cfg, override in (("control", original_cfg, None), ("candidate", candidate_cfg, candidate_path)):
        pipeline_recipe = OUT / f"{name}-recipe.json"
        pipeline_recipe_sha = plan["pipeline_recipes"][name]
        assert sha(pipeline_recipe) == pipeline_recipe_sha
        context = {"frame": None, "raw": None, "costs": [], "assignments": [], "actual": None}
        samples, event_contexts, admissions, loaded = [], [], [], []
        history, episode_start = {}, {}
        began = time.monotonic()
        trace_path = OUT / f"{name}-detail.private.jsonl.gz"
        assert not trace_path.exists()
        native_load, native_tracker, native_metrics, native_sampler = originals
        with gzip.open(trace_path, "wt", encoding="utf-8", compresslevel=3) as trace:
            write_line(trace, {"kind": "header", "run": name, "recipe_sha256": sha(plan_path),
                               "pipeline_recipe_sha256": pipeline_recipe_sha,
                               "initialization_media_s": 60, "window": [60, 180], "detail_window": [83, 110]})

            def detailed():
                return context["frame"] is not None and 83 <= context["frame"].media_time_s < 110

            def observed_dists(tracker, tracks, detections):
                result = original_dists(tracker, tracks, detections)
                if detailed():
                    context["costs"].append({"stage": sys._getframe(1).f_code.co_name,
                                             "tracks": [track_row(t) for t in tracks],
                                             "detections": [track_row(t) for t in detections], "cost_matrix": result.tolist()})
                return result

            def observed_assignment(*args, **kwargs):
                result = original_assignment(*args, **kwargs)
                if detailed():
                    context["assignments"].append({"stage": sys._getframe(1).f_code.co_name,
                                                   "threshold": kwargs.get("thresh", args[1] if len(args) > 1 else None),
                                                   "cost_matrix": args[0].tolist(), "result": plain(result)})
                return result

            def raw_observer(predictor):
                assert all(result.boxes.id is None for result in predictor.results)
                if not detailed():
                    return
                frame = context["frame"]
                rows = []
                for result in predictor.results:
                    for index, (box, score, cls) in enumerate(zip(result.boxes.xyxy.detach().cpu().tolist(), result.boxes.conf.detach().cpu().tolist(), result.boxes.cls.detach().cpu().tolist())):
                        label = result.names[int(cls)]
                        rows.append({"raw_detection_index": index, "bbox": box, "confidence": score,
                                     "class": label, **eligibility(context["config"], box, label, frame.image.shape[1], frame.image.shape[0])})
                context["raw"] = rows

            def observed_load(path):
                model = native_load(path)
                native_model_track = model.track
                def scoped_track(*args, **kwargs):
                    assert kwargs["tracker"] == "bytetrack.yaml"
                    assert kwargs["imgsz"] == 640 and kwargs["conf"] == .1 and kwargs["persist"] is True
                    if override is not None:
                        kwargs = {**kwargs, "tracker": str(override)}
                    return native_model_track(*args, **kwargs)
                model.track = scoped_track
                model.add_callback("on_predict_postprocess_end", raw_observer)
                loaded.append(model)
                return model

            class ObservedSampler(native_sampler):
                def should_keep(self, media):
                    before = self._next_due_s
                    kept = super().should_keep(media)
                    assert 60 <= media <= 180
                    samples.append({"media_time_s": media, "next_due_before_s": before,
                                    "next_due_after_s": self._next_due_s, "kept": kept})
                    return kept

            class ObservedTracker(native_tracker):
                def update(self, frame):
                    context["frame"] = frame
                    context["raw"], context["costs"], context["assignments"] = None, [], []
                    before = states(self._model) if detailed() and self._model.predictor is not None else {}
                    result = super().update(frame)
                    if context["actual"] is None:
                        predictor = self._model.predictor
                        assert len(predictor.trackers) == 1
                        tracker = predictor.trackers[0]
                        actual_args = {key: (str(value) if isinstance(value, torch.device) else value) for key, value in vars(tracker.args).items()}
                        assert {key: actual_args[key] for key in expected_cfg} == expected_cfg
                        resolved = Path(check_yaml(predictor.args.tracker)).resolve()
                        expected_hash = plan["candidate_yaml_sha256"] if override else plan["default_yaml_sha256"]
                        assert sha(resolved) == expected_hash
                        callbacks = self._model.callbacks["on_predict_postprocess_end"]
                        raw_index = next(i for i, cb in enumerate(callbacks) if cb is raw_observer)
                        tracking_index = next(i for i, cb in enumerate(callbacks) if getattr(cb, "func", None) is tracking_module.on_predict_postprocess_end)
                        assert raw_index < tracking_index
                        callback_persist = callbacks[tracking_index].keywords["persist"]
                        assert callback_persist is True
                        context["actual"] = {"first_media_s": frame.media_time_s, "tracker_class": type(tracker).__name__,
                                             "tracker_args": actual_args, "resolved_yaml_path": str(resolved),
                                             "resolved_yaml_sha256": sha(resolved), "max_frames_lost": tracker.max_frames_lost,
                                             "raw_callback_precedes_tracking": True,
                                             "actual_tracking_callback_persist": callback_persist,
                                             "predictor_args": predictor_arguments(predictor.args),
                                             "actual_inference_device": str(next(predictor.model.model.parameters()).device)}
                        assert context["actual"]["actual_inference_device"] == "cuda:0"
                        write_line(trace, {"kind": "actual_config", **context["actual"]})
                    if detailed():
                        assert context["raw"] is not None
                        context["before_tracker"], context["after_tracker"] = before, states(self._model)
                    return result

            class ObservedMetrics(native_metrics):
                def __init__(self, config):
                    super().__init__(config)
                    context["config"] = config

                def update(self, frame, vehicles):
                    vehicles = tuple(vehicles)
                    before = metrics_snapshot(self)
                    result = super().update(frame, vehicles)
                    after = metrics_snapshot(self)
                    gate = next(g for g in self.config.gates if g.id == "count-1")
                    records = []
                    for vehicle in vehicles:
                        identity = vehicle.track_id
                        d = vehicle.detection
                        box = (d.x1, d.y1, d.x2, d.y2)
                        entry = {"media_time_s": frame.media_time_s, "track_id": identity, "class": vehicle.label,
                                 "confidence": d.confidence, "bbox": box,
                                 **eligibility(self.config, box, vehicle.label, frame.image.shape[1], frame.image.shape[0])}
                        entry["signed_gate_distance"] = gate.signed_distance(entry["bottom_center"])
                        entry["metric_before"], entry["metric_after"] = before.get(identity), after.get(identity)
                        history.setdefault(identity, deque(maxlen=32)).append(entry)
                        if identity not in before and identity in after:
                            admission = {**entry, "reason": "first_or_recovered_metric_admission"}
                            admissions.append(admission)
                            episode_start[identity] = admission
                        records.append(entry)
                    for event in result.crossings:
                        if event.gate_id == "count-1":
                            event_contexts.append({"event": asdict(event), "recent_trajectory": list(history.get(event.track_id, ())),
                                                   "metric_episode_admission": episode_start.get(event.track_id)})
                    if detailed():
                        write_line(trace, {"kind": "frame", "media_time_s": frame.media_time_s,
                                           "raw_pts_from_verified_decoder_offset": 3025948946 + round(frame.media_time_s * 90000),
                                           "raw_detections": context["raw"], "tracker_before": context["before_tracker"],
                                           "tracker_after": context["after_tracker"], "vehicles": records,
                                           "association_costs": context["costs"], "assignments": context["assignments"],
                                           "actual_crossings": [asdict(event) for event in result.crossings]})
                    return result

            checker.load_model = observed_load
            checker.CameraTracker, checker.CameraMetrics, checker.MediaTimeSampler = ObservedTracker, ObservedMetrics, ObservedSampler
            BYTETracker.get_dists, matching.linear_assignment = observed_dists, observed_assignment
            try:
                with (OUT / f"{name}-console.private.log").open("w") as console:
                    import contextlib
                    with contextlib.redirect_stdout(console), contextlib.redirect_stderr(console):
                        result = checker.count("228", 60, 120, weights=weights, image_size=640, sample_fps=15, clip=clip)
            finally:
                BYTETracker.get_dists, matching.linear_assignment = original_dists, original_assignment
                checker.load_model, checker.CameraTracker, checker.CameraMetrics, checker.MediaTimeSampler = originals
        if name == "control":
            baseline = json.loads((ROOT / "data/raw/count_check/baseline-223-228-20261107/228_60s_120s_yolo11n_640_15fps_counts.json").read_text())
            assert result == baseline, "The unchanged control must reproduce the original practice result."
        for suffix, value in (("count", result), ("event-contexts", event_contexts), ("admissions", admissions), ("samples", samples)):
            (OUT / f"{name}-{suffix}.private.json").write_text(json.dumps(plain(value), indent=2, allow_nan=False) + "\n")
        report["runs"].append({"name": name, "actual_configuration": context["actual"], "frames_processed": result["frames_processed"],
                               "pipeline_recipe_sha256": pipeline_recipe_sha,
                               "sample_decisions_sha256": canonical(samples), "detail_trace_sha256": sha(trace_path),
                               "count_sha256": sha(OUT / f"{name}-count.private.json"), "wall_s": time.monotonic() - began,
                               "original_baseline_exactly_equal": True if name == "control" else None,
                               "max_processed_media_s": max(row["media_time_s"] for row in samples if row["kept"])})
        (OUT / "execution.private.json").write_text(json.dumps(plain(report), indent=2, allow_nan=False) + "\n")
        print("PRACTICE_PASS_COMPLETE", name, "frames", result["frames_processed"], "device", context["actual"]["actual_inference_device"], flush=True)
        loaded.clear()
        torch.cuda.empty_cache()
    assert report["runs"][0]["sample_decisions_sha256"] == report["runs"][1]["sample_decisions_sha256"]
    assert all(sha(ROOT / name) == value for name, value in sources.items())
    assert sha(geometry) == plan["raw_geometry_sha256"]
    assert sha(default_path) == plan["default_yaml_sha256"] and sha(candidate_path) == plan["candidate_yaml_sha256"]
    assert all(sha(OUT / f"{name}-recipe.json") == value for name, value in plan["pipeline_recipes"].items())
    report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
    report["sampler_sequences_identical"] = True
    report["production_files_unchanged"] = True
    (OUT / "execution.private.json").write_text(json.dumps(plain(report), indent=2, allow_nan=False) + "\n")
    print("PRACTICE_ONLY_TRIAL_COMPLETE", flush=True)


if __name__ == "__main__":
    main()
