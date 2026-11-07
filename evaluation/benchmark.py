"""Bounded live multi-camera tracking benchmark; writes diagnostics, never imagery.

Run with ``python -m evaluation.benchmark --seconds 120 --output runs/benchmark.json``.
Per-frame tracked boxes are repeated observations, not unique vehicle counts.
"""

import argparse
import hashlib
import json
import math
import os
import platform
import socket
import statistics
import subprocess
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path


def positive_finite(value: str) -> float:
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise argparse.ArgumentTypeError("Use a positive finite number.")
    return result


def percentile(values: list[float], quantile: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    index = (len(ordered) - 1) * quantile
    low, high = math.floor(index), math.ceil(index)
    return ordered[low] + (ordered[high] - ordered[low]) * (index - low)


@dataclass
class CameraSample:
    """Retain only scalar diagnostics, with media time kept per reader session."""

    timings_ms: list[float] = field(default_factory=list)
    buffer_ages_ms: list[float] = field(default_factory=list)
    observations: Counter = field(default_factory=Counter)
    sessions: dict = field(default_factory=dict)
    nonadvancing_frames: int = 0

    def add(self, frame, vehicles, elapsed_ms: float, processed_at: float) -> None:
        self.timings_ms.append(elapsed_ms)
        # This is local receipt-to-processing age, not camera capture latency.
        self.buffer_ages_ms.append(max(0.0, processed_at - frame.received_at.timestamp()) * 1000)
        self.observations.update(vehicle.label for vehicle in vehicles)
        session = self.sessions.setdefault(frame.session, {
            "session": frame.session,
            "frames": 0,
            "first_media_s": frame.media_time_s,
            "last_media_s": frame.media_time_s,
            "first_received_at": frame.received_at.isoformat(),
            "last_received_at": frame.received_at.isoformat(),
            "maximum_media_gap_s": None,
        })
        if session["frames"]:
            gap = frame.media_time_s - session["last_media_s"]
            if gap <= 0:
                self.nonadvancing_frames += 1
            else:
                session["maximum_media_gap_s"] = max(session["maximum_media_gap_s"] or 0, gap)
        session["frames"] += 1
        session["last_media_s"] = frame.media_time_s
        session["last_received_at"] = frame.received_at.isoformat()

    def summary(self, wall_s: float) -> dict:
        sessions = list(self.sessions.values())
        span = sum(max(0.0, row["last_media_s"] - row["first_media_s"]) for row in sessions)
        return {
            "frames_processed": len(self.timings_ms),
            "processed_wall_fps": len(self.timings_ms) / wall_s if wall_s > 0 else None,
            "processed_media_span_s": span,
            "media_span_per_wall_second": span / wall_s if wall_s > 0 else None,
            "median_tracking_wall_ms": statistics.median(self.timings_ms) if self.timings_ms else None,
            "p95_tracking_wall_ms": percentile(self.timings_ms, 0.95),
            "max_tracking_wall_ms": max(self.timings_ms, default=None),
            "median_receipt_to_processing_ms": statistics.median(self.buffer_ages_ms) if self.buffer_ages_ms else None,
            "p95_receipt_to_processing_ms": percentile(self.buffer_ages_ms, 0.95),
            "nonadvancing_frames": self.nonadvancing_frames,
            "sessions": sessions,
            "tracked_box_observations_by_class": dict(self.observations),
        }


def inference_device(model) -> str:
    """Inspect the actual AutoBackend; the original YOLO wrapper may stay on CPU."""
    return str(next(model.predictor.model.model.parameters()).device)


def run(args) -> dict:
    # Keeping heavy imports here allows diagnostic arithmetic tests without CUDA.
    import torch
    from worker.config import load_cameras
    from worker.detect import load_model
    from worker.stream import StreamReader
    from worker.track import CameraTracker

    if not torch.cuda.is_available():
        raise RuntimeError("An allocated CUDA GPU is required; no CPU fallback is reported as GPU work.")
    torch.set_num_threads(args.threads)
    torch.cuda.set_device(args.device)
    torch.cuda.reset_peak_memory_stats(args.device)
    cameras = load_cameras()
    if args.camera:
        requested = set(args.camera)
        cameras = [camera for camera in cameras if camera.id in requested]
        missing = requested - {camera.id for camera in cameras}
        if missing:
            raise ValueError(f"Cameras are not enabled in config/cameras/: {sorted(missing)}")
    if not cameras:
        raise ValueError("No enabled cameras.")

    # Independent models also guarantee independent Ultralytics tracker state.
    models, trackers, readers = {}, {}, {}
    weights = Path(args.weights)
    for camera in cameras:
        model = load_model(weights)
        model.to(f"cuda:{args.device}")
        model.overrides["device"] = args.device
        models[camera.id] = model
        trackers[camera.id] = CameraTracker(model=model, image_size=args.image_size)
        readers[camera.id] = StreamReader(camera, target_fps=args.fps)

    started_at = datetime.now(timezone.utc)
    startup_started = time.monotonic()
    warmed = set()
    samples = {camera.id: CameraSample() for camera in cameras}
    start_statuses = {}
    failure = None
    measurement_started = None
    wall_s = 0.0
    try:
        for reader in readers.values():
            reader.start()
        while len(warmed) < len(cameras):
            if time.monotonic() - startup_started > args.startup_timeout:
                raise RuntimeError(f"No warmup frame from cameras: {sorted(set(readers) - warmed)}")
            for camera_id, reader in readers.items():
                if camera_id in warmed:
                    continue
                frame = reader.frames.get(timeout_s=0.05)
                if frame is None:
                    continue
                trackers[camera_id].update(frame)
                torch.cuda.synchronize(args.device)
                if inference_device(models[camera_id]) != f"cuda:{args.device}":
                    raise RuntimeError(f"Camera {camera_id} inference did not execute on the requested CUDA device.")
                warmed.add(camera_id)
                print(f"Camera {camera_id}: CUDA tracker warmed; excluding this frame.", flush=True)

        # Starting-point counters separate measurement drops from warmup drops.
        start_statuses = {camera_id: reader.status() for camera_id, reader in readers.items()}
        measurement_started = time.monotonic()
        while time.monotonic() - measurement_started < args.seconds:
            progressed = False
            for camera_id, reader in readers.items():
                if time.monotonic() - measurement_started >= args.seconds:
                    break
                frame = reader.frames.get(timeout_s=0.005)
                if frame is None:
                    continue
                progressed = True
                torch.cuda.synchronize(args.device)
                before = time.perf_counter()
                vehicles = trackers[camera_id].update(frame)
                torch.cuda.synchronize(args.device)
                elapsed_ms = (time.perf_counter() - before) * 1000
                samples[camera_id].add(frame, vehicles, elapsed_ms, time.time())
            if not progressed:
                time.sleep(0.01)
        wall_s = time.monotonic() - measurement_started
        for camera_id, model in models.items():
            if inference_device(model) != f"cuda:{args.device}":
                raise RuntimeError(f"Camera {camera_id} inference backend left CUDA.")
        empty = [camera_id for camera_id, sample in samples.items() if len(sample.timings_ms) < 2]
        if empty:
            raise RuntimeError(f"Fewer than two measured frames from cameras: {empty}")
    except Exception as exc:
        failure = f"{type(exc).__name__}: {exc}"
        if measurement_started is not None:
            wall_s = time.monotonic() - measurement_started
    finally:
        final_statuses = {camera_id: reader.status() for camera_id, reader in readers.items()}
        for reader in readers.values():
            reader.stop()
        # All joins share one deadline rather than waiting 45 seconds per camera.
        join_deadline = time.monotonic() + 45
        for reader in readers.values():
            reader.join(timeout=max(0, join_deadline - time.monotonic()))

    report = {
        "check": "multi_camera_cuda_tracking_benchmark",
        "success": failure is None,
        "failure": failure,
        "mode": "live",
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
        "measurement_wall_s": wall_s,
        "requested_measurement_s": args.seconds,
        "warmup_frames_excluded_per_camera": {camera_id: int(camera_id in warmed) for camera_id in readers},
        "host": socket.gethostname(),
        "slurm_job_id": os.environ.get("SLURM_JOB_ID"),
        "git_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
        "benchmark_script_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "weights": str(weights),
        "weights_sha256": hashlib.sha256(weights.read_bytes()).hexdigest(),
        "python": platform.python_version(),
        "packages": {name: version(name) for name in ("torch", "torchvision", "ultralytics", "opencv-python", "lap")},
        "cuda_runtime": torch.version.cuda,
        "gpu": torch.cuda.get_device_name(args.device),
        "peak_torch_allocated_mib": torch.cuda.max_memory_allocated(args.device) / 1024**2,
        "settings": {
            "imgsz": args.image_size,
            "tracking_confidence": 0.1,
            "tracker": "bytetrack.yaml",
            "device": f"cuda:{args.device}",
            "target_sampling_fps_per_camera": args.fps,
            "torch_threads": args.threads,
            "independent_models_and_trackers": True,
        },
        "cameras": {},
        "limitations": [
            "Tracked-box observations include the same vehicle in multiple frames; these are not line crossings or unique vehicle counts.",
            "This bounded run does not establish held-out detection, tracking, classification, stopped-time or calibration accuracy.",
            "Tracking wall times include preprocessing, inference, postprocessing and association, but exclude stream waits and per-camera warmup.",
            "Receipt-to-processing age measures local buffer age. Capture UTC is unavailable; no capture-to-dashboard latency is measured.",
            "Media span includes gaps between processed samples and is not footage coverage. Sessions are separate and never added as overlapping source-time estimates.",
            "Memory is peak Torch allocated memory across these models, not total GPU memory use.",
            "Live delivery, calibrated traffic aggregation and emissions calculations are outside this benchmark.",
            "No raw frames or temporary vehicle identities are persisted.",
        ],
    }
    for camera in cameras:
        camera_id = camera.id
        before = start_statuses.get(camera_id)
        after = final_statuses[camera_id]
        report["cameras"][camera_id] = {
            "source_url": camera.stream_url,
            **samples[camera_id].summary(wall_s),
            "reader_final_state": after.state,
            "reader_session": after.session,
            "reader_reconnections_during_measurement": max(0, after.session - before.session) if before else None,
            "reader_frames_kept_during_measurement": after.frames_kept - before.frames_kept if before else None,
            "reader_frames_dropped_during_measurement": after.frames_dropped - before.frames_dropped if before else None,
            "reader_frames_kept_total": after.frames_kept,
            "reader_frames_dropped_total": after.frames_dropped,
            "reader_thread_stopped": not readers[camera_id].is_alive(),
            "inference_backend_device": inference_device(models[camera_id]) if camera_id in warmed else None,
        }
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera", action="append", help="Enabled camera ID; repeat to choose a subset. Default: all.")
    parser.add_argument("--seconds", type=positive_finite, default=120.0)
    parser.add_argument("--startup-timeout", type=positive_finite, default=90.0)
    parser.add_argument("--fps", type=positive_finite, default=5.0)
    parser.add_argument("--weights", default="yolo11n.pt")
    parser.add_argument("--image-size", type=int, default=640)
    parser.add_argument("--device", type=int, default=0)
    parser.add_argument("--threads", type=int, default=1)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.seconds > 600 or args.startup_timeout > 600 or args.fps > 30:
        parser.error("Keep duration and startup timeout at most 600 seconds and sampling at most 30 fps.")
    if args.image_size < 32 or args.image_size > 1920 or args.device < 0 or args.threads < 1:
        parser.error("Use image size 32–1920, nonnegative device, and at least one thread.")
    report = run(args)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2), flush=True)
    if not report["success"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
