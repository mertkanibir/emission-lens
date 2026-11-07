from datetime import datetime, timezone

import cv2
import numpy as np
import pytest

from worker import collect_frames
from worker.collect_frames import save_frame
from worker.stream import Frame

FRAME = Frame(
    camera_id="222",
    session=1,
    sequence=7,
    media_time_s=1.0,
    received_at=datetime(2026, 11, 7, 20, 30, 5, tzinfo=timezone.utc),
    image=np.full((8, 8, 3), 128, dtype=np.uint8),
)


def test_save_frame_writes_a_readable_image_in_the_camera_folder(tmp_path):
    path = save_frame(FRAME, tmp_path)
    assert path == tmp_path / "222" / "222_20261107T203005Z_00007.jpg"
    assert cv2.imread(str(path)).shape == (8, 8, 3)


def test_save_frame_reports_a_failed_write(tmp_path, monkeypatch):
    monkeypatch.setattr(collect_frames.cv2, "imwrite", lambda *args: False)
    with pytest.raises(OSError, match="could not write"):
        save_frame(FRAME, tmp_path)
