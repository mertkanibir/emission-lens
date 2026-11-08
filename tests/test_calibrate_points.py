import json
import math

import numpy as np
import pytest

from worker.calibrate_points import (
    Pair,
    aerial_to_ground,
    fit_homography,
    ground_to_aerial,
    load_pairs,
    project,
    residuals,
    save,
    summary,
)
from worker.calibration import project_road_point

LAT = 33.83135
K = math.cos(math.radians(LAT))
META = {"bbox_3857": [0.0, 0.0, 1100.0, 1100.0], "size_px": 1100, "mercator_scale_cos_lat": K,
        "center_latlon": [LAT, -118.35], "ground_m_per_px": K}
# A made-up camera view: image pixels -> ground metres.
TRUE_H = np.array([[0.05, -0.01, -20.0], [0.002, -0.08, 30.0], [0.00001, 0.0004, 1.0]])


def synthetic_pairs(image_points, role="fit"):
    pairs = []
    for px in image_points:
        ground = project(TRUE_H, px)
        pairs.append(Pair(px, ground_to_aerial(ground, META), role))
    return pairs


def test_aerial_centre_is_ground_origin_and_scale_includes_cos_latitude():
    assert aerial_to_ground((549.5, 549.5), META) == pytest.approx((0, 0), abs=1e-9)
    east, north = aerial_to_ground((649.5, 549.5), META)
    assert east == pytest.approx(100 * K) and north == pytest.approx(0)
    assert aerial_to_ground((549.5, 449.5), META)[1] == pytest.approx(100 * K)  # Up the image is north.


def test_ground_to_aerial_inverts_aerial_to_ground():
    assert aerial_to_ground(ground_to_aerial((12.3, -4.5), META), META) == pytest.approx((12.3, -4.5))


def test_fit_recovers_a_known_homography():
    pairs = synthetic_pairs([(100, 200), (1100, 220), (1000, 650), (150, 600), (640, 400), (300, 450)])
    matrix = fit_homography(pairs, META)
    assert project(matrix, (800, 300)) == pytest.approx(project(TRUE_H, (800, 300)), abs=1e-6)
    assert summary(residuals(matrix, pairs, META))["fit"]["max_m"] < 1e-3


def test_validation_pairs_are_not_used_in_the_fit():
    pairs = synthetic_pairs([(100, 200), (1100, 220), (1000, 650), (150, 600)])
    pairs.append(Pair((640, 400), (0.0, 0.0), "validation"))  # Deliberately wrong.
    matrix = fit_homography(pairs, META)
    result = summary(residuals(matrix, pairs, META))
    assert result["fit"]["max_m"] < 1e-3 and result["validation"]["max_m"] > 10


def test_fit_needs_four_fit_pairs():
    with pytest.raises(ValueError, match="at least 4"):
        fit_homography(synthetic_pairs([(100, 200), (1100, 220), (1000, 650)]), META)


def test_saved_matrix_works_with_the_workers_projection(tmp_path):
    pairs = synthetic_pairs([(100, 200), (1100, 220), (1000, 650), (150, 600), (640, 400)])
    path = tmp_path / "c.json"
    record = save(path, "222", "esri_world", META, pairs)
    assert project_road_point(record["homography"], (800, 300)) == pytest.approx(project(TRUE_H, (800, 300)), abs=1e-6)
    assert [p.role for p in load_pairs(path)] == ["fit"] * 5
    assert json.loads(path.read_text())["status"].startswith("candidate")


def test_save_records_why_a_fit_failed(tmp_path):
    record = save(tmp_path / "c.json", "222", "esri_world", META, synthetic_pairs([(1, 1)]))
    assert "at least 4" in record["fit_error"]


def test_gate_distance_on_a_simple_scale():
    from worker.calibrate_points import gate_distance

    scale = np.diag([0.1, 0.1, 1.0])  # 1 pixel = 0.1 m, no perspective.
    entry = ((0.25, 0.0), (0.25, 1.0))  # Vertical line at x = 320 px.
    exit = ((0.75, 0.0), (0.75, 1.0))  # Vertical line at x = 960 px.
    result = gate_distance(scale, entry, exit)
    assert result["midpoint_distance_m"] == pytest.approx(64.0)
    assert result["lane_spread_m"] == [pytest.approx(64.0), pytest.approx(64.0)]
    assert result["entry_length_m"] == pytest.approx(72.0)


def test_gate_distance_spread_shows_angled_gates():
    from worker.calibrate_points import gate_distance

    scale = np.diag([0.1, 0.1, 1.0])
    result = gate_distance(scale, ((0.25, 0.0), (0.35, 1.0)), ((0.75, 0.0), (0.75, 1.0)))
    low, high = result["lane_spread_m"]
    assert low == pytest.approx(51.2) and high == pytest.approx(64.0)
