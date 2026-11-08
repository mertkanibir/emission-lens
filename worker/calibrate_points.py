"""Match camera points to aerial points and fit a camera-to-ground homography.

    python -m worker.calibrate_points 222

Two windows open: the camera frame and a georeferenced aerial image. Click a
point on the camera, then the same point on the aerial; repeat for each pair.
Pick road-plane points only (paint corners, lane-line ends, curb corners), not
anything raised like a roof or pole top.

    v  hold the next pair back for validation (toggle)   u  undo last click
    f  fit and show errors                                s  save
    esc  quit

The fit maps camera pixels to ground metres (east, north) around the aerial
image centre, the form worker/calibration.py checks. Aerial images are not
committed; only clicked points, source URLs, and results are saved.
"""

import argparse
import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from worker.draw_geometry import load_frame

REPO = Path(__file__).resolve().parents[1]
AERIAL_DIR = REPO / "data" / "raw" / "aerial"
OUTPUT_DIR = REPO / "evaluation" / "calibration"
MIN_FIT_PAIRS = 4
GRID_M = 5.0


def aerial_to_ground(pixel, meta: dict) -> tuple[float, float]:
    """Aerial pixel (column, row) to ground metres east and north of the image centre.

    The export is Web Mercator, whose metres are stretched by 1 / cos(latitude);
    multiplying by cos(latitude) restores ground metres at this small scale.
    """
    min_x, min_y, max_x, max_y = meta["bbox_3857"]
    size = meta["size_px"]
    x = min_x + (pixel[0] + 0.5) * (max_x - min_x) / size
    y = max_y - (pixel[1] + 0.5) * (max_y - min_y) / size
    k = meta["mercator_scale_cos_lat"]
    return (x - (min_x + max_x) / 2) * k, (y - (min_y + max_y) / 2) * k


def ground_to_aerial(point, meta: dict) -> tuple[float, float]:
    min_x, min_y, max_x, max_y = meta["bbox_3857"]
    size, k = meta["size_px"], meta["mercator_scale_cos_lat"]
    x = point[0] / k + (min_x + max_x) / 2
    y = point[1] / k + (min_y + max_y) / 2
    return (x - min_x) * size / (max_x - min_x) - 0.5, (max_y - y) * size / (max_y - min_y) - 0.5


@dataclass
class Pair:
    image_px: tuple[float, float]
    aerial_px: tuple[float, float]
    role: str  # "fit" or "validation"


def fit_homography(pairs: list[Pair], meta: dict) -> np.ndarray:
    fit = [p for p in pairs if p.role == "fit"]
    if len(fit) < MIN_FIT_PAIRS:
        raise ValueError(f"need at least {MIN_FIT_PAIRS} fit pairs, have {len(fit)}")
    src = np.array([p.image_px for p in fit], dtype=np.float64)
    dst = np.array([aerial_to_ground(p.aerial_px, meta) for p in fit], dtype=np.float64)
    matrix, _ = cv2.findHomography(src, dst, 0)  # Least squares over every fit pair; no outlier rejection.
    if matrix is None:
        raise ValueError("points are degenerate (for example, three or more in a line)")
    return matrix


def project(matrix: np.ndarray, image_px) -> tuple[float, float]:
    x, y, w = matrix @ np.array([image_px[0], image_px[1], 1.0])
    return x / w, y / w


def residuals(matrix: np.ndarray, pairs: list[Pair], meta: dict) -> list[dict]:
    """Ground distance between each camera point's projection and its aerial point."""
    rows = []
    for i, p in enumerate(pairs, start=1):
        projected = project(matrix, p.image_px)
        target = aerial_to_ground(p.aerial_px, meta)
        rows.append({"pair": i, "role": p.role, "error_m": round(math.dist(projected, target), 3)})
    return rows


def summary(rows: list[dict]) -> dict:
    out = {}
    for role in ("fit", "validation"):
        errors = [r["error_m"] for r in rows if r["role"] == role]
        out[role] = {"pairs": len(errors),
                     "rms_m": round(math.sqrt(sum(e * e for e in errors) / len(errors)), 3) if errors else None,
                     "max_m": max(errors) if errors else None}
    return out


