"""Run independent camera trackers and publish honest, aggregate-only status.

Crossing counts require explicitly reviewed image gates. Physical distances
require calibration. Raw frames stay in memory and are not saved.
"""

import argparse
import base64
import copy
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

from worker.publish import HttpSender, Outbox, TraversalBridge, measurement_url, recover_measurement_outbox
from worker.pacing import LiveMediaPacer
from worker.delivery import BackgroundDelivery


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
            # Hold a private image snapshot while encoding happens off the tracker.
            current = copy.copy(frame)
            if hasattr(frame, "image"):
                object.__setattr__(current, "image", frame.image.copy())
            work = (current, tuple(vehicles), run_id, mode, processed_at)
        except Exception:
            with self._ready:
                self.failures[frame.camera_id] += 1
            return
        with self._ready:
            # One unsent frame per camera bounds memory under encoding/network loss.
            self._pending[frame.camera_id] = work
            self._ready.notify()

    def _deliver(self):
        while True:
            with self._ready:
                self._ready.wait_for(lambda: self._stopped or self._pending)
                if self._stopped:
                    return
                camera_id = next(iter(self._pending))
                work = self._pending.pop(camera_id)
            try:
                body = json.dumps(self.encoder(*work), allow_nan=False).encode()
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
    result.add_argument("--warmup", action="store_true", help="Warm the live CUDA detector before connecting camera readers; no observations are generated.")
    result.add_argument("--pace-live", action="store_true", help="Pace live processing by original media time with a four-second initial buffer; replay unchanged.")
    result.add_argument("--require-delivery", action="store_true", help="Fail if publishing is disabled or final batches remain queued.")
    result.add_argument("--publish-every", type=float, default=5)
    result.add_argument("--preview-every", type=float, default=0, help="Optional annotated in-memory preview interval; 0 disables.")
    result.add_argument("--outbox", type=Path, default=Path("runs/worker-outbox"))
    result.add_argument("--output", type=Path, required=True)
    result.add_argument("--replay-file", type=Path, help="Local clip for one --camera; visibly published as replay.")
    result.add_argument("--measurement-config", type=Path, action="append", help="Reviewed image ROI/gates JSON; repeat for independent cameras. Disabled by default.")
    result.add_argument("--count-gate-id", action="append", help="Selected count gate: GATE for one config, or repeat CAMERA=GATE for several.")
    result.add_argument("--traversal-config", type=Path, action="append", help="Private v1 movement/stop policy; repeat by camera. Server registry approval remains separate.")
    return result


def _values(value):
    # Also retain the programmatic Namespace API used by existing launchers.
    return [] if value is None else list(value) if isinstance(value, (list, tuple)) else [value]


def load_measurement_configs(args, camera_ids):
    """Match explicit files and selected gates without depending on file order."""
    from worker.metrics import MetricsConfig

    configured = {}
    for path in _values(args.measurement_config):
        body = Path(path).read_bytes()
        raw = json.loads(body)
        config = MetricsConfig.from_dict(raw)
        if config.camera_id not in camera_ids:
            raise ValueError("Measurement camera must be selected and enabled.")
        if config.camera_id in configured:
            raise ValueError("Only one measurement configuration per camera is allowed.")
        configured[config.camera_id] = {"config": config, "bytes": body, "raw": raw}
    gates = {}
    for selected in _values(args.count_gate_id):
        if "=" in selected:
            camera_id, gate_id = selected.split("=", 1)
        elif len(configured) == 1:
            camera_id, gate_id = next(iter(configured)), selected
        else:
            raise ValueError("Use CAMERA=GATE for multiple measurement configurations.")
        if camera_id not in configured or not gate_id or camera_id in gates:
            raise ValueError("Each counting gate must name one configured camera exactly once.")
        gates[camera_id] = gate_id
    for camera_id, item in configured.items():
        item["count_gate_id"] = gates.get(camera_id)
    return configured


def load_traversal_configs(args, measurements):
    configured = {}
    for path in _values(getattr(args, "traversal_config", None)):
        body = Path(path).read_bytes()
        raw = json.loads(body)
        if (isinstance(raw, dict) and set(raw) == {"bridge_version", "enabled"}
                and raw["bridge_version"] == "1.0" and raw["enabled"] is False):
            continue
        camera_id = raw.get("camera_id") if isinstance(raw, dict) else None
        if camera_id not in measurements or camera_id in configured:
            raise ValueError("Each traversal configuration must match one unique measurement camera.")
        configured[camera_id] = {"raw": raw, "bytes": body}
    return configured


