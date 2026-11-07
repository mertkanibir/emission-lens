"""Score detectors on the human-labeled test frames.

The pretrained COCO model and the fine-tuned model name classes differently, so
both are compared on coarse classes (car, truck, bus, motorcycle). The fine-tuned
model is also scored on its own seven classes. Boxes narrower than 25 pixels are
ignored on both sides, matching the labeling rule for distant vehicles.

Run from the repository root:
    python -m evaluation.compare_models --tuned path/to/best.pt
"""

import argparse
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import cv2

from worker.dataset import CLASSES, RAW_DIR
from worker.detect import DEFAULT_WEIGHTS, MIN_CONFIDENCE, PRETRAINED_VEHICLE_LABELS

REPO = Path(__file__).resolve().parents[1]
MIN_WIDTH_PX = 25
IOU_THRESHOLD = 0.5
IMAGE_SIZE = 1280
TESLA_RULE_CONFIDENCE = 0.85
COARSE = {
    "car": "car",
    "tesla": "car",
    "pickup": "truck",
    "box_truck": "truck",
    "tractor_trailer": "truck",
    "truck": "truck",
    "bus": "bus",
    "motorcycle": "motorcycle",
}
COARSE_CLASSES = ["car", "truck", "bus", "motorcycle"]


@dataclass(frozen=True)
class Box:
    label: str
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float = 1.0

    @property
    def width(self) -> float:
        return self.x2 - self.x1


def read_labels(path: Path, width: int, height: int) -> list[Box]:
    """Read YOLO labels (class, centre, size as fractions) into pixel boxes."""
    boxes = []
    for line in path.read_text(encoding="utf-8").splitlines():
        class_id, x, y, w, h = line.split()
        x, y, w, h = float(x) * width, float(y) * height, float(w) * width, float(h) * height
        boxes.append(Box(CLASSES[int(class_id)], x - w / 2, y - h / 2, x + w / 2, y + h / 2))
    return boxes


def iou(a: Box, b: Box) -> float:
    overlap_w = max(0.0, min(a.x2, b.x2) - max(a.x1, b.x1))
    overlap_h = max(0.0, min(a.y2, b.y2) - max(a.y1, b.y1))
    overlap = overlap_w * overlap_h
    union = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - overlap
    return overlap / union if union > 0 else 0.0


def match(truth: list[Box], predictions: list[Box], same_label: bool) -> list[tuple[Box | None, Box | None]]:
    """Pair predictions with truth boxes, most confident first.

    Returns (truth, prediction) pairs; None on one side means a miss or a false alarm.
    """
    unmatched = list(truth)
    pairs = []
    for prediction in sorted(predictions, key=lambda p: p.confidence, reverse=True):
        candidates = [t for t in unmatched if not same_label or t.label == prediction.label]
        best = max(candidates, key=lambda t: iou(t, prediction), default=None)
        if best is not None and iou(best, prediction) >= IOU_THRESHOLD:
            unmatched.remove(best)
            pairs.append((best, prediction))
        else:
            pairs.append((None, prediction))
    pairs.extend((t, None) for t in unmatched)
    return pairs


def large_enough(boxes: list[Box]) -> list[Box]:
    return [box for box in boxes if box.width >= MIN_WIDTH_PX]


def coarse(boxes: list[Box]) -> list[Box]:
    return [Box(COARSE[b.label], b.x1, b.y1, b.x2, b.y2, b.confidence) for b in boxes]


def rates(true_pos: int, false_pos: int, false_neg: int) -> dict:
    precision = true_pos / (true_pos + false_pos) if true_pos + false_pos else None
    recall = true_pos / (true_pos + false_neg) if true_pos + false_neg else None
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision is not None and recall is not None and precision + recall
        else None
    )
    return {"true_pos": true_pos, "false_pos": false_pos, "false_neg": false_neg,
            "precision": precision, "recall": recall, "f1": f1}


def score(frames: list[tuple[list[Box], list[Box]]], classes: list[str]) -> dict:
    """Per-class and all-vehicle scores, plus how far per-frame vehicle counts are off."""
    per_class = {name: Counter() for name in classes}
    any_vehicle = Counter()
    confusion = Counter()
    count_errors = []
    for truth, predictions in frames:
        for t, p in match(truth, predictions, same_label=True):
            if t and p:
                per_class[t.label]["tp"] += 1
            elif p:
                per_class[p.label]["fp"] += 1
            else:
                per_class[t.label]["fn"] += 1
        for t, p in match(truth, predictions, same_label=False):
            any_vehicle["tp" if t and p else "fp" if p else "fn"] += 1
            confusion[(t.label if t else "no vehicle", p.label if p else "not detected")] += 1
        count_errors.append(len(predictions) - len(truth))
    return {
        "classes": {name: rates(c["tp"], c["fp"], c["fn"]) for name, c in per_class.items()},
        "any_vehicle": rates(any_vehicle["tp"], any_vehicle["fp"], any_vehicle["fn"]),
        "count_error": {
            "mean_absolute": sum(map(abs, count_errors)) / len(count_errors),
            "mean_signed": sum(count_errors) / len(count_errors),
        },
        "confusion": {f"{t} -> {p}": n for (t, p), n in sorted(confusion.items())},
    }


