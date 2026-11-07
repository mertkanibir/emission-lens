import pytest

from evaluation.compare_models import (
    Box,
    coarse,
    iou,
    large_enough,
    load_truth,
    markdown,
    match,
    rates,
    read_labels,
    score,
    tesla_rule,
)


def box(label, x1=0, y1=0, x2=100, y2=100, confidence=1.0):
    return Box(label, x1, y1, x2, y2, confidence)


def test_iou_of_identical_and_separate_boxes():
    assert iou(box("car"), box("car")) == 1.0
    assert iou(box("car"), box("car", 200, 200, 300, 300)) == 0.0


def test_iou_of_half_overlap():
    assert iou(box("car", 0, 0, 100, 100), box("car", 50, 0, 150, 100)) == pytest.approx(1 / 3)


def test_read_labels_converts_yolo_fractions_to_pixels(tmp_path):
    path = tmp_path / "a.txt"
    path.write_text("6 0.5 0.5 0.1 0.2\n", encoding="utf-8")
    [b] = read_labels(path, 1000, 500)
    assert (b.label, b.x1, b.y1, b.x2, b.y2) == ("tesla", 450, 200, 550, 300)


def test_match_pairs_the_most_confident_prediction_first():
    truth = [box("car")]
    predictions = [box("car", confidence=0.3), box("car", confidence=0.9)]
    pairs = match(truth, predictions, same_label=True)
    matched = [p for t, p in pairs if t and p]
    assert [p.confidence for p in matched] == [0.9]
    assert sum(1 for t, p in pairs if p and not t) == 1


def test_match_by_label_treats_a_wrong_class_as_a_miss_and_a_false_alarm():
    pairs = match([box("car")], [box("truck")], same_label=True)
    assert sorted((t is not None, p is not None) for t, p in pairs) == [(False, True), (True, False)]


def test_small_boxes_are_ignored():
    assert large_enough([box("car", 0, 0, 20, 20), box("car", 0, 0, 30, 30)]) == [box("car", 0, 0, 30, 30)]


def test_coarse_merges_tesla_into_car_and_truck_types_into_truck():
    labels = [b.label for b in coarse([box("tesla"), box("pickup"), box("tractor_trailer"), box("bus")])]
    assert labels == ["car", "truck", "truck", "bus"]


def test_score_counts_hits_misses_and_false_alarms():
    frames = [
        ([box("car"), box("bus", 300, 0, 400, 100)], [box("car"), box("truck", 300, 0, 400, 100)]),
        ([box("car")], []),
    ]
    result = score(frames, ["car", "truck", "bus", "motorcycle"])
    assert result["classes"]["car"]["recall"] == 0.5
    assert result["classes"]["bus"]["false_neg"] == 1
    assert result["classes"]["truck"]["false_pos"] == 1
    assert result["classes"]["motorcycle"]["precision"] is None
    assert result["any_vehicle"]["recall"] == pytest.approx(2 / 3)
    assert result["confusion"]["bus -> truck"] == 1
    assert result["count_error"]["mean_signed"] == -0.5


@pytest.mark.parametrize("false_pos,false_neg", [(2, 3), (2, 0), (0, 3)])
def test_f1_is_zero_when_all_supported_detections_are_wrong(false_pos, false_neg):
    assert rates(0, false_pos, false_neg)["f1"] == 0.0


def test_f1_is_unavailable_when_the_class_has_no_evidence():
    assert rates(0, 0, 0)["f1"] is None


@pytest.mark.parametrize("create_directory", [False, True])
def test_load_truth_rejects_missing_or_empty_test_images(tmp_path, create_directory):
    test_images = tmp_path / "images" / "test"
    if create_directory:
        test_images.mkdir(parents=True)
    with pytest.raises(ValueError, match="No held-out test images found"):
        load_truth(tmp_path)


def test_tesla_rule_only_counts_confident_tesla_calls():
    frames = [([box("tesla"), box("car", 300, 0, 400, 100)],
               [box("tesla", confidence=0.9), box("tesla", 300, 0, 400, 100, confidence=0.95),
                box("tesla", 600, 0, 700, 100, confidence=0.5)])]
    assert tesla_rule(frames) == {"labeled_teslas": 1, "confident_tesla_calls": 2, "correct_calls": 1}


def test_markdown_reports_every_model():
    result = score([([box("car")], [box("car")])], ["car", "truck", "bus", "motorcycle"])
    report = {"test_frames": 1, "truth_boxes": {"car": 1},
              "settings": {"image_size": 1280, "confidence": 0.25, "iou": 0.5, "min_width_px": 25},
              "models": {"pretrained": {"weights": "a.pt", "coarse": result}}}
    text = markdown(report)
    assert "| car | pretrained | 100% | 100% | 100% |" in text
    assert "Fine classes" not in text


def test_confusion_names_misses_and_false_alarms():
    result = score([([box("car")], [box("bus", 300, 0, 400, 100)])], ["car", "truck", "bus", "motorcycle"])
    assert result["confusion"] == {"car -> not detected": 1, "no vehicle -> bus": 1}
