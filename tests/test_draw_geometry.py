import json

import numpy as np
import pytest

from worker.draw_geometry import GeometryDraft, positive_side, render, save, validate
from worker.metrics import MetricsConfig

SQUARE = [(0.1, 0.1), (0.9, 0.1), (0.9, 0.9), (0.1, 0.9)]


def drawn(*clicks_by_mode):
    draft = GeometryDraft("222")
    for mode, clicks in clicks_by_mode:
        draft.set_mode(mode)
        for point in clicks:
            draft.click(point)
        draft.finish()
    return draft


def test_a_complete_drawing_loads_in_the_worker():
    draft = drawn(("road", SQUARE), ("excluded", [(0.2, 0.2), (0.3, 0.2), (0.3, 0.3)]),
                  ("gate", [(0.2, 0.5), (0.8, 0.5)]))
    config = MetricsConfig.from_dict(draft.to_config())
    assert config.enabled is False and config.image_geometry_status == "unvalidated"
    assert [g.id for g in config.gates] == ["count-1"]
    assert len(config.excluded_regions) == 1


def test_a_gate_finishes_itself_after_two_clicks():
    draft = drawn(("road", SQUARE))
    draft.set_mode("gate")
    draft.click((0.2, 0.5))
    draft.click((0.8, 0.5))
    assert draft.gates == [((0.2, 0.5), (0.8, 0.5))] and draft.points == []


def test_a_shape_with_too_few_points_is_not_stored():
    draft = drawn(("road", SQUARE[:2]))
    assert draft.road_region == []


def test_a_crossing_outline_is_refused_at_enter_and_kept_for_fixing():
    draft = GeometryDraft("220")
    for point in [(0.1, 0.1), (0.9, 0.9), (0.9, 0.1), (0.2, 0.6)]:  # Lopsided bow tie.
        draft.click(point)
    error = draft.finish()
    assert "crossing edges" in error and "u to undo" in error
    assert draft.road_region == [] and len(draft.points) == 4


def test_validate_reports_the_workers_own_error():
    draft = drawn(("road", SQUARE), ("gate", [(0.05, 0.5), (0.8, 0.5)]))  # Starts outside the road.
    assert "inside the road region" in validate(draft)


def test_save_refuses_an_invalid_drawing(tmp_path):
    with pytest.raises(ValueError):
        save(drawn(("road", SQUARE)), tmp_path / "222.measurement.json")  # No gate.
    assert not (tmp_path / "222.measurement.json").exists()


def test_reopening_a_saved_file_bumps_the_version(tmp_path):
    path = tmp_path / "222.measurement.json"
    save(drawn(("road", SQUARE), ("gate", [(0.2, 0.5), (0.8, 0.5)])), path)
    reopened = GeometryDraft.from_config(json.loads(path.read_text(encoding="utf-8")))
    assert reopened.to_config()["version"] == "222-image-v2"
    assert reopened.gates == [((0.2, 0.5), (0.8, 0.5))]


def test_undo_and_delete():
    draft = drawn(("road", SQUARE), ("gate", [(0.2, 0.5), (0.8, 0.5)]))
    draft.set_mode("excluded")
    draft.click((0.2, 0.2))
    draft.undo()
    assert draft.points == []
    draft.set_mode("gate")
    draft.delete_last()
    assert draft.gates == []


def test_positive_side_matches_the_workers_signed_distance():
    config = MetricsConfig.from_dict(drawn(("road", SQUARE), ("gate", [(0.2, 0.5), (0.8, 0.5)])).to_config())
    gate = config.gates[0]
    nx, ny = positive_side(gate.start, gate.end)
    assert gate.signed_distance((0.5 + nx * 0.1, 0.5 + ny * 0.1)) > 0


def test_render_draws_without_changing_the_frame():
    frame = np.zeros((72, 128, 3), dtype=np.uint8)
    canvas = render(frame, drawn(("road", SQUARE), ("gate", [(0.2, 0.5), (0.8, 0.5)])), "hello")
    assert frame.sum() == 0 and canvas.sum() > 0
