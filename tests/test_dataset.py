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
    merge_exports,
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


def test_worker_classes_are_all_in_the_shared_contract():
    import re
    from pathlib import Path

    from worker.detect import PRETRAINED_VEHICLE_LABELS

    types_ts = Path(__file__).resolve().parents[1] / "contracts" / "src" / "types.ts"
    block = re.search(r"VEHICLE_CLASSES = \[(.*?)\]", types_ts.read_text(encoding="utf-8"), re.S)
    contract = set(re.findall(r'"(\w+)"', block.group(1)))
    assert set(CLASSES) <= contract
    assert PRETRAINED_VEHICLE_LABELS <= contract


def test_build_matches_classes_by_name_when_the_tool_reorders_them(tmp_path):
    draft = make_draft(tmp_path, label="1 0.5 0.5 0.1 0.1\n")  # 1 = "car" in the export below.
    (draft / "classes.txt").write_text("bus\ncar\ntesla\n", encoding="utf-8")
    build_dataset(draft, tmp_path / "dataset")
    label = next((tmp_path / "dataset" / "labels" / "train").glob("*.txt"))
    assert label.read_text(encoding="utf-8").split()[0] == str(CLASSES.index("car"))


def test_build_rejects_a_class_name_outside_the_training_classes(tmp_path):
    draft = make_draft(tmp_path, label="0 0.5 0.5 0.1 0.1\n")
    (draft / "classes.txt").write_text("sedan\n", encoding="utf-8")
    with pytest.raises(DatasetError, match="unknown class sedan"):
        build_dataset(draft, tmp_path / "dataset")


def make_reviewed(tmp_path, count=20):
    """A reviewed folder like data/raw/reviewed: draft labels plus provenance."""
    draft = make_draft(tmp_path, count=count)
    (draft / "provenance.json").write_text("{}", encoding="utf-8")
    return draft


def write_export(path, stems, label="1 0.5 0.5 0.1 0.1\n", classes="bus\ncar\ntesla\n"):
    """A Label Studio YOLO export: alphabetical classes.txt plus one label file per frame."""
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("classes.txt", classes)
        for stem in stems:
            archive.writestr(f"labels/{stem}.txt", label)
    return path


def held_out_stems(reviewed):
    images = sorted((reviewed / "images").glob("*.jpg"))
    return [image.stem for image in split_by_time(images)["test"]]


def test_build_refuses_until_every_test_frame_is_human_reviewed(tmp_path):
    reviewed = make_reviewed(tmp_path)
    with pytest.raises(DatasetError, match="not reviewed by a person"):
        build_dataset(reviewed, tmp_path / "dataset")
    stems = held_out_stems(reviewed)
    merge_exports(reviewed, [write_export(tmp_path / "a.zip", stems[:1])])
    with pytest.raises(DatasetError, match="not reviewed by a person"):
        build_dataset(reviewed, tmp_path / "dataset")
    result = merge_exports(reviewed, [write_export(tmp_path / "b.zip", stems[1:])])
    assert result["still_missing"] == 0
    build_dataset(reviewed, tmp_path / "dataset")


def test_merge_renumbers_export_classes_into_draft_order(tmp_path):
    reviewed = make_reviewed(tmp_path)
    stem = held_out_stems(reviewed)[0]
    merge_exports(reviewed, [write_export(tmp_path / "a.zip", [stem])])
    saved = (reviewed / "labels" / f"{stem}.txt").read_text(encoding="utf-8")
    assert saved.split()[0] == str(DRAFT_CLASSES.index("car"))


def test_merge_rejects_a_frame_outside_the_test_set(tmp_path):
    reviewed = make_reviewed(tmp_path)
    train_stem = sorted(p.stem for p in (reviewed / "images").glob("*.jpg"))[0]
    with pytest.raises(DatasetError, match="not a test frame"):
        merge_exports(reviewed, [write_export(tmp_path / "a.zip", [train_stem])])


def test_merge_writes_nothing_when_any_label_is_bad(tmp_path):
    reviewed = make_reviewed(tmp_path)
    good, bad = held_out_stems(reviewed)[:2]
    before = (reviewed / "labels" / f"{good}.txt").read_text(encoding="utf-8")
    write_export(tmp_path / "good.zip", [good])
    write_export(tmp_path / "bad.zip", [bad], classes="car\nneeds_review\n")
    with pytest.raises(DatasetError, match="still needs review"):
        merge_exports(reviewed, [tmp_path / "good.zip", tmp_path / "bad.zip"])
    assert (reviewed / "labels" / f"{good}.txt").read_text(encoding="utf-8") == before
