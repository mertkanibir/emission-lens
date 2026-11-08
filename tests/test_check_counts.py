import json
from pathlib import Path

from evaluation.check_counts import clock, load_config, reviewed_copy, summarize

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config" / "cameras"


def test_clock_formats_clip_time():
    assert clock(65.25) == "1:05.2"
    assert clock(0) == "0:00.0"


def test_summarize_groups_crossings_by_gate():
    crossings = [
        {"gate": "count-1", "direction": "positive", "class": "car", "clip_time_s": 61.0},
        {"gate": "count-1", "direction": "negative", "class": "truck", "clip_time_s": 75.5},
        {"gate": "count-2", "direction": "positive", "class": "car", "clip_time_s": 80.0},
    ]
    result = summarize(crossings)
    assert result["count-1"]["total"] == 2
    assert result["count-1"]["by_direction"] == {"positive": 1, "negative": 1}
    assert result["count-1"]["times"] == ["1:01.0", "1:15.5"]
    assert result["count-2"]["by_class"] == {"car": 1}


def test_reviewed_copy_leaves_the_file_unvalidated():
    path = CONFIG_DIR / "222.measurement.json"
    if not path.exists():
        return  # Geometry not drawn on this checkout.
    before = path.read_text(encoding="utf-8")
    copy = reviewed_copy(load_config("222"))
    assert copy.enabled and copy.image_geometry_status == "reviewed"
    assert path.read_text(encoding="utf-8") == before
    assert json.loads(before)["enabled"] is False


def test_read_manual_parses_times_directions_and_comments(tmp_path):
    from evaluation.check_counts import read_manual

    path = tmp_path / "manual.txt"
    path.write_text("# camera 222 count-2\n1:02.5 +\n\n2:10 -  # truck\n", encoding="utf-8")
    assert read_manual(path) == [{"clip_time_s": 62.5, "direction": "positive"},
                                 {"clip_time_s": 130.0, "direction": "negative"}]


def test_read_manual_rejects_a_bad_line(tmp_path):
    import pytest
    from evaluation.check_counts import read_manual

    path = tmp_path / "manual.txt"
    path.write_text("1:02.5 left\n", encoding="utf-8")
    with pytest.raises(ValueError, match="line 1"):
        read_manual(path)


def test_match_pairs_one_to_one_by_direction_within_tolerance():
    from evaluation.check_counts import match_events

    manual = [{"clip_time_s": t, "direction": d} for t, d in [(10, "positive"), (11, "positive"), (30, "negative"), (50, "positive")]]
    model = [{"clip_time_s": t, "direction": d} for t, d in [(10.4, "positive"), (30.2, "positive"), (70, "positive")]]
    result = match_events(manual, model, tolerance_s=1.5)
    assert result["matched"] == 1  # 30.2 is the wrong direction; 70 is too far from 50.
    assert result["missed"] == ["0:11.0 +", "0:30.0 -", "0:50.0 +"]
    assert result["extra"] == ["0:30.2 +", "1:10.0 +"]
    assert result["recall"] == 0.25 and result["precision"] == 1 / 3


def test_match_prefers_the_closest_pairing():
    from evaluation.check_counts import match_events

    manual = [{"clip_time_s": 10.0, "direction": "positive"}, {"clip_time_s": 11.0, "direction": "positive"}]
    model = [{"clip_time_s": 10.9, "direction": "positive"}, {"clip_time_s": 9.6, "direction": "positive"}]
    assert match_events(manual, model, tolerance_s=1.5)["matched"] == 2
