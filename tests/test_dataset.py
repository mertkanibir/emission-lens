import zipfile

import cv2
import numpy as np
import pytest

from worker.dataset import (
    CLASSES,
    DRAFT_CLASSES,
    NEEDS_REVIEW,
    DatasetError,
    build_dataset,
    choose_frames,
    label_errors,
    label_line,
    split_by_time,
    write_draft,
)
from worker.detect import Detection

TRUCK = Detection("truck", 0.9, 10, 20, 30, 60)
CAR = Detection("car", 0.8, 0, 0, 50, 50)
VALID_LABEL = "0 0.5 0.5 0.1 0.1\n"


class FakeDetector:
    def detect(self, image):
        return [CAR, TRUCK]


def make_frames(directory, camera="222", count=20):
    camera_dir = directory / camera
    camera_dir.mkdir(parents=True)
    paths = []
    for i in range(count):
        path = camera_dir / f"{camera}_20261107T20{i:02d}00Z_{i:05d}.jpg"
        cv2.imwrite(str(path), np.zeros((100, 200, 3), dtype=np.uint8))
        paths.append(path)
    return paths


def make_draft(directory, label=VALID_LABEL, count=20):
    frames = make_frames(directory / "frames", count=count)
    write_draft(frames, FakeDetector(), directory / "draft")
    for path in (directory / "draft" / "labels").glob("*.txt"):
        path.write_text(label, encoding="utf-8")
    return directory / "draft"


def test_choose_frames_spreads_evenly_across_cameras(tmp_path):
    make_frames(tmp_path, "222", 40)
    make_frames(tmp_path, "223", 40)
    chosen = choose_frames(tmp_path, 8)
    assert [path.parent.name for path in chosen] == ["222"] * 4 + ["223"] * 4
    assert [path.name.split("_")[2] for path in chosen[:4]] == [
        "00000.jpg", "00010.jpg", "00020.jpg", "00030.jpg",
    ]


def test_choose_frames_handles_fewer_frames_than_requested(tmp_path):
    make_frames(tmp_path, "222", 3)
    assert len(choose_frames(tmp_path, 100)) == 3


def test_label_line_uses_yolo_fractions():
    assert label_line(CAR, 100, 100) == "0 0.250000 0.250000 0.500000 0.500000"


def test_pretrained_truck_needs_review():
    class_id = int(label_line(TRUCK, 100, 100).split()[0])
    assert DRAFT_CLASSES[class_id] == NEEDS_REVIEW


def test_write_draft_writes_images_labels_and_classes(tmp_path):
    frames = make_frames(tmp_path / "frames", count=1)
    write_draft(frames, FakeDetector(), tmp_path / "draft")
    label = tmp_path / "draft" / "labels" / f"{frames[0].stem}.txt"
    assert len(label.read_text(encoding="utf-8").splitlines()) == 2
    assert (tmp_path / "draft" / "images" / frames[0].name).exists()
    classes = (tmp_path / "draft" / "classes.txt").read_text(encoding="utf-8").split()
    assert classes == DRAFT_CLASSES


@pytest.mark.parametrize(
    "line, message",
    [
        ("7 0.5 0.5 0.1 0.1", "needs review"),
        ("9 0.5 0.5 0.1 0.1", "unknown class"),
        ("0 0.5 0.5 1.1 0.1", "from 0 to 1"),
        ("0 0.5 0.5", "from 0 to 1"),
        ("car 0.5 0.5 0.1 0.1", "not a YOLO label"),
    ],
)
def test_bad_labels_are_reported(tmp_path, line, message):
    path = tmp_path / "a.txt"
    path.write_text(f"{line}\n", encoding="utf-8")
    assert message in label_errors(path)[0]


def test_empty_label_file_means_no_vehicles(tmp_path):
    path = tmp_path / "a.txt"
    path.write_text("", encoding="utf-8")
    assert label_errors(path) == []


def test_split_keeps_time_blocks_and_every_frame(tmp_path):
    frames = make_frames(tmp_path, "222", 20)
    splits = split_by_time(frames)
    assert [len(splits[name]) for name in ("train", "val", "test")] == [14, 3, 3]
    assert max(splits["train"]) < min(splits["val"]) <= max(splits["val"]) < min(splits["test"])


def test_build_refuses_unreviewed_trucks(tmp_path):
    draft = make_draft(tmp_path, label="7 0.5 0.5 0.1 0.1\n")
    with pytest.raises(DatasetError, match="still needs review"):
        build_dataset(draft, tmp_path / "dataset")
    assert not (tmp_path / "dataset").exists()


def test_build_refuses_a_missing_label(tmp_path):
    draft = make_draft(tmp_path)
    next((draft / "labels").glob("*.txt")).unlink()
    with pytest.raises(DatasetError, match="missing"):
        build_dataset(draft, tmp_path / "dataset")


def test_build_writes_a_complete_zip(tmp_path):
    archive = build_dataset(make_draft(tmp_path), tmp_path / "dataset")
    names = zipfile.ZipFile(archive).namelist()
    assert "data.yaml" in names
    assert sum(name.endswith(".jpg") for name in names) == 20
    assert sum(name.endswith(".txt") for name in names) == 20
    data_yaml = (tmp_path / "dataset" / "data.yaml").read_text(encoding="utf-8")
    assert all(name in data_yaml for name in CLASSES)
    assert NEEDS_REVIEW not in data_yaml
