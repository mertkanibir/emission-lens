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


def export_video(camera_id: str, start_s: float, seconds: float, clip: Path | None = None) -> Path:
    config = load_config(camera_id)
    clip = clip or clip_for(camera_id)
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
        gate = by_gate.setdefault(c["gate"], {"total": 0, "by_direction": Counter(), "by_class": Counter(),
                                              "times": [], "events": []})
        gate["total"] += 1
        gate["by_direction"][c["direction"]] += 1
        gate["by_class"][c["class"]] += 1
        gate["times"].append(clock(c["clip_time_s"]))
        gate["events"].append({"clip_time_s": round(c["clip_time_s"], 3), "direction": c["direction"]})
    return {g: {**v, "by_direction": dict(v["by_direction"]), "by_class": dict(v["by_class"])}
            for g, v in sorted(by_gate.items())}


def read_manual(path: Path) -> list[dict]:
    """Read hand-recorded crossings: one per line as 'm:ss.s +' or 'm:ss.s -'; '#' starts a comment."""
    events = []
    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        parts = line.split()
        if len(parts) != 2 or parts[1] not in ("+", "-"):
            raise ValueError(f"line {number}: expected 'm:ss.s +' or 'm:ss.s -', got {raw!r}")
        minutes, seconds = parts[0].split(":")
        events.append({"clip_time_s": int(minutes) * 60 + float(seconds),
                       "direction": "positive" if parts[1] == "+" else "negative"})
    return events


def match_events(manual: list[dict], model: list[dict], tolerance_s: float) -> dict:
    """Pair each model crossing with one manual crossing of the same direction within the tolerance.

    Pairs are made closest-in-time first, so one early pairing cannot steal a better match.
    """
    candidates = sorted(
        (abs(m["clip_time_s"] - p["clip_time_s"]), i, j)
        for i, m in enumerate(manual) for j, p in enumerate(model)
        if m["direction"] == p["direction"] and abs(m["clip_time_s"] - p["clip_time_s"]) <= tolerance_s
    )
    used_manual, used_model, pairs = set(), set(), []
    for gap, i, j in candidates:
        if i not in used_manual and j not in used_model:
            used_manual.add(i)
            used_model.add(j)
            pairs.append(gap)
    matched = len(pairs)
    return {
        "manual": len(manual),
        "model": len(model),
        "matched": matched,
        "missed": [clock(m["clip_time_s"]) + (" +" if m["direction"] == "positive" else " -")
                   for i, m in enumerate(manual) if i not in used_manual],
        "extra": [clock(p["clip_time_s"]) + (" +" if p["direction"] == "positive" else " -")
                  for j, p in enumerate(model) if j not in used_model],
        "recall": matched / len(manual) if manual else None,
        "precision": matched / len(model) if model else None,
        "count_error": (len(model) - len(manual)) / len(manual) if manual else None,
        "median_time_gap_s": sorted(pairs)[len(pairs) // 2] if pairs else None,
        "tolerance_s": tolerance_s,
    }


def count(camera_id: str, start_s: float, seconds: float, weights: Path = WEIGHTS,
          image_size: int = IMAGE_SIZE, sample_fps: float = SAMPLE_FPS, clip: Path | None = None) -> dict:
    config = reviewed_copy(load_config(camera_id))
    camera = next(c for c in load_cameras() if c.id == camera_id)
    tracker = CameraTracker(labels=PRETRAINED_VEHICLE_LABELS, image_size=image_size, model=load_model(weights))
    metrics = CameraMetrics(config)
    sampler = MediaTimeSampler(sample_fps)
    crossings, processed = [], 0
    clip = clip or clip_for(camera.id)
    for t, image in frames_between(clip, start_s, seconds):
        if not sampler.should_keep(t):
            continue
        processed += 1
        frame = Frame(camera.id, 1, processed, t, datetime.now(timezone.utc), image)
        for event in metrics.update(frame, tracker.update(frame)).crossings:
            crossings.append({"gate": event.gate_id, "direction": event.direction,
                              "class": event.vehicle_class, "clip_time_s": event.media_time_s})
    return {"camera_id": camera_id, "geometry_version": config.version, "start_s": start_s,
            "seconds": seconds, "clip": clip.name, "frames_processed": processed, "weights": weights.name,
            "image_size": image_size, "sample_fps": sample_fps, "gates": summarize(crossings)}


def main() -> None:
    parser = argparse.ArgumentParser(description="Check gate counts against a manual count.")
    parser.add_argument("command", choices=["video", "count", "match"])
    parser.add_argument("camera_id")
    parser.add_argument("--start", type=float, default=60)
    parser.add_argument("--seconds", type=float, default=120)
    parser.add_argument("--weights", type=Path, default=WEIGHTS)
    parser.add_argument("--image-size", type=int, default=IMAGE_SIZE)
    parser.add_argument("--fps", type=float, default=SAMPLE_FPS)
    parser.add_argument("--clip", type=Path, help="recorded clip; default is the newest for the camera")
    parser.add_argument("--manual", type=Path, help="match: hand-recorded crossings file")
    parser.add_argument("--model", type=Path, help="match: counts JSON written by the count command")
    parser.add_argument("--gate", help="match: the counting gate the manual file is for")
    parser.add_argument("--tolerance", type=float, default=1.5, help="match: seconds")
    args = parser.parse_args()
    if args.command == "video":
        print(f"wrote {export_video(args.camera_id, args.start, args.seconds, args.clip)}")
    elif args.command == "match":
        model = json.loads(args.model.read_text(encoding="utf-8"))
        result = {"camera_id": args.camera_id, "gate": args.gate,
                  "geometry_version": model["geometry_version"], "weights": model["weights"],
                  "image_size": model["image_size"], "sample_fps": model["sample_fps"],
                  "window": [clock(model["start_s"]), clock(model["start_s"] + model["seconds"])],
                  **match_events(read_manual(args.manual), model["gates"].get(args.gate, {}).get("events", []),
                                 args.tolerance)}
        out = args.manual.with_name(args.manual.stem + "_match.json")
        out.write_text(json.dumps(result, indent=1), encoding="utf-8")
        print(json.dumps({k: v for k, v in result.items() if k not in ("missed", "extra")}, indent=1))
        print(f"wrote {out}")
    else:
        result = count(args.camera_id, args.start, args.seconds, args.weights, args.image_size, args.fps, args.clip)
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        out = OUTPUT_DIR / (f"{args.camera_id}_{int(args.start)}s_{int(args.seconds)}s_"
                            f"{args.weights.stem}_{args.image_size}_{args.fps:g}fps_counts.json")
        out.write_text(json.dumps(result, indent=1), encoding="utf-8")
        print(f"wrote {out}")


if __name__ == "__main__":
    main()
