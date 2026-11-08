"""Choose each camera's stopped-motion threshold from calibrated ground motion.

The traversal bridge calls an interval stopped when the tracked bottom-centre
moves at most `image_displacement_per_s` (normalized image units per media
second) between consecutive frames. Perspective makes one image rate mean
different ground speeds, so the threshold is fitted per camera, inside its
movement region only, against a reference from the ground calibration:
speed over about one second below 0.5 m/s is stopped, above 1.5 m/s is moving,
and anything between is left out as ambiguous.

    python -m evaluation.stop_threshold 222 --start 180 --seconds 120

The reference is derived from the calibration, not a human annotation.
"""

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from evaluation.check_counts import clip_for, frames_between
from worker.calibrate_points import project
from worker.config import load_cameras
from worker.detect import PRETRAINED_VEHICLE_LABELS, load_model
from worker.stream import Frame, MediaTimeSampler
from worker.track import CameraTracker

REPO = Path(__file__).resolve().parents[1]
CAL_DIR = REPO / "evaluation" / "calibration"
WEIGHTS = REPO / "weights" / "yolo11n.pt"
IMAGE_SIZE, SAMPLE_FPS = 640, 15.0
STOPPED_MPS, MOVING_MPS = 0.5, 1.5
WINDOW_S, MIN_SPAN_S, MAX_GAP_S = 1.0, 0.6, 1.0


BAND_MARGIN = 0.1  # Image-height margin around the movement for fitting data.


def movement_region(camera_id: str) -> np.ndarray:
    geo = json.loads((REPO / "config" / "cameras" / f"{camera_id}.measurement.json").read_text(encoding="utf-8"))
    gates = {g["id"]: g for g in geo["gates"]}
    corners = [gates[g][end] for g in ("count-1", "count-3") for end in ("start", "end")]
    return cv2.convexHull(np.array(corners, dtype=np.float32))


