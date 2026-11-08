"""Mert: bounded, private baseline execution against independently frozen gates.

Run from the repository root inside an allocated CUDA job. It invokes the existing
count CLI without changing detector, tracker, metric or endpoint behavior. Model
events/totals and console output stay in ignored storage until blind review freezes.
"""

import contextlib
from datetime import datetime, timezone
import hashlib
from importlib.metadata import version
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import time

ROOT = Path.cwd()
sys.path.insert(0, str(ROOT))
OUT = ROOT / "data/raw/count_check/baseline-223-228-20261107"


def sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def selected_geometry(config, camera, plan):
    return canonical({
        "camera_id": config["camera_id"],
        "selected_gate": next(g for g in config["gates"] if g["id"] == camera["selected_gate_id"]),
        "road_region": config.get("road_region"), "excluded_regions": config.get("excluded_regions", []),
        "counting_rule": plan["counting_rule"], "metrics_policy": camera["metrics_policy"],
        "comparison_policy": plan["comparison_policy"],
    })


def main():
    import torch
    import worker.detect as detect
    import worker.stream as stream

    assert torch.cuda.is_available(), "CUDA allocation required; no CPU fallback."
    torch.set_num_threads(1)
    torch.cuda.set_device(0)
    plan = json.loads((OUT / "run-plan.json").read_text())
    assert plan["model"] == "weights/yolo11n.pt" and plan["image_size"] == 640 and plan["sample_fps"] == 15
    weights = ROOT / plan["model"]
    assert weights.is_file(), "Use the existing official pretrained checkpoint."
    expected_weight = "0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1"
    assert sha(weights) == expected_weight, "Pretrained checkpoint differs from the verified baseline."
    loaded, selected_times = [], []
    original_load, original_sampler = detect.load_model, stream.MediaTimeSampler

    def observed_load(path):
        model = original_load(path)
        loaded.append(model)
        return model

    class ObservedSampler(original_sampler):
        def should_keep(self, media_time_s):
            keep = super().should_keep(media_time_s)
            if keep:
                selected_times.append(media_time_s)
            return keep

    # Observation-only instrumentation; decisions/settings stay with original code.
    detect.load_model = observed_load
    stream.MediaTimeSampler = ObservedSampler
    report = {
        "owner": "Mert", "check": "frozen_223_228_baseline_15fps", "mode": "replay",
        "started_at_utc": datetime.now(timezone.utc).isoformat(),
        "job_id": os.environ["SLURM_JOB_ID"], "node": os.environ.get("SLURMD_NODENAME"),
        "git_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "gpu": torch.cuda.get_device_name(0), "python": sys.version.split()[0],
        "packages": {name: version(name) for name in ("torch", "ultralytics", "opencv-python", "lap")},
        "weights": weights.name, "weights_sha256": sha(weights),
        "count_script_sha256": sha(ROOT / "evaluation/check_counts.py"),
        "runner_sha256": sha(Path(__file__)), "run_plan_sha256": sha(OUT / "run-plan.json"),
        "counting_rule": plan["counting_rule"], "comparison_policy": plan["comparison_policy"],
        "cli_endpoint": plan["cli_endpoint"], "review_endpoint": plan["review_endpoint"],
        "model_event_time_basis": "hysteresis-confirmation frame OpenCV source-media time; not interpolated crossing time",
        "runs": [], "manual_comparison_performed": False,
        "limitations": [
            "No camera enablement, geometry edit, detector/tracker change or training.",
            "No manual count, event matching or accuracy acceptance is part of this execution.",
            "Model outputs remain private until independent ledger freeze.",
            "Decoder-relative time equals raw PTS minus its observed origin; no synthetic re-timing.",
            "Source PTS gaps and requested sampler FPS do not establish complete footage coverage.",
            "Existing inclusive-end CLI behavior is preserved; strict-window filtering is a separate comparison step.",
        ],
    }
    for camera in plan["cameras"]:
        cam = camera["camera_id"]
        geometry_path = ROOT / camera["geometry_path"]
        config = json.loads(geometry_path.read_text())
        assert sha(geometry_path) == camera["raw_geometry_sha256"]
        assert canonical(config) == camera["canonical_full_json_sha256"]
        assert selected_geometry(config, camera, plan) == camera["selected_geometry_sha256"]
        assert not config["enabled"] and config["image_geometry_status"] == "unvalidated"
        clip = ROOT / camera["clip"]
        assert sha(clip) == camera["clip_sha256"]
        inventory = json.loads((OUT / f"{cam}-acquisition.json").read_text())
        for window in plan["windows"]:
            start, end = window["start_s"], window["end_s"]
            selected_times.clear()
            loaded.clear()
            torch.cuda.reset_peak_memory_stats(0)
            began = time.monotonic()
            sys.argv = ["evaluation.check_counts", "count", cam, "--clip", str(clip),
                        "--start", str(start), "--seconds", str(end - start), "--weights", str(weights),
                        "--image-size", "640", "--fps", "15"]
            with (OUT / f"{cam}-{start}-console.private.log").open("w") as console:
                with contextlib.redirect_stdout(console), contextlib.redirect_stderr(console):
                    runpy.run_module("evaluation.check_counts", run_name="__main__")
            torch.cuda.synchronize(0)
            assert len(loaded) == 1
            model = loaded[0]
            device = str(next(model.predictor.model.model.parameters()).device)
            assert device == "cuda:0", "Actual inference backend must use CUDA."
            source = ROOT / "data/raw/count_check" / f"{cam}_{start}s_{end-start}s_yolo11n_640_15fps_counts.json"
            value = json.loads(source.read_text())
            assert value["camera_id"] == cam and value["weights"] == weights.name
            assert value["image_size"] == 640 and value["sample_fps"] == 15
            assert value["frames_processed"] == len(selected_times) and selected_times
            assert all(start <= t <= end for t in selected_times)
            assert all(a < b for a, b in zip(selected_times, selected_times[1:]))
            destination = OUT / source.name
            destination.write_bytes(source.read_bytes())
            origin = inventory["first_raw_pts"]
            item = {
                "camera_id": cam, "window_role": window["role"], "start_s": start, "end_s": end,
                "selected_gate_id": camera["selected_gate_id"], "selected_gate": camera["selected_gate"],
                "raw_geometry_sha256": sha(geometry_path), "canonical_full_json_sha256": canonical(config),
                "selected_geometry_sha256": selected_geometry(config, camera, plan),
                "metrics_policy": camera["metrics_policy"], "clip_sha256": sha(clip),
                "recording_metadata_sha256": sha(clip.with_suffix(".json")),
                "frames_processed": value["frames_processed"], "sample_fps": 15, "image_size": 640,
                "first_sample_media_s": selected_times[0], "last_sample_media_s": selected_times[-1],
                "sample_at_end_boundary": sum(abs(t - end) < 1e-9 for t in selected_times),
                "strict_half_open_sample_count": sum(t < end for t in selected_times),
                "raw_pts_origin": origin, "raw_pts_time_base": "1/90000",
                "first_sample_raw_pts_from_verified_decoder_offset": origin + round(selected_times[0] * 90000),
                "last_sample_raw_pts_from_verified_decoder_offset": origin + round(selected_times[-1] * 90000),
                "selected_media_times_sha256": canonical(selected_times),
                "output_sha256": sha(destination), "private_output": str(destination.relative_to(ROOT)),
                "inference_backend_device": device, "wall_s": time.monotonic() - began,
                "peak_torch_allocated_mib": torch.cuda.max_memory_allocated(0) / 1024**2,
            }
            report["runs"].append(item)
            (OUT / "execution.json").write_text(json.dumps(report, indent=2) + "\n")
            print("COMPLETED", cam, window["role"], "frames", len(selected_times), "device", device, flush=True)
            assert sha(geometry_path) == camera["raw_geometry_sha256"]
            loaded.clear()
            del model
            torch.cuda.empty_cache()
    report["finished_at_utc"] = datetime.now(timezone.utc).isoformat()
    (OUT / "execution.json").write_text(json.dumps(report, indent=2) + "\n")
    print("BOUNDED_BASELINE_FINISHED", flush=True)


if __name__ == "__main__":
    main()
