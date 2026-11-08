import cv2
import numpy as np

from worker.dataset import CLASSES
from worker.mio_tcd import build, choose, read_boxes, usable, yolo_lines

CSV = """00000001,car,10,10,50,40
00000001,pedestrian,60,10,70,40
00000002,articulated_truck,0,0,100,50
00000003,car,10,10,20,20
00000003,motorized_vehicle,30,30,35,35
00000004,work_van,10,10,90,90
00000005,pedestrian,1,1,5,5
"""


def make_mio(tmp_path):
    mio = tmp_path / "mio"
    (mio / "train").mkdir(parents=True)
    (mio / "gt_train.csv").write_text(CSV, encoding="utf-8")
    for i in range(1, 6):
        cv2.imwrite(str(mio / "train" / f"0000000{i}.jpg"), np.zeros((100, 200, 3), dtype=np.uint8))
    return mio


def make_dataset(tmp_path):
    data = tmp_path / "ours"
    for split in ("train", "val", "test"):
        (data / "images" / split).mkdir(parents=True)
        (data / "labels" / split).mkdir(parents=True)
        (data / "labels" / split / f"{split}_a.txt").write_text("0 0.5 0.5 0.1 0.1\n", encoding="utf-8")
        cv2.imwrite(str(data / "images" / split / f"{split}_a.jpg"), np.zeros((10, 10, 3), dtype=np.uint8))
    (data / "data.yaml").write_text("train: images/train\n", encoding="utf-8")
    return data


def test_images_with_unclassified_vehicles_or_no_vehicles_are_skipped(tmp_path):
    boxes = read_boxes(make_mio(tmp_path) / "gt_train.csv")
    assert [usable(boxes[i]) for i in ("00000001", "00000003", "00000005")] == [True, False, False]


def test_rare_classes_are_chosen_first():
    boxes = read_boxes_from_text(CSV)
    assert choose(boxes, 1) == ["00000002"]  # The articulated truck.


def read_boxes_from_text(text, tmp=None):
    import tempfile
    from pathlib import Path
    with tempfile.TemporaryDirectory() as d:
        path = Path(d) / "gt.csv"
        path.write_text(text, encoding="utf-8")
        return read_boxes(path)


def test_classes_map_to_ours_and_pedestrians_are_dropped():
    lines = yolo_lines([("work_van", 0, 0, 100, 50), ("pedestrian", 0, 0, 5, 5)], 200, 100)
    assert lines == [f"{CLASSES.index('pickup')} 0.250000 0.250000 0.500000 0.500000"]


def test_boxes_are_clipped_to_the_image():
    [line] = yolo_lines([("car", -10, -10, 50, 50)], 100, 100)
    assert line.split()[1:] == ["0.250000", "0.250000", "0.500000", "0.500000"]


def test_build_adds_mio_to_train_only(tmp_path):
    out = tmp_path / "out"
    added = build(make_mio(tmp_path), make_dataset(tmp_path), out, count=10)
    assert added["images"] == 3 and added["tractor_trailer"] == 1 and added["pickup"] == 1
    assert len(list((out / "images" / "train").glob("mio_*.jpg"))) == 3
    assert [p.name for p in (out / "images" / "test").glob("*.jpg")] == ["test_a.jpg"]
    assert [p.name for p in (out / "images" / "val").glob("*.jpg")] == ["val_a.jpg"]
    assert (out / "data.yaml").exists()
