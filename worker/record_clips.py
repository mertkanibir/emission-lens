"""Save each camera's original HLS video for labeled replay.

Segments are appended exactly as Caltrans serves them, so replay goes through the
same decoder as the live feed. Clips show real traffic, so they stay in the
git-ignored data/raw/clips/ folder and should be deleted after the event.
"""

import argparse
import json
import time
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from worker.config import CameraConfig, load_cameras

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parents[1] / "data" / "raw" / "clips"
POLL_INTERVAL_S = 4.0  # Well under the 13-second target duration, so no segment is missed.
REQUEST_TIMEOUT_S = 15


@dataclass(frozen=True)
class Segment:
    sequence: int
    url: str
    duration_s: float


def fetch_text(url: str) -> str:
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_S) as response:
        return response.read().decode("utf-8")


def fetch_bytes(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=REQUEST_TIMEOUT_S) as response:
        return response.read()


def child_playlist_url(master_url: str, master_text: str) -> str:
    """The master playlist lists one child playlist; its name changes per session."""
    for line in master_text.splitlines():
        if line and not line.startswith("#"):
            return urljoin(master_url, line.strip())
    raise ValueError(f"no child playlist in {master_url}")


def parse_segments(playlist_url: str, text: str) -> list[Segment]:
    sequence = None
    duration_s = None
    segments = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith("#EXT-X-MEDIA-SEQUENCE:"):
            sequence = int(line.split(":", 1)[1])
        elif line.startswith("#EXTINF:"):
            duration_s = float(line.split(":", 1)[1].split(",")[0])
        elif line and not line.startswith("#"):
            if sequence is None or duration_s is None:
                raise ValueError(f"malformed playlist {playlist_url}")
            segments.append(Segment(sequence, urljoin(playlist_url, line), duration_s))
            sequence += 1
            duration_s = None
    return segments


class CameraRecording:
    """Append new segments for one camera to one clip file."""

    def __init__(self, camera: CameraConfig, output_dir: Path, started_at: datetime,
                 fetch_text=fetch_text, fetch_bytes=fetch_bytes):
        self.camera = camera
        self._fetch_text = fetch_text
        self._fetch_bytes = fetch_bytes
        stamp = started_at.strftime("%Y%m%dT%H%M%SZ")
        (output_dir / camera.id).mkdir(parents=True, exist_ok=True)
        self.clip_path = output_dir / camera.id / f"{camera.id}_{stamp}.ts"
        self.record_path = self.clip_path.with_suffix(".json")
        self._child_url: str | None = None
        self._last_sequence: int | None = None
        self.record = {
            "camera_id": camera.id,
            "camera_name": camera.name,
            "source": "Caltrans CWWP public traffic camera",
            "source_url": camera.stream_url,
            "recording_started_at": started_at.isoformat(timespec="seconds"),
            "mode": "replay",
            "segments": [],
            "gaps": 0,
            "errors": 0,
        }

    def poll(self) -> int:
        """Fetch any segments not yet saved; return how many were added."""
        try:
            if self._child_url is None:
                master = self.camera.stream_url
                self._child_url = child_playlist_url(master, self._fetch_text(master))
            segments = parse_segments(self._child_url, self._fetch_text(self._child_url))
        except (OSError, ValueError):
            self._child_url = None  # The session may have expired; resolve it again next poll.
            self.record["errors"] += 1
            return 0

        added = 0
        for segment in segments:
            if self._last_sequence is not None and segment.sequence <= self._last_sequence:
                continue
            if self._last_sequence is not None and segment.sequence != self._last_sequence + 1:
                self.record["gaps"] += 1  # Segments expired before we fetched them.
            try:
                data = self._fetch_bytes(segment.url)
            except OSError:
                self.record["errors"] += 1
                return added  # Retry from this segment on the next poll.
            with self.clip_path.open("ab") as clip:
                clip.write(data)
            self._last_sequence = segment.sequence
            self.record["segments"].append({
                "sequence": segment.sequence,
                "duration_s": segment.duration_s,
                "received_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            })
            added += 1
        return added

    def save_record(self) -> None:
        self.record["seconds"] = round(sum(s["duration_s"] for s in self.record["segments"]), 1)
        self.record_path.write_text(json.dumps(self.record, indent=1), encoding="utf-8")


def record(minutes: float, output_dir: Path, cameras: list[CameraConfig]) -> list[CameraRecording]:
    started_at = datetime.now(timezone.utc)
    recordings = [CameraRecording(camera, output_dir, started_at) for camera in cameras]
    deadline = time.monotonic() + minutes * 60
    try:
        while time.monotonic() < deadline:
            for recording in recordings:
                recording.poll()
                recording.save_record()
            time.sleep(POLL_INTERVAL_S)
    except KeyboardInterrupt:
        print("stopping early")
    for recording in recordings:
        recording.save_record()
    return recordings


def main() -> None:
    parser = argparse.ArgumentParser(description="Save original camera video for replay.")
    parser.add_argument("--minutes", type=float, default=15)
    parser.add_argument("--cameras", nargs="*", help="camera ids; default is every enabled camera")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    cameras = [c for c in load_cameras() if not args.cameras or c.id in args.cameras]
    for recording in record(args.minutes, args.output, cameras):
        r = recording.record
        print(f"{r['camera_id']}: {r['seconds']} s in {len(r['segments'])} segments, "
              f"{r['gaps']} gaps, {r['errors']} errors -> {recording.clip_path}")


if __name__ == "__main__":
    main()
