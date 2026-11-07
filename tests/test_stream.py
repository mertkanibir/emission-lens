import threading

import cv2
import numpy as np

from worker.config import CameraConfig
from worker.stream import (
    DEGRADED_WINDOW_S,
    LIVE_WINDOW_S,
    STALL_TIMEOUT_S,
    Backoff,
    FrameBuffer,
    MediaTimeSampler,
    StreamReader,
)

CAMERA = CameraConfig("999", "Test", 33.8, -118.3, "https://example.com/playlist.m3u8", True)
IMAGE = np.zeros((2, 2, 3), dtype=np.uint8)


class FakeCapture:
    """Plays back a script of media times; None makes grab() fail."""

    def __init__(self, script=(), opened=True, on_grab=None):
        self.script = list(script)
        self.opened = opened
        self.on_grab = on_grab
        self.position_ms = 0.0
        self.released = False

    def isOpened(self):
        return self.opened

    def grab(self):
        if self.on_grab:
            self.on_grab()
        if not self.script:
            return False
        media_time_s = self.script.pop(0)
        if media_time_s is None:
            return False
        self.position_ms = media_time_s * 1000
        return True

    def get(self, prop):
        assert prop == cv2.CAP_PROP_POS_MSEC
        return self.position_ms

    def retrieve(self):
        return True, IMAGE

    def release(self):
        self.released = True


class FakeClock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


def run_reader(captures, **kwargs):
    """Run a reader through scripted captures, stopping when they run out."""
    remaining = list(captures)
    finished = threading.Event()

    def open_stream(url):
        if remaining:
            return remaining.pop(0)
        finished.set()
        return FakeCapture(opened=False)

    reader = StreamReader(
        CAMERA, open_stream=open_stream, backoff=Backoff(0.001, 0.001), **kwargs
    )
    reader.start()
    assert finished.wait(5)
    reader.stop()
    reader.join(5)
    return reader


def drain(reader):
    frames = []
    while (frame := reader.frames.get(timeout_s=0)) is not None:
        frames.append(frame)
    return frames


def test_backoff_doubles_up_to_the_limit_and_resets():
    backoff = Backoff(1, 4)
    assert [backoff.next_delay() for _ in range(4)] == [1, 2, 4, 4]
    backoff.reset()
    assert backoff.next_delay() == 1


def test_sampler_keeps_five_fps_from_a_fifteen_fps_stream():
    sampler = MediaTimeSampler(5)
    media_times = [i / 15 for i in range(150)]  # 10 seconds of video.
    assert sum(sampler.should_keep(t) for t in media_times) == 50


def test_sampler_recovers_from_a_jump_in_media_time():
    sampler = MediaTimeSampler(5)
    assert sampler.should_keep(0.0)
    assert sampler.should_keep(60.0)
    assert not sampler.should_keep(60.1)
    assert sampler.should_keep(60.2)


def test_buffer_drops_the_oldest_frame_when_full():
    buffer = FrameBuffer(2)
    for value in ("a", "b", "c"):
        buffer.put(value)
    assert buffer.dropped == 1
    assert [buffer.get(0), buffer.get(0), buffer.get(0)] == ["b", "c", None]


def test_frames_keep_media_time_and_order():
    reader = run_reader([FakeCapture([0.0, 0.2, 0.4])])
    frames = drain(reader)
    assert [frame.media_time_s for frame in frames] == [0.0, 0.2, 0.4]
    assert [frame.sequence for frame in frames] == [1, 2, 3]


def test_reconnect_starts_a_new_session():
    first = FakeCapture([0.0, 0.2, None])
    second = FakeCapture([0.0, 0.2])
    frames = drain(run_reader([first, second]))
    assert [frame.session for frame in frames] == [1, 1, 2, 2]
    assert first.released and second.released


def test_failed_open_is_retried():
    frames = drain(run_reader([FakeCapture(opened=False), FakeCapture([0.0])]))
    assert len(frames) == 1


def test_frozen_media_time_triggers_a_reconnect():
    clock = FakeClock()

    def advance():
        clock.now += STALL_TIMEOUT_S / 2

    frozen = FakeCapture([1.0] * 10, on_grab=advance)
    run_reader([frozen, FakeCapture([0.0])], clock=clock)
    assert frozen.script  # Gave up before reaching the end of the script.


def test_status_follows_frame_age():
    clock = FakeClock()
    reader = run_reader([FakeCapture([0.0])], clock=clock)
    assert reader.status().state == "live"
    clock.now = LIVE_WINDOW_S + 1
    assert reader.status().state == "degraded"
    clock.now = DEGRADED_WINDOW_S + 1
    assert reader.status().state == "offline"


def test_status_is_offline_before_any_frame():
    assert StreamReader(CAMERA).status().state == "offline"
