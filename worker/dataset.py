"""Turn collected frames into a labeled YOLO dataset.

draft: pick frames and pre-fill boxes with the pretrained detector.
build: check the reviewed labels, split them by time, and zip them for training.

Everything here holds real traffic images, so it stays in the git-ignored data/raw/.
"""

import argparse
import shutil
from pathlib import Path

import cv2

from worker.detect import Detection, Detector

RAW_DIR = Path(__file__).resolve().parents[1] / "data" / "raw"
CLASSES = ["car", "pickup", "box_truck", "tractor_trailer", "bus", "motorcycle", "tesla"]
# Draft only. Pretrained YOLO has one "truck" class, so a person must pick the real one.
NEEDS_REVIEW = "needs_review"
DRAFT_CLASSES = [*CLASSES, NEEDS_REVIEW]
DRAFT_LABELS = {"car": "car", "motorcycle": "motorcycle", "bus": "bus", "truck": NEEDS_REVIEW}
TRAIN_SHARE = 0.70
VAL_SHARE = 0.15


class DatasetError(ValueError):
    """The reviewed labels are not ready for training."""


def choose_frames(frames_dir: Path, count: int) -> list[Path]:
    """Pick about count frames, evenly spaced in time and shared across cameras."""
    cameras = sorted(path for path in frames_dir.iterdir() if path.is_dir())
    per_camera = count // len(cameras)
    chosen = []
    for camera in cameras:
        frames = sorted(camera.glob("*.jpg"))
        step = max(1, len(frames) / per_camera)
        indexes = sorted({int(i * step) for i in range(min(per_camera, len(frames)))})
        chosen.extend(frames[i] for i in indexes)
    return chosen


def label_line(detection: Detection, width: int, height: int) -> str:
    """Format one box as YOLO text: class id, then centre and size as image fractions."""
    class_id = DRAFT_CLASSES.index(DRAFT_LABELS[detection.label])
    x_center = (detection.x1 + detection.x2) / 2 / width
    y_center = (detection.y1 + detection.y2) / 2 / height
    box_width = (detection.x2 - detection.x1) / width
    box_height = (detection.y2 - detection.y1) / height
    return f"{class_id} {x_center:.6f} {y_center:.6f} {box_width:.6f} {box_height:.6f}"


def write_draft(frames: list[Path], detector, output_dir: Path) -> None:
    (output_dir / "images").mkdir(parents=True, exist_ok=True)
    (output_dir / "labels").mkdir(parents=True, exist_ok=True)
    (output_dir / "classes.txt").write_text("\n".join(DRAFT_CLASSES) + "\n", encoding="utf-8")

    for frame in frames:
        image = cv2.imread(str(frame))
        height, width = image.shape[:2]
        lines = [label_line(d, width, height) for d in detector.detect(image)]
        shutil.copy2(frame, output_dir / "images" / frame.name)
        label_path = output_dir / "labels" / f"{frame.stem}.txt"
        label_path.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")


def label_errors(path: Path) -> list[str]:
    """Return every problem in one reviewed label file."""
    errors = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        where = f"{path.name} line {number}"
        parts = line.split()
        try:
            class_id = int(parts[0])
            box = [float(value) for value in parts[1:]]
        except (IndexError, ValueError):
            errors.append(f"{where}: not a YOLO label")
            continue
        if class_id == DRAFT_CLASSES.index(NEEDS_REVIEW):
            errors.append(f"{where}: still needs review")
        elif not 0 <= class_id < len(CLASSES):
            errors.append(f"{where}: unknown class {class_id}")
        if len(box) != 4 or not all(0 <= value <= 1 for value in box):
            errors.append(f"{where}: box must be four values from 0 to 1")
    return errors


def split_by_time(images: list[Path]) -> dict[str, list[Path]]:
    """Split each camera into time blocks, keeping the latest frames for testing.

    A random split would put near-identical frames from one red light on both
    sides, which would make test scores look better than they are.
    """
    splits = {"train": [], "val": [], "test": []}
    cameras = sorted({image.name.split("_")[0] for image in images})
    for camera in cameras:
        frames = sorted(image for image in images if image.name.startswith(f"{camera}_"))
        train_end = int(len(frames) * TRAIN_SHARE)
        val_end = int(len(frames) * (TRAIN_SHARE + VAL_SHARE))
        splits["train"].extend(frames[:train_end])
        splits["val"].extend(frames[train_end:val_end])
        splits["test"].extend(frames[val_end:])
    return splits


def build_dataset(draft_dir: Path, output_dir: Path) -> Path:
    """Check the reviewed draft, write the dataset, and return the zip path."""
    images = sorted((draft_dir / "images").glob("*.jpg"))
    if not images:
        raise DatasetError(f"no images in {draft_dir / 'images'}")

    errors = []
    for image in images:
        label = draft_dir / "labels" / f"{image.stem}.txt"
        if label.exists():
            errors.extend(label_errors(label))
        else:
            errors.append(f"{label.name}: missing")
    if errors:
        shown = "\n".join(errors[:20])
        raise DatasetError(f"{len(errors)} problems, first {min(len(errors), 20)}:\n{shown}")

    if output_dir.exists():
        shutil.rmtree(output_dir)
    for split, frames in split_by_time(images).items():
        (output_dir / "images" / split).mkdir(parents=True)
        (output_dir / "labels" / split).mkdir(parents=True)
        for image in frames:
            shutil.copy2(image, output_dir / "images" / split / image.name)
            label = f"{image.stem}.txt"
            shutil.copy2(draft_dir / "labels" / label, output_dir / "labels" / split / label)

    # No path key: Ultralytics then resolves these folders next to this file.
    names = "\n".join(f"  {i}: {name}" for i, name in enumerate(CLASSES))
    (output_dir / "data.yaml").write_text(
        f"train: images/train\nval: images/val\ntest: images/test\nnames:\n{names}\n",
        encoding="utf-8",
    )
    return Path(shutil.make_archive(str(output_dir), "zip", output_dir))


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the labeling and training dataset.")
    commands = parser.add_subparsers(dest="command", required=True)

    draft = commands.add_parser("draft", help="pick frames and pre-fill boxes")
    draft.add_argument("--count", type=int, default=400)
    draft.add_argument("--frames", type=Path, default=RAW_DIR / "frames")
    draft.add_argument("--output", type=Path, default=RAW_DIR / "dataset_draft")

    build = commands.add_parser("build", help="check reviewed labels and zip the dataset")
    build.add_argument("--draft", type=Path, default=RAW_DIR / "dataset_draft")
    build.add_argument("--output", type=Path, default=RAW_DIR / "dataset")

    args = parser.parse_args()
    if args.command == "draft":
        frames = choose_frames(args.frames, args.count)
        write_draft(frames, Detector(), args.output)
        print(f"drafted {len(frames)} frames in {args.output}")
    else:
        print(f"wrote {build_dataset(args.draft, args.output)}")


if __name__ == "__main__":
    main()
