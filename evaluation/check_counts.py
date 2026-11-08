"""Check a camera's gate counts against a manual count on a recorded clip.

1. python -m evaluation.check_counts video 222 --start 60 --seconds 120
   Writes an .avi of that stretch with the gates and a clip clock drawn on it,
   for counting crossings by hand. Footage stays in the ignored data/raw folder.
2. python -m evaluation.check_counts count 222 --start 60 --seconds 120
   Runs the live worker's detector, tracker and gate metrics on the same stretch
   and lists every crossing with its clip time.

The measurement file on disk stays unvalidated. Counting uses an in-memory copy
marked reviewed, only for this check.
"""

import argparse
import json
from collections import Counter
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

import cv2

from worker.config import load_cameras
from worker.detect import PRETRAINED_VEHICLE_LABELS, load_model
from worker.draw_geometry import CLIP_DIR, config_path, positive_side
from worker.metrics import CameraMetrics, MetricsConfig
from worker.stream import Frame, MediaTimeSampler
from worker.track import CameraTracker

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "data" / "raw" / "count_check"
# The live worker's defaults (worker/main.py), so the check measures what runs.
WEIGHTS = Path(__file__).resolve().parents[1] / "weights" / "yolo11n.pt"
IMAGE_SIZE = 640
SAMPLE_FPS = 5.0


def clip_for(camera_id: str) -> Path:
    clips = sorted((CLIP_DIR / camera_id).glob("*.ts"))
    if not clips:
        raise FileNotFoundError(f"no recorded clip for camera {camera_id}")
    return clips[-1]


def clock(seconds: float) -> str:
    return f"{int(seconds // 60)}:{seconds % 60:04.1f}"


def frames_between(clip: Path, start_s: float, seconds: float):
    """Yield (clip time in seconds, image) from start to start + seconds, decoding from the beginning."""
    capture = cv2.VideoCapture(str(clip))
    try:
        while capture.grab():
            t = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
            if t < start_s:
                continue
            if t > start_s + seconds:
                break
            ok, image = capture.retrieve()
            if ok:
                yield t, image
    finally:
        capture.release()


def reviewed_copy(config: MetricsConfig) -> MetricsConfig:
    return replace(config, enabled=True, image_geometry_status="reviewed")


def load_config(camera_id: str) -> MetricsConfig:
    return MetricsConfig.from_dict(json.loads(config_path(camera_id).read_text(encoding="utf-8")))


def draw_gates(image, config: MetricsConfig, t: float, label: str):
    h, w = image.shape[:2]
    px = lambda p: (int(p[0] * w), int(p[1] * h))
    for gate in config.gates:
        cv2.line(image, px(gate.start), px(gate.end), (0, 220, 255), 3)
        mid = ((gate.start[0] + gate.end[0]) / 2, (gate.start[1] + gate.end[1]) / 2)
        nx, ny = positive_side(gate.start, gate.end)
        tip = (mid[0] + nx * 0.04 * h / w, mid[1] + ny * 0.04)
        cv2.arrowedLine(image, px(mid), px(tip), (0, 220, 255), 2, tipLength=0.4)
        cv2.putText(image, f"{gate.id} +", px(tip), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 255), 2)
    cv2.rectangle(image, (0, h - 40), (w, h), (0, 0, 0), -1)
    cv2.putText(image, f"{label} | clip time {clock(t)}", (10, h - 12),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    return image


def export_video(camera_id: str, start_s: float, seconds: float) -> Path:
    config = load_config(camera_id)
    clip = clip_for(camera_id)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{camera_id}_{int(start_s)}s_{int(seconds)}s.avi"
    fps = cv2.VideoCapture(str(clip)).get(cv2.CAP_PROP_FPS) or 15
    writer = None
    for t, image in frames_between(clip, start_s, seconds):
        if writer is None:
            h, w = image.shape[:2]
            writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (w, h))
        writer.write(draw_gates(image, config, t, f"REPLAY camera {camera_id}"))
    if writer is None:
        raise RuntimeError("no frames in that stretch of the clip")
    writer.release()
    return path


def summarize(crossings: list[dict]) -> dict:
    by_gate = {}
    for c in crossings:
        gate = by_gate.setdefault(c["gate"], {"total": 0, "by_direction": Counter(), "by_class": Counter(), "times": []})
        gate["total"] += 1
        gate["by_direction"][c["direction"]] += 1
        gate["by_class"][c["class"]] += 1
        gate["times"].append(clock(c["clip_time_s"]))
    return {g: {**v, "by_direction": dict(v["by_direction"]), "by_class": dict(v["by_class"])}
            for g, v in sorted(by_gate.items())}


def count(camera_id: str, start_s: float, seconds: float, weights: Path = WEIGHTS) -> dict:
    config = reviewed_copy(load_config(camera_id))
    camera = next(c for c in load_cameras() if c.id == camera_id)
    tracker = CameraTracker(labels=PRETRAINED_VEHICLE_LABELS, image_size=IMAGE_SIZE, model=load_model(weights))
    metrics = CameraMetrics(config)
    sampler = MediaTimeSampler(SAMPLE_FPS)
    crossings, processed = [], 0
    for t, image in frames_between(clip_for(camera.id), start_s, seconds):
        if not sampler.should_keep(t):
            continue
        processed += 1
        frame = Frame(camera.id, 1, processed, t, datetime.now(timezone.utc), image)
        for event in metrics.update(frame, tracker.update(frame)).crossings:
            crossings.append({"gate": event.gate_id, "direction": event.direction,
                              "class": event.vehicle_class, "clip_time_s": event.media_time_s})
    return {"camera_id": camera_id, "geometry_version": config.version, "start_s": start_s,
            "seconds": seconds, "frames_processed": processed, "weights": weights.name,
            "image_size": IMAGE_SIZE, "sample_fps": SAMPLE_FPS, "gates": summarize(crossings)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Check gate counts against a manual count.")
    parser.add_argument("command", choices=["video", "count"])
    parser.add_argument("camera_id")
    parser.add_argument("--start", type=float, default=60)
    parser.add_argument("--seconds", type=float, default=120)
    args = parser.parse_args()
    if args.command == "video":
        print(f"wrote {export_video(args.camera_id, args.start, args.seconds)}")
    else:
        result = count(args.camera_id, args.start, args.seconds)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out = OUTPUT_DIR / f"{args.camera_id}_{int(args.start)}s_{int(args.seconds)}s_counts.json"
        out.write_text(json.dumps(result, indent=1), encoding="utf-8")
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
