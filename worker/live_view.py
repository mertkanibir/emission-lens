"""Show one camera with tracked vehicles drawn on it. Press q to quit.

Frames are only shown on screen, never saved.
"""

import argparse
import time
from collections import deque

import cv2
import numpy as np

from worker.config import load_cameras
from worker.stream import StreamReader
from worker.track import CameraTracker, TrackedVehicle

COLORS = {  # BGR
    "car": (80, 200, 80),
    "tesla": (255, 200, 0),
    "truck": (0, 140, 255),
    "pickup": (0, 200, 255),
    "box_truck": (0, 140, 255),
    "tractor_trailer": (0, 0, 255),
    "bus": (255, 0, 200),
    "motorcycle": (255, 255, 255),
}
FPS_WINDOW_S = 5.0


def draw(image: np.ndarray, vehicles: list[TrackedVehicle], banner: str) -> np.ndarray:
    canvas = image.copy()
    for vehicle in vehicles:
        d = vehicle.detection
        color = COLORS.get(vehicle.label, (200, 200, 200))
        top_left, bottom_right = (int(d.x1), int(d.y1)), (int(d.x2), int(d.y2))
        cv2.rectangle(canvas, top_left, bottom_right, color, 2)
        cv2.putText(
            canvas, f"{vehicle.track_id} {vehicle.label}", (top_left[0], top_left[1] - 4),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1, cv2.LINE_AA,
        )
    cv2.rectangle(canvas, (0, 0), (canvas.shape[1], 30), (0, 0, 0), -1)
    cv2.putText(canvas, banner, (8, 21), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    return canvas


class RateMeter:
    """Frames processed per second over the last few seconds of wall time."""

    def __init__(self, window_s: float = FPS_WINDOW_S):
        self._times: deque[float] = deque()
        self._window_s = window_s

    def tick(self, now: float) -> float:
        self._times.append(now)
        while now - self._times[0] > self._window_s:
            self._times.popleft()
        return (len(self._times) - 1) / self._window_s


def main() -> None:
    parser = argparse.ArgumentParser(description="Watch one camera with tracked vehicles.")
    parser.add_argument("camera_id")
    parser.add_argument("--image-size", type=int, default=640)
    args = parser.parse_args()

    camera = next(c for c in load_cameras() if c.id == args.camera_id)
    reader = StreamReader(camera)
    tracker = CameraTracker(image_size=args.image_size)
    meter = RateMeter()
    reader.start()
    try:
        while True:
            frame = reader.frames.get(timeout_s=1.0)
            if frame is not None:
                vehicles = tracker.update(frame)
                status = reader.status()
                banner = (
                    f"LIVE {camera.id} {camera.name} | {meter.tick(time.monotonic()):.1f} fps "
                    f"processed | {status.frames_dropped} dropped | {len(vehicles)} vehicles"
                )
                cv2.imshow("Emission Lens", draw(frame.image, vehicles, banner))
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    finally:
        reader.stop()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