def _config_hashes(item):
    return {
        "config_sha256": hashlib.sha256(item["bytes"]).hexdigest(),
        "canonical_config_sha256": hashlib.sha256(json.dumps(item["raw"], sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest(),
    }


def _by_camera_report(items):
    """Keep the original flat report for a single camera; add explicit scope."""
    if len(items) == 1:
        return {**next(iter(items.values())), "by_camera": items}
    return {"enabled": bool(items), "by_camera": items}


def measurement_directories(outbox, camera_ids, multiple):
    """Do not strand another camera's recovery evidence after a CLI change."""
    root = Path(outbox) / "measurements"
    configured = {camera_id: root / camera_id if multiple else root for camera_id in camera_ids}
    if root.exists():
        retained = [root, *(path for path in root.iterdir() if path.is_dir())]
        for directory in retained:
            has_evidence = (directory / "bridge.checkpoint").exists() or any(directory.glob("*.json"))
            if has_evidence and directory not in configured.values():
                raise ValueError("Unselected measurement outbox retains evidence; drain/review it before changing camera layout or use a fresh run outbox.")
    return configured


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
    measurement_configs = load_measurement_configs(args, {camera.id for camera in cameras})
    traversal_configs = load_traversal_configs(args, measurement_configs)
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
    pacer = LiveMediaPacer(4.0) if getattr(args, "pace_live", False) and mode == "live" else None
    started = utc_now()
    run_record = {
        "run_id": str(uuid.uuid4()), "model_version": str(args.weights.name),
        "device": None, "started_at": started.isoformat(), "ended_at": None, "mode": mode,
    }
    progress = {camera.id: CameraProgress(camera.id) for camera in cameras}
    models = {camera.id: DeviceModel(load_model(args.weights), args.device) for camera in cameras}
    warmup_wall_s = None
    if getattr(args, "warmup", False) and mode == "live":
        import numpy as np
        before_warmup = time.perf_counter()
        image = np.zeros((args.image_size, args.image_size, 3), dtype=np.uint8)
        for adapter in models.values():
            adapter.model.predict(image, device=args.device, imgsz=args.image_size, verbose=False, save=False)
            backend_device = next(adapter.model.predictor.model.model.parameters()).device
            if args.require_cuda and backend_device.type != "cuda":
                raise RuntimeError("Detector warmup did not execute on CUDA.")
            if backend_device.type == "cuda":
                torch.cuda.synchronize(backend_device)
        warmup_wall_s = time.perf_counter() - before_warmup
    vehicle_labels = frozenset({"car", "tesla", "pickup", "truck", "box_truck", "tractor_trailer", "bus", "motorcycle", "unknown"})
    trackers = {camera.id: CameraTracker(weights=args.weights, labels=vehicle_labels, image_size=args.image_size, model=models[camera.id]) for camera in cameras}
    from worker.aggregate import MinuteAggregator
    from worker.metrics import CameraMetrics
    from worker.timing import MEDIA_CLOCK_VERSION

    metrics, aggregates, measurement_provenance = {}, {}, {}
    for camera_id, item in sorted(measurement_configs.items()):
        config = item["config"]
        labels = frozenset(models[camera_id].names.values()) & vehicle_labels
        if "tesla" in labels:
            labels |= {"car"}  # TrackLabeler's conservative Tesla fallback.
        aggregate = MinuteAggregator(config, run_record["run_id"], mode, item["count_gate_id"], labels)
        aggregates[camera_id], metrics[camera_id] = aggregate, CameraMetrics(config)
        gate = next(value for value in item["raw"]["gates"] if value["id"] == aggregate.count_gate_id)
        measurement_provenance[camera_id] = {
            **_config_hashes(item), "image_geometry_version": config.version,
            "count_gate_id": aggregate.count_gate_id,
            "selected_gate_sha256": hashlib.sha256(json.dumps(gate, sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        }
        if camera_id in traversal_configs:
            measurement_provenance[camera_id]["traversal"] = _config_hashes(traversal_configs[camera_id])
    if len(aggregates) == 1:
        camera_id, aggregate = next(iter(aggregates.items()))
        if aggregate.enabled:
            run_record["model_version"] += f"|m:{aggregate.config.version}|g:{aggregate.count_gate_id}|s:{measurement_provenance[camera_id]['config_sha256'][:16]}|t:{MEDIA_CLOCK_VERSION}"
        if camera_id in traversal_configs:
            run_record["model_version"] += "|v:" + measurement_provenance[camera_id]["traversal"]["config_sha256"][:16]
    elif aggregates:
        # One bounded run fingerprint covers every full per-camera hash/gate.
        manifest = json.dumps(measurement_provenance, sort_keys=True, separators=(",", ":")).encode()
        run_record["model_version"] += "|multi:" + hashlib.sha256(manifest).hexdigest()[:32] + "|t:" + MEDIA_CLOCK_VERSION
    if len(run_record["model_version"]) > 256:
        raise ValueError("Model and measurement provenance exceed the supported field length.")

    traversal_bridges, measurement_outboxes = {}, {}
    directories = measurement_directories(args.outbox, traversal_configs, len(aggregates) > 1)
    for camera_id, item in sorted(traversal_configs.items()):
        directory = directories[camera_id]
        state_path = directory / "bridge.checkpoint" if url else None
        traversal_bridges[camera_id] = TraversalBridge.from_config(item["raw"], measurement_configs[camera_id]["config"], run_record, state_path)
        if url:
            endpoint = os.environ.get("EMISSION_LENS_MEASUREMENT_URL") or measurement_url(url)
            measurement_outboxes[camera_id] = Outbox(directory, HttpSender(endpoint, token))
            recover_measurement_outbox(measurement_outboxes[camera_id])

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
    pacing_drop_counts = {camera.id: 0 for camera in cameras}
    failure = None
    delivery = BackgroundDelivery(outbox, measurement_outboxes) if outbox else None

    def publish(ended=False):
        now = utc_now()
        statuses = [progress[c.id].status(readers[c.id].status(), mode, now, time.monotonic(), ended) for c in cameras]
        if outbox:
            # Unconfigured metrics are unavailable, not empty observations.
            # Do not reserve a camera-minute with an all-null placeholder.
            outbox.enqueue(envelope(run_record, statuses, []))
        observation_batches = {camera_id: aggregate.batches(run_record) for camera_id, aggregate in aggregates.items()}
        if outbox:
            for batches in observation_batches.values():
                for batch in batches:
                    outbox.enqueue(batch)
        for camera_id, bridge in traversal_bridges.items():
            measurement_outbox = measurement_outboxes.get(camera_id)
            bridge.publish(run_record, observation_batches[camera_id], measurement_outbox)
        if delivery:
            # Disk publication remains synchronous/durable. HTTP runs separately,
            # with core observations delivered before their dependent evidence.
            delivery.notify()

    for reader in readers.values():
        reader.start()
    try:
        while not stop_requested.is_set() and time.monotonic() < deadline:
            if delivery:
                delivery.raise_if_failed()
            found_frame = False
            for camera in cameras:
                frame = readers[camera.id].frames.get(timeout_s=0.01)
                if frame is None:
                    continue
                found_frame = True
                if pacer is not None:
                    dropped = readers[camera.id].frames.dropped
                    delay = pacer.delay(camera.id, frame.session, frame.media_time_s, time.monotonic(), discontinuity=dropped > pacing_drop_counts[camera.id])
                    pacing_drop_counts[camera.id] = dropped
                    if delay and stop_requested.wait(delay):
                        break
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
                if camera.id in metrics:
                    aggregates[camera.id].observe(frame, metrics[camera.id].update(frame, vehicles))
                if camera.id in traversal_bridges:
                    traversal_bridges[camera.id].observe(frame, vehicles)
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
        except Exception as error:
            if failure is None:
                shutdown_error = error
                failure = type(error).__name__
        finally:
            if delivery:
                delivery_stopped = delivery.close()
                try:
                    delivery.raise_if_failed()
                    if not delivery_stopped:
                        raise RuntimeError("Background delivery exceeded its shutdown bound; queued evidence retained.")
                    if args.require_delivery and (outbox.pending() or any(box.pending() for box in measurement_outboxes.values())):
                        raise RuntimeError("Required worker delivery is incomplete; queued batches retained.")
                except Exception as error:
                    if failure is None:
                        shutdown_error, failure = error, type(error).__name__
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
                "settings": {"target_sampling_fps": args.fps, "image_size": args.image_size, "duration_s": args.seconds, "device": args.device, "live_playback_buffer_s": pacer.buffer_s if pacer else 0, "warmup_wall_s": warmup_wall_s},
                "packages": {name: version(name) for name in ("torch", "ultralytics", "opencv-python")},
                "cuda_runtime": torch.version.cuda,
                "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
                "peak_torch_allocated_mib": torch.cuda.max_memory_allocated() / 1024**2 if torch.cuda.is_available() else None,
                "cameras": {c.id: progress[c.id].diagnostic(readers[c.id].status()) for c in cameras},
                "delivery": {"enabled": bool(outbox), "delivered_batches": outbox.delivered if outbox else 0, "attempts": outbox.attempts if outbox else 0, "pending_batches": len(outbox.pending()) if outbox else 0},
                "background_delivery": delivery.diagnostic() if delivery else {"enabled": False},
                "previews": {"enabled": bool(previews), **(previews.diagnostic() if previews else {})},
                "measurements": _by_camera_report({camera_id: {**aggregate.diagnostic(), **measurement_provenance[camera_id]} for camera_id, aggregate in aggregates.items()}),
                "completed_traversals": _by_camera_report({camera_id: bridge.diagnostic() for camera_id, bridge in traversal_bridges.items()}),
                "measurement_delivery": {"enabled": bool(measurement_outboxes), "delivered_batches": sum(box.delivered for box in measurement_outboxes.values()), "attempts": sum(box.attempts for box in measurement_outboxes.values()), "pending_batches": sum(len(box.pending()) for box in measurement_outboxes.values()), "by_camera": {camera_id: {"delivered_batches": box.delivered, "attempts": box.attempts, "pending_batches": len(box.pending())} for camera_id, box in measurement_outboxes.items()}},
                "failure": failure,
                "limitations": [
                    "Tracked detection observations are repeated per-frame observations, not unique vehicle crossings or evaluated accuracy.",
                    "Counts/image queues require reviewed image geometry. Completed traversals/linked stops require explicit movement and interval policies; physical quantities require separate approved server registries.",
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