def tesla_rule(frames: list[tuple[list[Box], list[Box]]]) -> dict:
    """How often a single-frame Tesla call at or above the rule's confidence is right."""
    called, correct = 0, 0
    for truth, predictions in frames:
        confident = [p for p in predictions if p.label == "tesla" and p.confidence >= TESLA_RULE_CONFIDENCE]
        for t, p in match(truth, confident, same_label=False):
            if p is not None:
                called += 1
                correct += t is not None and t.label == "tesla"
    teslas = sum(t.label == "tesla" for truth, _ in frames for t in truth)
    return {"labeled_teslas": teslas, "confident_tesla_calls": called, "correct_calls": correct}


def predict(weights: Path, images: list[Path], labels: frozenset[str] | None) -> list[list[Box]]:
    from ultralytics import YOLO

    model = YOLO(str(weights))
    class_ids = [i for i, n in model.names.items() if labels is None or n in labels]
    results = []
    for image in images:
        result = model.predict(str(image), imgsz=IMAGE_SIZE, conf=MIN_CONFIDENCE,
                               classes=class_ids, verbose=False)[0]
        results.append([
            Box(result.names[int(c)], *map(float, xyxy), float(conf))
            for c, conf, xyxy in zip(result.boxes.cls, result.boxes.conf, result.boxes.xyxy)
        ])
    return results


def load_truth(dataset: Path) -> tuple[list[Path], list[list[Box]]]:
    images = sorted((dataset / "images" / "test").glob("*.jpg"))
    truth = []
    for image in images:
        height, width = cv2.imread(str(image)).shape[:2]
        truth.append(read_labels(dataset / "labels" / "test" / f"{image.stem}.txt", width, height))
    return images, truth


def evaluate(dataset: Path, pretrained: Path, tuned: Path | None) -> dict:
    images, truth = load_truth(dataset)
    truth = [large_enough(t) for t in truth]
    report = {
        "test_frames": len(images),
        "settings": {"image_size": IMAGE_SIZE, "confidence": MIN_CONFIDENCE,
                     "iou": IOU_THRESHOLD, "min_width_px": MIN_WIDTH_PX},
        "truth_boxes": dict(Counter(b.label for t in truth for b in t)),
        "models": {},
    }
    runs = [("pretrained", pretrained, PRETRAINED_VEHICLE_LABELS)]
    if tuned:
        runs.append(("tuned", tuned, None))
    for name, weights, labels in runs:
        predictions = [large_enough(p) for p in predict(weights, images, labels)]
        frames = list(zip(truth, predictions))
        result = {"weights": weights.name,
                  "coarse": score([(coarse(t), coarse(p)) for t, p in frames], COARSE_CLASSES)}
        if name == "tuned":
            result["fine"] = score(frames, CLASSES)
            result["tesla_rule"] = tesla_rule(frames)
        report["models"][name] = result
    return report


def percent(value) -> str:
    return "n/a" if value is None else f"{value:.0%}"


def markdown(report: dict) -> str:
    lines = [
        "# Detector comparison on held-out test frames", "",
        f"{report['test_frames']} human-reviewed test frames. Settings: image size "
        f"{report['settings']['image_size']}, confidence {report['settings']['confidence']}, "
        f"IoU {report['settings']['iou']}, boxes under {report['settings']['min_width_px']} px ignored.", "",
        "## Coarse classes (both models)", "",
        "| Class | Model | Precision | Recall | F1 |", "|---|---|---:|---:|---:|",
    ]
    for cls in [*COARSE_CLASSES, "any vehicle"]:
        for name, result in report["models"].items():
            r = result["coarse"]["any_vehicle" if cls == "any vehicle" else "classes"]
            r = r if cls == "any vehicle" else r[cls]
            lines.append(f"| {cls} | {name} | {percent(r['precision'])} | {percent(r['recall'])} | {percent(r['f1'])} |")
    lines += ["", "| Model | Mean count error per frame | Mean signed error |", "|---|---:|---:|"]
    for name, result in report["models"].items():
        c = result["coarse"]["count_error"]
        lines.append(f"| {name} | {c['mean_absolute']:.1f} | {c['mean_signed']:+.1f} |")
    tuned = report["models"].get("tuned")
    if tuned:
        lines += ["", "## Fine classes (tuned model)", "",
                  "| Class | Precision | Recall | F1 | Labeled |", "|---|---:|---:|---:|---:|"]
        for cls, r in tuned["fine"]["classes"].items():
            labeled = report["truth_boxes"].get(cls, 0)
            lines.append(f"| {cls} | {percent(r['precision'])} | {percent(r['recall'])} | {percent(r['f1'])} | {labeled} |")
        t = tuned["tesla_rule"]
        lines += ["", f"Tesla rule: {t['confident_tesla_calls']} single-frame Tesla calls at or above "
                  f"{TESLA_RULE_CONFIDENCE:.0%} confidence, {t['correct_calls']} correct, "
                  f"{t['labeled_teslas']} labeled Teslas."]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare detectors on the human-labeled test frames.")
    parser.add_argument("--dataset", type=Path, default=RAW_DIR / "dataset")
    parser.add_argument("--pretrained", type=Path, default=DEFAULT_WEIGHTS)
    parser.add_argument("--tuned", type=Path)
    parser.add_argument("--output", type=Path, default=REPO / "evaluation" / "model_comparison")
    args = parser.parse_args()

    report = evaluate(args.dataset, args.pretrained, args.tuned)
    args.output.with_suffix(".json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    args.output.with_suffix(".md").write_text(markdown(report), encoding="utf-8")
    print(markdown(report))


if __name__ == "__main__":
    main()
