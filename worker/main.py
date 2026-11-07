"""Run independent camera trackers and publish honest, aggregate-only status.

Crossing counts require explicitly reviewed image gates. Physical distances
require calibration. Raw frames stay in memory and are not saved.
"""

import argparse
import base64
import hashlib
import json
import math
import os
import signal
import socket
import statistics
import subprocess
import threading
import time
import uuid
from collections import Counter, deque
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from worker.publish import HttpSender, Outbox


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CameraProgress:
    """Timing and observation diagnostics for a single camera, never counts."""

    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        self.frames = 0
        self.observations = Counter()
        self.sessions = set()
        self.media_by_session = {}
        self.timings_ms = []
        self.last_processed_at = None
        self.last_received_at = None
        self._processed_times = deque()
        self._last_media = {}
        self.last_error = None

    def observe(self, frame, vehicles, elapsed_s: float, now: datetime, monotonic_now: float) -> None:
        if frame.camera_id != self.camera_id:
            raise ValueError("Frame belongs to a different camera.")
        if frame.media_time_s <= self._last_media.get(frame.session, -math.inf):
            raise ValueError("Only advancing media frames count as processing progress.")
        self._last_media[frame.session] = frame.media_time_s
        self.sessions.add(frame.session)
        span = self.media_by_session.setdefault(frame.session, {"first_s": frame.media_time_s, "last_s": frame.media_time_s, "frames": 0})
        span["last_s"] = frame.media_time_s
        span["frames"] += 1
        self.frames += 1
        self.observations.update(vehicle.label for vehicle in vehicles)
        self.timings_ms.append(elapsed_s * 1000)
        self.last_processed_at = now
        self.last_received_at = frame.received_at
        self._processed_times.append(monotonic_now)
        self.last_error = None

    def status(self, reader_status, mode: str, now: datetime, monotonic_now: float, ended: bool = False) -> dict:
        while self._processed_times and monotonic_now - self._processed_times[0] > 30:
            self._processed_times.popleft()
        fps = None
        if len(self._processed_times) >= 2:
            span = self._processed_times[-1] - self._processed_times[0]
            fps = (len(self._processed_times) - 1) / span if span > 0 else None
        state = reader_status.state
        if ended or self.last_processed_at is None:
            state = "offline"
        else:
            age = max((now - self.last_processed_at).total_seconds(), (now - self.last_received_at).total_seconds())
            if age > 60:
                state = "offline"
            elif age > 20 or self.last_error:
                state = "degraded"
        return {
            "camera_id": self.camera_id,
            "heartbeat_at": self.last_processed_at.isoformat() if self.last_processed_at else None,
            # Receipt time is not a source/capture UTC timestamp.
            "last_source_timestamp": None,
            "processing_delay_ms": None,
            "fps": fps,
            "state": state,
            "mode": mode,
        }

    def diagnostic(self, reader_status) -> dict:
        times = sorted(self.timings_ms)
        return {
            "processed_frames": self.frames,
            "sessions": sorted(self.sessions),
            "media_by_session": self.media_by_session,
            "median_track_wall_ms": statistics.median(times) if times else None,
            "p95_track_wall_ms": times[min(len(times) - 1, math.ceil(len(times) * 0.95) - 1)] if times else None,
            "tracked_detection_observations_by_class": dict(self.observations),
            "reader_frames_kept": reader_status.frames_kept,
            "reader_frames_dropped": reader_status.frames_dropped,
            "reader_state": reader_status.state,
            "last_processed_at": self.last_processed_at.isoformat() if self.last_processed_at else None,
            "last_received_at": self.last_received_at.isoformat() if self.last_received_at else None,
            "last_error": self.last_error,
        }


def envelope(run: dict, statuses: list[dict], traffic: list[dict]) -> dict:
    return {
        "contract_version": "1.1", "batch_id": str(uuid.uuid4()), "revision": 0,
        "run": dict(run), "statuses": statuses, "traffic": traffic, "emissions": [],
    }


