"""Read one camera's HLS stream on its own thread.

Caltrans delivers video in chunks of about 10 seconds: a burst of frames, then
silence. Sampling and speed measurement therefore use media time, the position
on the video's own timeline, because arrival time only reflects the bursts.
"""

import argparse
import threading
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone

import cv2
import numpy as np

from worker.config import CameraConfig, load_cameras

OPEN_TIMEOUT_MS = 15_000
READ_TIMEOUT_MS = 30_000  # Must outlast the gap between chunks (playlist target is 13 s).
STALL_TIMEOUT_S = 30.0
BUFFER_SECONDS = 15  # Holds a full chunk, so a burst is not dropped on arrival.
LIVE_WINDOW_S = 20.0
DEGRADED_WINDOW_S = 60.0


@dataclass(frozen=True)
class Frame:
    camera_id: str
    session: int  # Goes up on every reconnect; media time restarts with it.
    sequence: int
    media_time_s: float
    received_at: datetime  # Arrival time. Capture time exists only as text burned into the image.
    image: np.ndarray


@dataclass(frozen=True)
class ReaderStatus:
    camera_id: str
    state: str  # live, degraded, or offline, matching the contract's CameraState.
    session: int
    frames_kept: int
    frames_dropped: int
    last_frame_at: datetime | None


class Backoff:
    """Wait longer after each failed attempt, up to a limit."""

    def __init__(self, initial_s: float = 1.0, maximum_s: float = 30.0):
        self.initial_s = initial_s
        self.maximum_s = maximum_s
        self._next_s = initial_s

    def next_delay(self) -> float:
        delay = self._next_s
        self._next_s = min(self._next_s * 2, self.maximum_s)
        return delay

    def reset(self) -> None:
        self._next_s = self.initial_s


class MediaTimeSampler:
    """Keep evenly spaced frames, measured on the video's timeline."""

    def __init__(self, target_fps: float):
        self.interval_s = 1 / target_fps
        self._next_due_s = 0.0

    def should_keep(self, media_time_s: float) -> bool:
        if media_time_s < self._next_due_s:
            return False
        self._next_due_s += self.interval_s
        if self._next_due_s <= media_time_s:
            self._next_due_s = media_time_s + self.interval_s
        return True


class FrameBuffer:
    """Bounded first-in, first-out buffer that drops the oldest frame when full."""

    def __init__(self, capacity: int):
        self._frames: deque[Frame] = deque(maxlen=capacity)
        self._ready = threading.Condition()
        self.dropped = 0

    def put(self, frame: Frame) -> None:
        with self._ready:
            if len(self._frames) == self._frames.maxlen:
                self.dropped += 1
            self._frames.append(frame)
            self._ready.notify()

    def get(self, timeout_s: float) -> Frame | None:
        with self._ready:
            if not self._ready.wait_for(lambda: self._frames, timeout_s):
                return None
            return self._frames.popleft()


def open_capture(url: str) -> cv2.VideoCapture:
    return cv2.VideoCapture(
        url,
        cv2.CAP_FFMPEG,
        [
            cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, OPEN_TIMEOUT_MS,
            cv2.CAP_PROP_READ_TIMEOUT_MSEC, READ_TIMEOUT_MS,
        ],
    )


class StreamReader(threading.Thread):
    """Keep one camera connected and fill its buffer with sampled frames."""

    def __init__(
        self,
        camera: CameraConfig,
        target_fps: float = 5.0,
        open_stream=open_capture,
        clock=time.monotonic,
        backoff: Backoff | None = None,
    ):
        super().__init__(name=f"stream-{camera.id}", daemon=True)
        self.camera = camera
        self.target_fps = target_fps
        self.frames = FrameBuffer(max(1, int(target_fps * BUFFER_SECONDS)))
        self._open_stream = open_stream
        self._clock = clock
        self._backoff = backoff or Backoff()
        self._stop_requested = threading.Event()
        self._lock = threading.Lock()
        self._session = 0
        self._frames_kept = 0
        self._last_frame_clock: float | None = None
        self._last_frame_at: datetime | None = None

    def stop(self) -> None:
        self._stop_requested.set()

    def run(self) -> None:
        while not self._stop_requested.is_set():
            capture = self._open_stream(self.camera.stream_url)
            if capture.isOpened():
                self._read_session(capture)
            capture.release()
            self._stop_requested.wait(self._backoff.next_delay())

    def _read_session(self, capture) -> None:
        """Read until the stream fails, stalls, or the reader is stopped."""
        with self._lock:
            self._session += 1
            session = self._session
        sampler = MediaTimeSampler(self.target_fps)
        last_media_time_s = -1.0
        last_progress = self._clock()

        while not self._stop_requested.is_set():
            if not capture.grab():
                return

            # grab() can succeed without new video, so progress is checked separately.
            media_time_s = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000
            now = self._clock()
            if media_time_s <= last_media_time_s:
                if now - last_progress > STALL_TIMEOUT_S:
                    return
                continue
            last_media_time_s = media_time_s
            last_progress = now

            if sampler.should_keep(media_time_s):
                ok, image = capture.retrieve()
                if not ok:
                    return
                self._keep_frame(session, media_time_s, image, now)

    def _keep_frame(self, session: int, media_time_s: float, image, now: float) -> None:
        received_at = datetime.now(timezone.utc)
        with self._lock:
            self._frames_kept += 1
            sequence = self._frames_kept
            self._last_frame_clock = now
            self._last_frame_at = received_at
        self._backoff.reset()
        self.frames.put(
            Frame(self.camera.id, session, sequence, media_time_s, received_at, image)
        )

    def status(self) -> ReaderStatus:
        """Report state from frame age, so a frozen feed never reads as live."""
        with self._lock:
            if self._last_frame_clock is None:
                state = "offline"
            else:
                age_s = self._clock() - self._last_frame_clock
                if age_s <= LIVE_WINDOW_S:
                    state = "live"
                elif age_s <= DEGRADED_WINDOW_S:
                    state = "degraded"
                else:
                    state = "offline"
            return ReaderStatus(
                self.camera.id,
                state,
                self._session,
                self._frames_kept,
                self.frames.dropped,
                self._last_frame_at,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Watch one camera and print its status.")
    parser.add_argument("camera_id")
    parser.add_argument("--seconds", type=float, default=30)
    args = parser.parse_args()

    camera = next(c for c in load_cameras() if c.id == args.camera_id)
    reader = StreamReader(camera)
    reader.start()

    deadline = time.monotonic() + args.seconds
    next_print = time.monotonic() + 5
    while time.monotonic() < deadline:
        reader.frames.get(timeout_s=0.5)
        if time.monotonic() >= next_print:
            print(reader.status())
            next_print += 5
    reader.stop()


if __name__ == "__main__":
    main()
