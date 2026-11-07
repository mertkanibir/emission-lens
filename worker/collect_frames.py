"""Save spaced-out frames from every camera for labeling.

Frames show real traffic, so they stay in the git-ignored data/raw/ folder and
should be deleted once training and evaluation are finished.
"""

import argparse
import time
from pathlib import Path

import cv2

from worker.config import load_cameras
from worker.stream import Frame, StreamReader

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[1] / "data" / "raw" / "frames"
JPEG_QUALITY = 95
STATUS_INTERVAL_S = 60


def save_frame(frame: Frame, output_dir: Path) -> Path:
    """Write one frame, named so that sorting by name sorts by camera and time."""
    camera_dir = output_dir / frame.camera_id
    camera_dir.mkdir(parents=True, exist_ok=True)
    stamp = frame.received_at.strftime("%Y%m%dT%H%M%SZ")
    path = camera_dir / f"{frame.camera_id}_{stamp}_{frame.sequence:05d}.jpg"
    if not cv2.imwrite(str(path), frame.image, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]):
        raise OSError(f"could not write {path}")
    return path


def collect(interval_s: float, minutes: float, output_dir: Path) -> dict[str, int]:
    """Save one frame per interval of video from each camera; return counts by camera."""
    readers = [StreamReader(camera, target_fps=1 / interval_s) for camera in load_cameras()]
    saved = {reader.camera.id: 0 for reader in readers}
    for reader in readers:
        reader.start()

    deadline = time.monotonic() + minutes * 60
    next_status = time.monotonic() + STATUS_INTERVAL_S
    try:
        while time.monotonic() < deadline:
            for reader in readers:
                frame = reader.frames.get(timeout_s=0.1)
                if frame is not None:
                    save_frame(frame, output_dir)
                    saved[frame.camera_id] += 1
            if time.monotonic() >= next_status:
                states = {reader.camera.id: reader.status().state for reader in readers}
                print(f"saved {saved} states {states}", flush=True)
                next_status += STATUS_INTERVAL_S
    except KeyboardInterrupt:
        print("stopping early")
    finally:
        for reader in readers:
            reader.stop()
    return saved


def main() -> None:
    parser = argparse.ArgumentParser(description="Save spaced-out frames for labeling.")
    parser.add_argument("--interval", type=float, default=20, help="seconds of video between frames")
    parser.add_argument("--minutes", type=float, default=60)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    print(f"finished: {collect(args.interval, args.minutes, args.output)}")


if __name__ == "__main__":
    main()
