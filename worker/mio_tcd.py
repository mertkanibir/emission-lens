"""Add MIO-TCD traffic-camera frames to the training split of our dataset.

MIO-TCD (Luo et al., IEEE TIP 2018) is CC BY-NC-SA 4.0: non-commercial use with
attribution. Its localization set lists boxes in gt_train.csv as
image_id,label,x1,y1,x2,y2 with images in train/<image_id>.jpg.

    python -m worker.mio_tcd --mio ~/MIO-TCD-Localization --dataset ~/emission-lens-data \\
        --output ~/emission-lens-data-mio --images 4000

Validation and test splits are copied unchanged, so the result is scored on the
same human-reviewed test frames as before.
"""

import argparse
import csv
import random
import shutil
from collections import Counter, defaultdict
from pathlib import Path

import cv2

from worker.dataset import CLASSES

TO_OURS = {
    "car": "car",
    "pickup_truck": "pickup",
    "work_van": "pickup",  # Our labeling rule: full-size work vans are pickup.
    "single_unit_truck": "box_truck",
    "articulated_truck": "tractor_trailer",
    "bus": "bus",
    "motorcycle": "motorcycle",
}
NOT_DETECTED = {"pedestrian", "bicycle", "non-motorized_vehicle"}  # Not vehicles we detect.
UNCLASSIFIED = "motorized_vehicle"  # Too small or blurry to classify; skip the whole image.
RARE_FIRST = ["articulated_truck", "single_unit_truck", "motorcycle", "bus", "work_van", "pickup_truck"]


def read_boxes(csv_path: Path) -> dict[str, list[tuple[str, float, float, float, float]]]:
    boxes = defaultdict(list)
    with csv_path.open(newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if len(row) != 6:
                continue
            image_id, label, *coords = (value.strip() for value in row)
            boxes[image_id].append((label, *map(float, coords)))
    return boxes


def usable(image_boxes) -> bool:
    labels = {label for label, *_ in image_boxes}
    return UNCLASSIFIED not in labels and labels <= set(TO_OURS) | NOT_DETECTED and bool(labels & set(TO_OURS))


def choose(boxes: dict, count: int, seed: int = 0) -> list[str]:
    """Take images with the rarest classes first, then fill with the rest."""
    rng = random.Random(seed)
    candidates = sorted(i for i, b in boxes.items() if usable(b))
    chosen, taken = [], set()
    for label in RARE_FIRST:
        with_label = [i for i in candidates if i not in taken and any(b[0] == label for b in boxes[i])]
        rng.shuffle(with_label)
        for image_id in with_label[: max(0, count - len(chosen))]:
            chosen.append(image_id)
            taken.add(image_id)
    rest = [i for i in candidates if i not in taken]
    rng.shuffle(rest)
    chosen.extend(rest[: max(0, count - len(chosen))])
    return chosen


def yolo_lines(image_boxes, width: int, height: int) -> list[str]:
    lines = []
    for label, x1, y1, x2, y2 in image_boxes:
        if label not in TO_OURS:
            continue
        x1, x2 = max(0.0, x1), min(float(width), x2)
        y1, y2 = max(0.0, y1), min(float(height), y2)
        if x2 <= x1 or y2 <= y1:
            continue
        lines.append(f"{CLASSES.index(TO_OURS[label])} {(x1 + x2) / 2 / width:.6f} {(y1 + y2) / 2 / height:.6f} "
                     f"{(x2 - x1) / width:.6f} {(y2 - y1) / height:.6f}")
    return lines


def build(mio: Path, dataset: Path, output: Path, count: int) -> Counter:
    if output.exists():
        shutil.rmtree(output)
    shutil.copytree(dataset, output)
    boxes = read_boxes(mio / "gt_train.csv")
    added = Counter()
    for image_id in choose(boxes, count):
        source = mio / "train" / f"{image_id}.jpg"
        image = cv2.imread(str(source))
        if image is None:
            continue
        height, width = image.shape[:2]
        lines = yolo_lines(boxes[image_id], width, height)
        if not lines:
            continue
        shutil.copy2(source, output / "images" / "train" / f"mio_{image_id}.jpg")
        (output / "labels" / "train" / f"mio_{image_id}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        added["images"] += 1
        added.update(CLASSES[int(line.split()[0])] for line in lines)
    return added


def main() -> None:
    parser = argparse.ArgumentParser(description="Add MIO-TCD frames to the training split.")
    parser.add_argument("--mio", type=Path, required=True, help="folder with gt_train.csv and train/")
    parser.add_argument("--dataset", type=Path, required=True, help="our built dataset (data.yaml, images, labels)")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--images", type=int, default=4000)
    args = parser.parse_args()
    print(dict(build(args.mio, args.dataset, args.output, args.images)))


if __name__ == "__main__":
    main()