class DeviceModel:
    """Supply an explicit inference device without modifying the tracker API."""

    def __init__(self, model, device):
        self.model = model
        self.names = model.names
        self.device = device

    def track(self, image, **kwargs):
        return self.model.track(image, device=self.device, save=False, **kwargs)

    @property
    def predictor(self):
        return getattr(self.model, "predictor", None)


def preview_url(ingest_url: str) -> str:
    parts = urlsplit(ingest_url)
    if not parts.path.rstrip("/").endswith("/api/worker"):
        raise ValueError("Set EMISSION_LENS_PREVIEW_URL when the ingest path is not /api/worker.")
    return urlunsplit((parts.scheme, parts.netloc, parts.path.rstrip("/")[:-len("worker")] + "frames", "", ""))


def encode_preview(frame, vehicles, run_id: str, mode: str, processed_at: datetime) -> dict:
    """Encode the exact processed frame and its matching overlays in memory."""
    import cv2
    from worker.live_view import draw

    banner = f"{mode.upper()} camera {frame.camera_id} session {frame.session} | RECEIVED {frame.received_at.isoformat()} (not capture)"
    canvas = draw(frame.image, vehicles, banner)
    if canvas.shape[1] > 960:
        height = max(1, round(canvas.shape[0] * 960 / canvas.shape[1]))
        canvas = cv2.resize(canvas, (960, height), interpolation=cv2.INTER_AREA)
    ok, encoded = cv2.imencode(".jpg", canvas, [cv2.IMWRITE_JPEG_QUALITY, 65])
    if not ok:
        raise RuntimeError("Preview JPEG encoding failed.")
    return {
        "camera_id": frame.camera_id, "mode": mode, "run_id": run_id,
        "session": frame.session, "sequence": frame.sequence,
        "received_at": frame.received_at.isoformat(), "processed_at": processed_at.isoformat(),
        "jpeg_base64": base64.b64encode(encoded.tobytes()).decode("ascii"),
    }


class PreviewPublisher:
    """Latest-only in-memory previews; HTTP cannot block the tracking loop."""

    def __init__(self, sender, interval_s: float, encoder=encode_preview):
        self.sender = sender
        self.interval_s = interval_s
        self.encoder = encoder
        self._next_due = {}
        self._pending = {}
        self._ready = threading.Condition()
        self._stopped = False
        self.sent = Counter()
        self.failures = Counter()
        self._thread = threading.Thread(target=self._deliver, name="preview-publisher", daemon=True)
        self._thread.start()

    def submit(self, frame, vehicles, run_id: str, mode: str, processed_at: datetime, now: float) -> None:
        if now < self._next_due.get(frame.camera_id, -math.inf):
            return
        self._next_due[frame.camera_id] = now + self.interval_s
        try:
            body = json.dumps(self.encoder(frame, vehicles, run_id, mode, processed_at), allow_nan=False).encode()
        except Exception:
            with self._ready:
                self.failures[frame.camera_id] += 1
            return
        with self._ready:
            # At most one pending JPEG per selected camera. New evidence
            # replaces unsent preview imagery instead of creating a backlog.
            self._pending[frame.camera_id] = body
            self._ready.notify()

    def _deliver(self):
        while True:
            with self._ready:
                self._ready.wait_for(lambda: self._stopped or self._pending)
                if self._stopped:
                    return
                camera_id = next(iter(self._pending))
                body = self._pending.pop(camera_id)
            try:
                delivered = self.sender(body)
            except Exception:
                delivered = False
            with self._ready:
                (self.sent if delivered else self.failures)[camera_id] += 1

    def close(self):
        with self._ready:
            self._stopped = True
            self._pending.clear()
            self._ready.notify()
        self._thread.join(timeout=1.5)

    def diagnostic(self):
        with self._ready:
            return {"sent_by_camera": dict(self.sent), "failure_count_by_camera": dict(self.failures)}


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--camera", action="append", help="Camera ID; repeat, or omit for all enabled cameras.")
    result.add_argument("--seconds", type=float, default=60)
    result.add_argument("--weights", type=Path, default=Path("weights/yolo11n.pt"))
    result.add_argument("--image-size", type=int, default=640)
    result.add_argument("--fps", type=float, default=5)
    result.add_argument("--device", default="0", help="Ultralytics device, e.g. 0 or cpu.")
    result.add_argument("--require-cuda", action="store_true")
    result.add_argument("--require-delivery", action="store_true", help="Fail if publishing is disabled or final batches remain queued.")
    result.add_argument("--publish-every", type=float, default=5)
    result.add_argument("--preview-every", type=float, default=0, help="Optional annotated in-memory preview interval; 0 disables.")
    result.add_argument("--outbox", type=Path, default=Path("runs/worker-outbox"))
    result.add_argument("--output", type=Path, required=True)
    result.add_argument("--replay-file", type=Path, help="Local clip for one --camera; visibly published as replay.")
    result.add_argument("--measurement-config", type=Path, help="Optional reviewed image ROI/gates JSON; no geometry enabled by default.")
    result.add_argument("--count-gate-id", help="Required explicit counting gate when a measurement config has multiple gates.")
    return result