def gate_distance(matrix, entry, exit, width: int = 1280, height: int = 720, samples: int = 11) -> dict:
    """Ground distance between two gates given as normalized (start, end) image points.

    The midpoint distance is the movement length for a straight path. Distances
    from points along the entry gate to the exit line give the spread across lanes.
    """
    def ground(point):
        return np.array(project(matrix, (point[0] * width, point[1] * height)))

    a0, a1, b0, b1 = map(ground, (*entry, *exit))
    direction = (b1 - b0) / np.linalg.norm(b1 - b0)
    normal = np.array([-direction[1], direction[0]])
    spread = [abs(float(np.dot(a0 + t * (a1 - a0) - b0, normal))) for t in np.linspace(0, 1, samples)]
    return {
        "midpoint_distance_m": round(float(np.linalg.norm((a0 + a1) / 2 - (b0 + b1) / 2)), 2),
        "lane_spread_m": [round(min(spread), 2), round(max(spread), 2)],
        "entry_length_m": round(float(np.linalg.norm(a1 - a0)), 2),
        "exit_length_m": round(float(np.linalg.norm(b1 - b0)), 2),
    }


def save(path: Path, camera_id: str, source: str, meta: dict, pairs: list[Pair]) -> dict:
    record = {
        "camera_id": camera_id,
        "status": "candidate; not an accepted calibration",
        "transform": "image pixels (1280x720) -> ground metres (east, north) about the aerial image centre",
        "aerial_source": source,
        "aerial_request": meta.get(source, {}).get("url"),
        "aerial_center_latlon": meta["center_latlon"],
        "mercator_scale_cos_lat": meta["mercator_scale_cos_lat"],
        "aerial_note": "Aerial imagery is not committed; re-request it from the URL above.",
        "pairs": [{"image_px": list(p.image_px), "aerial_px": list(p.aerial_px), "role": p.role,
                   "ground_m": [round(v, 3) for v in aerial_to_ground(p.aerial_px, meta)]} for p in pairs],
    }
    try:
        matrix = fit_homography(pairs, meta)
        rows = residuals(matrix, pairs, meta)
        record.update({"homography": matrix.tolist(), "residuals": rows, "summary": summary(rows)})
    except ValueError as error:
        record["fit_error"] = str(error)
    path.write_text(json.dumps(record, indent=1) + "\n", encoding="utf-8")
    return record


def load_pairs(path: Path) -> list[Pair]:
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    return [Pair(tuple(p["image_px"]), tuple(p["aerial_px"]), p["role"]) for p in raw["pairs"]]


