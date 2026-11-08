import numpy as np
import pytest

from evaluation.stop_threshold import best_threshold, labelled_intervals

SCALE = np.diag([0.01, 0.01, 1.0])  # 1 pixel = 1 cm, so 1280 px wide = 12.8 m.
REGION = np.array([[[0, 0]], [[1, 0]], [[1, 1]], [[0, 1]]], dtype=np.float32)


def track(speed_mps, seconds=3.0, fps=15):
    """Points moving right at a constant ground speed, in normalized image units."""
    return [(i / fps, 0.1 + speed_mps * (i / fps) / 12.8, 0.5) for i in range(int(seconds * fps))]


def test_stopped_and_moving_tracks_are_labelled_and_ambiguous_ones_left_out():
    tracks = {1: track(0.0), 2: track(5.0), 3: track(1.0)}
    labels = labelled_intervals(tracks, SCALE, REGION)
    stopped = [s for _, s in labels]
    assert stopped.count(True) > 0 and stopped.count(False) > 0
    assert len(labels) < sum(len(t) - 1 for t in tracks.values())  # The 1 m/s track is ambiguous.


def test_points_outside_the_region_are_ignored():
    outside = np.array([[[2, 2]], [[3, 2]], [[3, 3]]], dtype=np.float32)
    assert labelled_intervals({1: track(0.0)}, SCALE, outside) == []


def test_best_threshold_separates_clean_groups():
    intervals = [(0.001, True)] * 50 + [(0.05, False)] * 50
    result = best_threshold(intervals)
    assert result["balanced_accuracy"] == pytest.approx(1.0)
    assert 0.001 <= result["threshold"] < 0.05