def fitting_region(camera_id: str) -> np.ndarray:
    """The road region within the movement's depth band, where queues give stopped examples.

    Stops happen mostly at stop bars just outside a movement, so fitting only inside
    the movement leaves too few. Restricting to a similar depth keeps perspective close.
    """
    geo = json.loads((REPO / "config" / "cameras" / f"{camera_id}.measurement.json").read_text(encoding="utf-8"))
    ys = movement_region(camera_id)[:, 0, 1]
    top, bottom = max(0.0, ys.min() - BAND_MARGIN), min(1.0, ys.max() + BAND_MARGIN)
    road = np.array(geo["road_region"], dtype=np.float32)
    band = np.zeros((720, 1280), np.uint8); cv2.rectangle(band, (0, int(top * 720)), (1279, int(bottom * 720)), 255, -1)
    mask = np.zeros_like(band); cv2.fillPoly(mask, [(road * [1280, 720]).astype(np.int32)], 255)
    for region in geo["excluded_regions"]:
        cv2.fillPoly(mask, [(np.array(region) * [1280, 720]).astype(np.int32)], 0)
    contours, _ = cv2.findContours(cv2.bitwise_and(mask, band), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    largest = max(contours, key=cv2.contourArea)
    return (largest.astype(np.float32) / np.array([1280, 720], np.float32)).reshape(-1, 1, 2)


def geometric_threshold(homography, region, speed_mps: float = STOPPED_MPS) -> float:
    """Median image rate (normalized units/s) of a given ground speed across the movement region."""
    inverse = np.linalg.inv(homography)
    def image(ground):
        v = inverse @ np.array([ground[0], ground[1], 1.0]); return np.array([v[0] / v[2] / 1280, v[1] / v[2] / 720])
    rates = []
    for x in np.linspace(0, 1, 41):
        for y in np.linspace(0, 1, 41):
            if cv2.pointPolygonTest(region, (float(x), float(y)), False) < 0:
                continue
            g = np.array(project(homography, (x * 1280, y * 720)))
            rates += [np.linalg.norm(image(g + speed_mps * np.array(d)) - np.array([x, y])) for d in ((1, 0), (0, 1))]
    return float(np.median(rates))


def collect_tracks(camera_id: str, start_s: float, seconds: float) -> dict[int, list[tuple[float, float, float]]]:
    camera = next(c for c in load_cameras() if c.id == camera_id)
    tracker = CameraTracker(labels=PRETRAINED_VEHICLE_LABELS, image_size=IMAGE_SIZE, model=load_model(WEIGHTS))
    sampler = MediaTimeSampler(SAMPLE_FPS)
    tracks: dict[int, list] = {}
    n = 0
    for t, image in frames_between(clip_for(camera.id), start_s, seconds):
        if not sampler.should_keep(t):
            continue
        n += 1
        h, w = image.shape[:2]
        for v in tracker.update(Frame(camera.id, 1, n, t, datetime.now(timezone.utc), image)):
            d = v.detection
            tracks.setdefault(v.track_id, []).append((t, (d.x1 + d.x2) / (2 * w), d.y2 / h))
    return tracks


def labelled_intervals(tracks, homography, region) -> list[tuple[float, bool]]:
    """(image rate, is_stopped) for each frame interval with a clear ground reference."""
    ground = lambda x, y: np.array(project(homography, (x * 1280, y * 720)))
    out = []
    for points in tracks.values():
        for i in range(1, len(points)):
            t, x, y = points[i]
            t0, x0, y0 = points[i - 1]
            if not 0 < t - t0 <= MAX_GAP_S or cv2.pointPolygonTest(region, (x, y), False) < 0:
                continue
            window = [p for p in points if abs(p[0] - t) <= WINDOW_S / 2]
            span = window[-1][0] - window[0][0]
            if span < MIN_SPAN_S:
                continue
            speed = float(np.linalg.norm(ground(*window[-1][1:]) - ground(*window[0][1:]))) / span
            if speed < STOPPED_MPS or speed > MOVING_MPS:
                out.append((math.dist((x0, y0), (x, y)) / (t - t0), speed < STOPPED_MPS))
    return out


def best_threshold(intervals) -> dict:
    rates = np.array([r for r, _ in intervals]); stopped = np.array([s for _, s in intervals])
    best = None
    for threshold in np.quantile(rates, np.linspace(0.01, 0.99, 197)):
        predicted = rates <= threshold
        tpr = (predicted & stopped).sum() / max(stopped.sum(), 1)
        tnr = (~predicted & ~stopped).sum() / max((~stopped).sum(), 1)
        score = (tpr + tnr) / 2
        if best is None or score > best["balanced_accuracy"]:
            best = {"threshold": float(threshold), "balanced_accuracy": float(score),
                    "stopped_recall": float(tpr), "moving_recall": float(tnr)}
    best.update({"intervals": int(len(rates)), "stopped_intervals": int(stopped.sum()),
                 "stopped_rate_p95": float(np.quantile(rates[stopped], 0.95)) if stopped.any() else None,
                 "moving_rate_p05": float(np.quantile(rates[~stopped], 0.05)) if (~stopped).any() else None})
    return best


def main() -> None:
    parser = argparse.ArgumentParser(description="Fit a camera's stopped-motion threshold.")
    parser.add_argument("camera_id")
    parser.add_argument("--start", type=float, default=180)
    parser.add_argument("--seconds", type=float, default=120)
    args = parser.parse_args()
    cal = json.loads((CAL_DIR / f"{args.camera_id}-road-plane-correspondences.json").read_text(encoding="utf-8"))
    homography = np.array(cal["homography"])
    cache = REPO / "data" / "raw" / "stop_tracks" / f"{args.camera_id}_{int(args.start)}_{int(args.seconds)}.json"
    if cache.exists():
        tracks = {int(k): [tuple(p) for p in v] for k, v in json.loads(cache.read_text()).items()}
    else:
        tracks = collect_tracks(args.camera_id, args.start, args.seconds)
        cache.parent.mkdir(parents=True, exist_ok=True); cache.write_text(json.dumps(tracks))
    result = best_threshold(labelled_intervals(tracks, homography, fitting_region(args.camera_id)))
    inside = labelled_intervals(tracks, homography, movement_region(args.camera_id))
    rates = np.array([r for r, _ in inside]); stopped = np.array([s for _, s in inside], dtype=bool)
    t = result["threshold"]
    result["inside_movement"] = {
        "intervals": int(len(rates)), "stopped_intervals": int(stopped.sum()),
        "stopped_recall": float((rates[stopped] <= t).mean()) if stopped.any() else None,
        "moving_recall": float((rates[~stopped] > t).mean()) if (~stopped).any() else None}
    result["geometric_0p5_mps_rate"] = geometric_threshold(homography, movement_region(args.camera_id))
    result["fitting_region"] = f"road region within the movement depth band +/- {BAND_MARGIN} image height, excluding parking"
    result.update({"camera_id": args.camera_id, "window_s": [args.start, args.start + args.seconds],
                   "model": f"{WEIGHTS.name} {IMAGE_SIZE} px {SAMPLE_FPS:g} fps",
                   "reference": f"calibrated ground speed over {WINDOW_S:g} s: < {STOPPED_MPS} m/s stopped, > {MOVING_MPS} m/s moving"})
    out = CAL_DIR / f"{args.camera_id}-stop-threshold.json"
    out.write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
