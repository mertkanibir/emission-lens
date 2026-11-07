"""Check GPU inference on live frames without saving imagery or counting crossings.

Run from the repository root with ``python -m evaluation.gpu_smoke``.
Detection observations can include the same vehicle in multiple frames; they
are not traffic counts, evaluated accuracy, or emissions inputs.
"""

import argparse
import hashlib
import json
import os
import platform
import socket
import statistics
import subprocess
import time
from collections import Counter
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path

import torch
from ultralytics import YOLO

from worker.config import load_cameras
from worker.stream import StreamReader

VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera", default="222")
    parser.add_argument("--frames", type=int, default=50)
    parser.add_argument("--timeout", type=float, default=180)
    parser.add_argument("--weights", default="yolo11n.pt")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.frames < 2 or args.timeout <= 0:
        parser.error("Use at least two frames and a positive timeout.")
    camera = next((row for row in load_cameras() if row.id == args.camera), None)
    if camera is None:
        parser.error("Camera is not enabled in config/cameras/.")
    if not torch.cuda.is_available():
        raise SystemExit("CUDA is unavailable; this check requires an allocated GPU.")

    torch.set_num_threads(1)
    model = YOLO(args.weights)
    reader = StreamReader(camera, target_fps=5)
    started_at = datetime.now(timezone.utc)
    deadline = time.monotonic() + args.timeout
    timings = []
    observations = Counter({name: 0 for name in VEHICLE_CLASSES.values()})
    first = last = None
    frame_shape = None
    warmed_up = False
    reader.start()
    try:
        while len(timings) < args.frames and time.monotonic() < deadline:
            frame = reader.frames.get(timeout_s=0.5)
            if frame is None:
                continue
            torch.cuda.synchronize()
            before = time.perf_counter()
            result = model.predict(
                frame.image,
                device=0,
                imgsz=640,
                conf=0.25,
                classes=list(VEHICLE_CLASSES),
                save=False,
                verbose=False,
            )[0]
            torch.cuda.synchronize()
            elapsed = time.perf_counter() - before
            if not warmed_up:
                warmed_up = True
                print("GPU warmup complete; sampling live camera frames.", flush=True)
                continue
            # AutoBackend owns the inference copy; the original wrapper can stay on CPU.
            backend_device = next(model.predictor.model.model.parameters()).device
            if backend_device.type != "cuda" or result.boxes.data.device.type != "cuda":
                raise RuntimeError("Detector did not execute on CUDA.")
            timings.append(elapsed)
            observations.update(VEHICLE_CLASSES[int(value)] for value in result.boxes.cls.tolist())
            first = first or frame
            last = frame
            frame_shape = list(frame.image.shape)
        if len(timings) != args.frames:
            raise RuntimeError(f"Received {len(timings)} of {args.frames} required frames before timeout.")
        if first.session != last.session or last.media_time_s <= first.media_time_s:
            raise RuntimeError("A continuous advancing camera session was not demonstrated.")
        status = reader.status()
        report = {
            "check": "single_camera_gpu_inference_smoke",
            "mode": "live",
            "camera_id": camera.id,
            "source_url": camera.stream_url,
            "started_at": started_at.isoformat(),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "git_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
            "smoke_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "slurm_job_id": os.environ.get("SLURM_JOB_ID"),
            "host": socket.gethostname(),
            "python": platform.python_version(),
            "packages": {name: version(name) for name in ("torch", "torchvision", "ultralytics", "opencv-python")},
            "cuda_runtime": torch.version.cuda,
            "gpu": torch.cuda.get_device_name(0),
            "inference_backend_device": str(backend_device),
            "model": args.weights,
            "weights_sha256": hashlib.sha256(Path(args.weights).read_bytes()).hexdigest(),
            "inference_settings": {"imgsz": 640, "confidence": 0.25, "device": "cuda:0", "target_sampling_fps": 5},
            "frames": len(timings),
            "warmup_frames_excluded": 1,
            "frame_shape_hwc": frame_shape,
            "media_time_first_s": first.media_time_s,
            "media_time_last_s": last.media_time_s,
            "first_frame_received_at": first.received_at.isoformat(),
            "last_frame_received_at": last.received_at.isoformat(),
            "median_predict_wall_ms": statistics.median(timings) * 1000,
            "mean_predict_wall_ms": statistics.mean(timings) * 1000,
            "peak_torch_allocated_mib": torch.cuda.max_memory_allocated() / 1024**2,
            "reader_state": status.state,
            "reader_session": status.session,
            "reader_frames_kept": status.frames_kept,
            "reader_frames_dropped": status.frames_dropped,
            "detection_observations_by_class": dict(observations),
            "limitations": [
                "Smoke test only; no held-out accuracy or sustained four-camera throughput evaluation.",
                "Repeated per-frame detections are observations, not unique vehicles or line crossings.",
                "Prediction timings include preprocessing and postprocessing and exclude warmup; they are not capture-to-dashboard latency.",
                "Capture UTC is not extracted; frame receipt UTC and relative media time are recorded separately.",
                "No tracking, calibration, traffic aggregation, emissions calculation, or dashboard delivery is tested.",
                "Pretrained classes do not establish pickup, box truck, tractor trailer, Tesla, or fuel type.",
                "Raw frames and annotated imagery are not saved.",
            ],
        }
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(json.dumps(report, indent=2), flush=True)
    finally:
        reader.stop()
        reader.join(timeout=45)


if __name__ == "__main__":
    main()