def draw_points(image, points, colors, labels):
    for point, color, label in zip(points, colors, labels):
        center = (int(point[0]), int(point[1]))
        cv2.circle(image, center, 5, color, -1)
        cv2.circle(image, center, 7, (0, 0, 0), 1)
        cv2.putText(image, label, (center[0] + 8, center[1] - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)


def draw_grid(camera, matrix, meta, aerial_shape):
    """Project a 5 m ground grid back onto the camera view for a visual check."""
    inverse = np.linalg.inv(matrix)
    half = aerial_shape[0] * meta["ground_m_per_px"] / 2
    steps = np.arange(-half, half + GRID_M, GRID_M)
    for fixed in steps:
        for line in (np.array([[fixed, v] for v in steps]), np.array([[v, fixed] for v in steps])):
            pts = []
            for e, n in line:
                x, y, w = inverse @ np.array([e, n, 1.0])
                if w > 0:
                    pts.append((int(x / w), int(y / w)))
            for a, b in zip(pts, pts[1:]):
                if all(-2000 < c < 4000 for c in (*a, *b)):
                    cv2.line(camera, a, b, (255, 160, 0), 1, cv2.LINE_AA)


def main() -> None:
    parser = argparse.ArgumentParser(description="Match camera and aerial points; fit a ground homography.")
    parser.add_argument("camera_id")
    parser.add_argument("--source", default="esri_world", help="aerial image name in data/raw/aerial/<camera>/")
    parser.add_argument("--distance", nargs=2, metavar=("ENTRY_GATE", "EXIT_GATE"),
                        help="print the ground distance between two saved gates and exit")
    args = parser.parse_args()

    if args.distance:
        record = json.loads((OUTPUT_DIR / f"{args.camera_id}-road-plane-correspondences.json").read_text(encoding="utf-8"))
        geometry = json.loads((REPO / "config" / "cameras" / f"{args.camera_id}.measurement.json").read_text(encoding="utf-8"))
        gates = {g["id"]: (g["start"], g["end"]) for g in geometry["gates"]}
        result = gate_distance(np.array(record["homography"]), gates[args.distance[0]], gates[args.distance[1]])
        print(json.dumps({"entry": args.distance[0], "exit": args.distance[1], **result,
                          "fit_summary": record.get("summary")}, indent=1))
        return

    folder = AERIAL_DIR / args.camera_id
    meta = json.loads((folder / "meta.json").read_text(encoding="utf-8"))
    aerial = cv2.imread(str(folder / f"{args.source}.png"))
    camera = load_frame(args.camera_id)
    out = OUTPUT_DIR / f"{args.camera_id}-road-plane-correspondences.json"
    pairs = load_pairs(out)
    state = {"pending": None, "role": "fit", "message": "Click a road point on the CAMERA window.", "matrix": None}

    def on_camera(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN and state["pending"] is None:
            state["pending"] = (float(x), float(y))
            state["message"] = "Now click the same point on the AERIAL window."

    def on_aerial(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN and state["pending"] is not None:
            pairs.append(Pair(state["pending"], (float(x), float(y)), state["role"]))
            state["pending"], state["matrix"] = None, None
            state["message"] = f"Pair {len(pairs)} stored ({pairs[-1].role}). Next: click the CAMERA window."

    cv2.namedWindow("camera", cv2.WINDOW_NORMAL)
    cv2.namedWindow("aerial", cv2.WINDOW_NORMAL)
    cv2.setMouseCallback("camera", on_camera)
    cv2.setMouseCallback("aerial", on_aerial)
    while True:
        cam, air = camera.copy(), aerial.copy()
        if state["matrix"] is not None:
            draw_grid(cam, state["matrix"], meta, aerial.shape)
        colors = [(80, 220, 80) if p.role == "fit" else (255, 220, 0) for p in pairs]
        labels = [str(i) for i in range(1, len(pairs) + 1)]
        draw_points(cam, [p.image_px for p in pairs], colors, labels)
        draw_points(air, [p.aerial_px for p in pairs], colors, labels)
        if state["pending"]:
            draw_points(cam, [state["pending"]], [(0, 0, 255)], ["?"])
        banner = f"{len(pairs)} pairs | next pair: {state['role']} | v toggle  u undo  f fit  s save  esc quit"
        for img in (cam, air):
            cv2.rectangle(img, (0, 0), (img.shape[1], 48), (0, 0, 0), -1)
            cv2.putText(img, banner, (8, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
            cv2.putText(img, state["message"], (8, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 220, 255), 1, cv2.LINE_AA)
        cv2.imshow("camera", cam)
        cv2.imshow("aerial", air)
        key = cv2.waitKey(30) & 0xFF
        if key == ord("v"):
            state["role"] = "validation" if state["role"] == "fit" else "fit"
        elif key == ord("u"):
            if state["pending"]:
                state["pending"] = None
            elif pairs:
                pairs.pop()
            state["matrix"] = None
        elif key == ord("f"):
            try:
                state["matrix"] = fit_homography(pairs, meta)
                s = summary(residuals(state["matrix"], pairs, meta))
                state["message"] = (f"fit RMS {s['fit']['rms_m']} m, max {s['fit']['max_m']} m | "
                                    f"validation RMS {s['validation']['rms_m']} m, max {s['validation']['max_m']} m")
            except ValueError as error:
                state["message"] = f"Cannot fit: {error}"
        elif key == ord("s"):
            record = save(out, args.camera_id, args.source, meta, pairs)
            state["message"] = f"Saved {out.name}" + (f" ({record['fit_error']})" if "fit_error" in record else "")
        elif key == 27:
            break
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