def run(args, stop_requested=None) -> dict:
    # Heavy inference imports stay out of pure delivery/status tests and --help.
    import cv2
    import torch
    from importlib.metadata import version
    from worker.config import load_cameras
    from worker.detect import load_model
    from worker.stream import StreamReader
    from worker.track import CameraTracker

    if args.require_cuda and (args.device == "cpu" or not torch.cuda.is_available()):
        raise RuntimeError("CUDA is required; run inside an allocated GPU job.")
    torch.set_num_threads(1)
    cameras = [c for c in load_cameras() if not args.camera or c.id in args.camera]
    if not cameras or (args.camera and set(args.camera) != {c.id for c in cameras}):
        raise ValueError("Requested camera must be enabled in config/cameras/.")
    if args.replay_file and (len(cameras) != 1 or not args.replay_file.is_file()):
        raise ValueError("Replay requires one camera and an existing local clip.")
    mode = "replay" if args.replay_file else "live"
    measurement_config = None
    if args.measurement_config:
        from worker.metrics import MetricsConfig
        measurement_bytes = args.measurement_config.read_bytes()
        measurement_config = MetricsConfig.from_dict(json.loads(measurement_bytes))
        if measurement_config.camera_id not in {camera.id for camera in cameras}:
            raise ValueError("Measurement camera must be selected and enabled.")
    elif args.count_gate_id:
        raise ValueError("A counting gate requires --measurement-config.")
    url, token = os.environ.get("EMISSION_LENS_INGEST_URL"), os.environ.get("EMISSION_LENS_WORKER_TOKEN")
    if bool(url) != bool(token):
        raise ValueError("Set both ingest URL and worker token, or neither for diagnostic-only execution.")
    if args.require_delivery and not url:
        raise ValueError("Required delivery needs an ingest URL and worker token.")
    outbox = Outbox(args.outbox, HttpSender(url, token)) if url else None
    previews = None
    if args.preview_every > 0:
        if not url:
            raise ValueError("Previews need the configured ingest endpoint and worker token.")
        endpoint = os.environ.get("EMISSION_LENS_PREVIEW_URL") or preview_url(url)
        previews = PreviewPublisher(HttpSender(endpoint, token, timeout_s=1.0), args.preview_every)
    started = utc_now()
    run_record = {
        "run_id": str(uuid.uuid4()), "model_version": str(args.weights.name),
        "device": None, "started_at": started.isoformat(), "ended_at": None, "mode": mode,
    }
    progress = {camera.id: CameraProgress(camera.id) for camera in cameras}
    models = {camera.id: DeviceModel(load_model(args.weights), args.device) for camera in cameras}
    vehicle_labels = frozenset({"car", "tesla", "pickup", "truck", "box_truck", "tractor_trailer", "bus", "motorcycle", "unknown"})
    trackers = {camera.id: CameraTracker(weights=args.weights, labels=vehicle_labels, image_size=args.image_size, model=models[camera.id]) for camera in cameras}
    metrics = aggregate = None
    if measurement_config:
        from worker.aggregate import MinuteAggregator
        from worker.metrics import CameraMetrics
        labels = frozenset(models[measurement_config.camera_id].names.values()) & vehicle_labels
        if "tesla" in labels:
            labels |= {"car"}  # TrackLabeler's conservative Tesla fallback.
        aggregate = MinuteAggregator(measurement_config, run_record["run_id"], mode, args.count_gate_id, labels)
        metrics = CameraMetrics(measurement_config)
        measurement_hash = hashlib.sha256(measurement_bytes).hexdigest()
        if aggregate.enabled:
            from worker.timing import MEDIA_CLOCK_VERSION
            run_record["model_version"] += f"|m:{measurement_config.version}|g:{aggregate.count_gate_id}|s:{measurement_hash[:16]}|t:{MEDIA_CLOCK_VERSION}"
            if len(run_record["model_version"]) > 256:
                raise ValueError("Model, measurement version and gate identifiers exceed the provenance field length.")

    class ReplayReader(StreamReader):
        def run(self):
            capture = cv2.VideoCapture(str(args.replay_file))
            if not capture.isOpened():
                raise RuntimeError("Local replay clip could not be opened.")
            # Pace grab() by media FPS so the shared sampler/buffer is exercised
            # without decoding the entire clip in a burst or silently looping it.
            fps = capture.get(cv2.CAP_PROP_FPS)
            interval = 1 / fps if fps > 0 else 1 / 30
            outer = self
            class Paced:
                def grab(self):
                    if outer._stop_requested.wait(interval):
                        return False
                    return capture.grab()
                def get(self, prop):
                    return capture.get(prop)
                def retrieve(self):
                    return capture.retrieve()
            try:
                self._read_session(Paced())
            finally:
                capture.release()

    readers = {camera.id: (ReplayReader if args.replay_file else StreamReader)(camera, target_fps=args.fps) for camera in cameras}
    stop_requested = stop_requested or threading.Event()
    deadline = time.monotonic() + args.seconds
    next_publish = time.monotonic()
    verified_devices = set()
    failure = None

    def publish(ended=False):
        now = utc_now()
        statuses = [progress[c.id].status(readers[c.id].status(), mode, now, time.monotonic(), ended) for c in cameras]
        if outbox:
            # Unconfigured metrics are unavailable, not empty observations.
            # Do not reserve a camera-minute with an all-null placeholder.
            outbox.enqueue(envelope(run_record, statuses, []))
            if aggregate:
                for batch in aggregate.batches(run_record):
                    outbox.enqueue(batch)
            outbox.flush()

    for reader in readers.values():
        reader.start()
    try:
        while not stop_requested.is_set() and time.monotonic() < deadline:
            found_frame = False
            for camera in cameras:
                frame = readers[camera.id].frames.get(timeout_s=0.01)
                if frame is None:
                    continue
                found_frame = True
                before = time.perf_counter()
                vehicles = trackers[camera.id].update(frame)
                model = models[camera.id].model
                backend_device = next(model.predictor.model.model.parameters()).device
                if backend_device.type == "cuda":
                    torch.cuda.synchronize(backend_device)
                if args.require_cuda and backend_device.type != "cuda":
                    raise RuntimeError("Tracker inference did not execute on CUDA.")
                verified_devices.add(str(backend_device))
                run_record["device"] = ",".join(sorted(verified_devices))
                processed_at = utc_now()
                progress[camera.id].observe(frame, vehicles, time.perf_counter() - before, processed_at, time.monotonic())
                if metrics and camera.id == measurement_config.camera_id:
                    aggregate.observe(frame, metrics.update(frame, vehicles))
                if previews:
                    previews.submit(frame, vehicles, run_record["run_id"], mode, processed_at, time.monotonic())
            if time.monotonic() >= next_publish:
                publish()
                next_publish = time.monotonic() + args.publish_every
            if not found_frame:
                stop_requested.wait(0.02)
        missing = [camera_id for camera_id, state in progress.items() if state.frames == 0]
        if missing:
            raise RuntimeError("No advancing frames processed for cameras: " + ", ".join(missing))
    except BaseException as error:
        failure = type(error).__name__
        raise
    finally:
        run_record["ended_at"] = utc_now().isoformat()
        for reader in readers.values():
            reader.stop()
        shutdown_error = None
        try:
            publish(ended=True)
            if args.require_delivery and outbox.pending():
                raise RuntimeError("Required worker delivery is incomplete; queued batches retained.")
        except Exception as error:
            if failure is None:
                shutdown_error = error
                failure = type(error).__name__
        finally:
            if previews:
                previews.close()
            # All threads stop concurrently; one shared deadline bounds shutdown.
            shutdown_deadline = time.monotonic() + 45
            for reader in readers.values():
                reader.join(max(0, shutdown_deadline - time.monotonic()))
            report = {
                "check": "multi_camera_tracking_delivery", "run": run_record,
                "finished_at": utc_now().isoformat(), "host": socket.gethostname(),
                "slurm_job_id": os.environ.get("SLURM_JOB_ID"),
                "git_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip(),
                "weights_sha256": hashlib.sha256(args.weights.read_bytes()).hexdigest(),
                "runtime_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                "settings": {"target_sampling_fps": args.fps, "image_size": args.image_size, "duration_s": args.seconds, "device": args.device},
                "packages": {name: version(name) for name in ("torch", "ultralytics", "opencv-python")},
                "cuda_runtime": torch.version.cuda,
                "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
                "peak_torch_allocated_mib": torch.cuda.max_memory_allocated() / 1024**2 if torch.cuda.is_available() else None,
                "cameras": {c.id: progress[c.id].diagnostic(readers[c.id].status()) for c in cameras},
                "delivery": {"enabled": bool(outbox), "delivered_batches": outbox.delivered if outbox else 0, "attempts": outbox.attempts if outbox else 0, "pending_batches": len(outbox.pending()) if outbox else 0},
                "previews": {"enabled": bool(previews), **(previews.diagnostic() if previews else {})},
                "measurements": {**aggregate.diagnostic(), "config_sha256": measurement_hash} if aggregate else {"enabled": False},
                "failure": failure,
                "limitations": [
                    "Tracked detection observations are repeated per-frame observations, not unique vehicle crossings or evaluated accuracy.",
                    "Counts/image queues require explicitly enabled reviewed image geometry; physical calibration, stopped time, speed and emissions remain unavailable.",
                    "Camera-minutes use a session-local estimated HLS media clock, not receipt windows or verified capture UTC; capture-to-dashboard latency is unavailable.",
                    "Tracking timing includes preprocessing/postprocessing and first-frame model warmup.",
                    "No raw frames, video, or temporary track identifiers are persisted by this runtime; optional annotated previews are sent transiently in memory.",
                    "Tailpipe fuel type cannot be established from a vehicle's appearance.",
                ],
            }
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
            print(json.dumps({"run_id": run_record["run_id"], "processed_frames": {c: p.frames for c, p in progress.items()}, "delivery": report["delivery"], "output": str(args.output)}), flush=True)
        if shutdown_error is not None:
            raise shutdown_error
    return report


def main():
    cli = parser()
    args = cli.parse_args()
    if not all(math.isfinite(value) and value > 0 for value in (args.seconds, args.fps, args.publish_every)) or args.image_size < 32:
        cli.error("Duration, FPS, publish interval and image size must be positive finite values.")
    if not math.isfinite(args.preview_every) or args.preview_every < 0:
        cli.error("Preview interval must be finite and nonnegative.")
    stop = threading.Event()
    for signum in (signal.SIGINT, signal.SIGTERM):
        signal.signal(signum, lambda *_: stop.set())
    run(args, stop)


if __name__ == "__main__":
    main()
