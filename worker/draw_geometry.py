"""Draw a camera's road region, parking exclusions, and counting gates.

    python -m worker.draw_geometry 222

Opens a frame from the camera's recorded clip (or the live stream if there is
none). Keys pick what the clicks draw:

    r  road region (travel lanes only)    x  new excluded region (parking, sidewalk)
    g  counting gate (two clicks)         enter  finish the current shape
    u  undo last point                    d  delete the last finished shape
    s  check and save                     esc  quit without saving

The file saves as disabled and unvalidated. A camera is enabled only after its
counts are checked against manual crossing counts.
"""

import argparse
import json
import math
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from worker.config import DEFAULT_CAMERA_DIR, load_cameras
from worker.metrics import MetricsConfig

CLIP_DIR = Path(__file__).resolve().parents[1] / "data" / "raw" / "clips"
FRAME_AT_S = 60.0
COLORS = {"road": (80, 200, 80), "excluded": (60, 60, 230), "gate": (0, 220, 255), "drawing": (255, 255, 255)}
Point = tuple[float, float]


def config_path(camera_id: str, directory: Path = DEFAULT_CAMERA_DIR) -> Path:
    return directory / f"{camera_id}.measurement.json"


@dataclass
class GeometryDraft:
    """The shapes being drawn, in normalized image coordinates (0 to 1, origin top left)."""

    camera_id: str
    road_region: list[Point] = field(default_factory=list)
    excluded_regions: list[list[Point]] = field(default_factory=list)
    gates: list[tuple[Point, Point]] = field(default_factory=list)
    mode: str = "road"
    points: list[Point] = field(default_factory=list)
    revision: int = 1

    def click(self, point: Point) -> None:
        self.points.append((round(point[0], 4), round(point[1], 4)))
        if self.mode == "gate" and len(self.points) == 2:
            self.finish()

    def set_mode(self, mode: str) -> None:
        self.points = []
        self.mode = mode

    def finish(self) -> None:
        """Store the current shape; too few points is ignored."""
        if self.mode == "road" and len(self.points) >= 3:
            self.road_region = self.points
        elif self.mode == "excluded" and len(self.points) >= 3:
            self.excluded_regions.append(self.points)
        elif self.mode == "gate" and len(self.points) == 2:
            self.gates.append((self.points[0], self.points[1]))
        self.points = []

    def undo(self) -> None:
        if self.points:
            self.points.pop()

    def delete_last(self) -> None:
        if self.mode == "gate" and self.gates:
            self.gates.pop()
        elif self.mode == "excluded" and self.excluded_regions:
            self.excluded_regions.pop()
        elif self.mode == "road":
            self.road_region = []

    def to_config(self) -> dict:
        return {
            "camera_id": self.camera_id,
            "version": f"{self.camera_id}-image-v{self.revision}",
            "enabled": False,
            "image_geometry_status": "unvalidated",
            "road_region": [list(p) for p in self.road_region],
            "excluded_regions": [[list(p) for p in region] for region in self.excluded_regions],
            "gates": [
                {"id": f"count-{i + 1}", "start": list(start), "end": list(end), "direction": "both"}
                for i, (start, end) in enumerate(self.gates)
            ],
        }

    @classmethod
    def from_config(cls, raw: dict) -> "GeometryDraft":
        revision = int(raw["version"].rsplit("-v", 1)[1]) + 1 if "-image-v" in raw["version"] else 1
        return cls(
            camera_id=raw["camera_id"],
            road_region=[tuple(p) for p in raw["road_region"]],
            excluded_regions=[[tuple(p) for p in region] for region in raw["excluded_regions"]],
            gates=[(tuple(g["start"]), tuple(g["end"])) for g in raw["gates"]],
            revision=revision,
        )


def validate(draft: GeometryDraft) -> str | None:
    """Return the worker's own error for this draft, or None if it would load."""
    try:
        MetricsConfig.from_dict(draft.to_config())
    except ValueError as error:
        return str(error)
    return None


def save(draft: GeometryDraft, path: Path) -> None:
    error = validate(draft)
    if error:
        raise ValueError(error)
    path.write_text(json.dumps(draft.to_config(), indent=2) + "\n", encoding="utf-8")


def positive_side(start: Point, end: Point) -> Point:
    """Unit normal pointing to the gate's positive side, in image coordinates (y down)."""
    vx, vy = end[0] - start[0], end[1] - start[1]
    length = math.hypot(vx, vy)
    return -vy / length, vx / length


