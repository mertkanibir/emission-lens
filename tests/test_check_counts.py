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