def load_frame(camera_id: str) -> np.ndarray:
    clips = sorted((CLIP_DIR / camera_id).glob("*.ts"))
    camera = next(c for c in load_cameras() if c.id == camera_id)
    capture = cv2.VideoCapture(str(clips[-1]) if clips else camera.stream_url)
    if clips:
        capture.set(cv2.CAP_PROP_POS_MSEC, FRAME_AT_S * 1000)
    ok, frame = capture.read()
    capture.release()
    if not ok:
        raise RuntimeError(f"no frame for camera {camera_id}")
    return frame


def render(frame: np.ndarray, draft: GeometryDraft, message: str) -> np.ndarray:
    h, w = frame.shape[:2]
    px = lambda p: (int(p[0] * w), int(p[1] * h))
    canvas = frame.copy()
    shade = frame.copy()
    if len(draft.road_region) >= 3:
        cv2.fillPoly(shade, [np.array([px(p) for p in draft.road_region])], COLORS["road"])
    for region in draft.excluded_regions:
        cv2.fillPoly(shade, [np.array([px(p) for p in region])], COLORS["excluded"])
    canvas = cv2.addWeighted(shade, 0.3, canvas, 0.7, 0)
    for i, (start, end) in enumerate(draft.gates):
        cv2.line(canvas, px(start), px(end), COLORS["gate"], 3)
        mid = ((start[0] + end[0]) / 2, (start[1] + end[1]) / 2)
        nx, ny = positive_side(start, end)
        tip = (mid[0] + nx * 0.04 * h / w, mid[1] + ny * 0.04)
        cv2.arrowedLine(canvas, px(mid), px(tip), COLORS["gate"], 2, tipLength=0.4)
        cv2.putText(canvas, f"count-{i + 1} +", px(tip), cv2.FONT_HERSHEY_SIMPLEX, 0.6, COLORS["gate"], 2)
    for a, b in zip(draft.points, draft.points[1:]):
        cv2.line(canvas, px(a), px(b), COLORS["drawing"], 2)
    for p in draft.points:
        cv2.circle(canvas, px(p), 4, COLORS["drawing"], -1)
    banner = f"camera {draft.camera_id} | drawing: {draft.mode} | r road  x exclude  g gate  enter finish  u undo  d delete  s save  esc quit"
    cv2.rectangle(canvas, (0, 0), (w, 52), (0, 0, 0), -1)
    cv2.putText(canvas, banner, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(canvas, message, (8, 42), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 220, 255), 1, cv2.LINE_AA)
    return canvas


def main() -> None:
    parser = argparse.ArgumentParser(description="Draw road region, exclusions, and counting gates.")
    parser.add_argument("camera_id")
    args = parser.parse_args()

    path = config_path(args.camera_id)
    draft = (GeometryDraft.from_config(json.loads(path.read_text(encoding="utf-8")))
             if path.exists() else GeometryDraft(args.camera_id))
    frame = load_frame(args.camera_id)
    h, w = frame.shape[:2]
    message = "Outline the travel lanes, then press enter."
    window = f"Emission Lens geometry - camera {args.camera_id}"

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            draft.click((min(max(x / w, 0.0), 1.0), min(max(y / h, 0.0), 1.0)))

    cv2.namedWindow(window)
    cv2.setMouseCallback(window, on_mouse)
    keys = {ord("r"): "road", ord("x"): "excluded", ord("g"): "gate"}
    while True:
        cv2.imshow(window, render(frame, draft, message))
        key = cv2.waitKey(30) & 0xFF
        if key in keys:
            draft.set_mode(keys[key])
            message = {"road": "Click around the travel lanes only, then enter.",
                       "excluded": "Click around a parking lot or sidewalk, then enter.",
                       "gate": "Click two points across the lanes to count."}[draft.mode]
        elif key in (13, 10):
            draft.finish()
            message = "Shape stored."
        elif key == ord("u"):
            draft.undo()
        elif key == ord("d"):
            draft.delete_last()
            message = f"Deleted the last {draft.mode} shape."
        elif key == ord("s"):
            error = validate(draft)
            if error:
                message = f"Not saved: {error}"
            else:
                save(draft, path)
                message = f"Saved {path.name} (disabled, unvalidated)."
        elif key == 27:
            break
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
