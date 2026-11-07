"""Find vehicles in a frame with YOLO."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from ultralytics import YOLO

DEFAULT_WEIGHTS = Path(__file__).resolve().parents[1] / "weights" / "yolo11s.pt"
IMAGE_SIZE = 1280  # Full camera width, because distant vehicles are only a few dozen pixels.
MIN_CONFIDENCE = 0.25
PRETRAINED_VEHICLE_LABELS = frozenset({"car", "motorcycle", "bus", "truck"})


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    x1: float
    y1: float
    x2: float
    y2: float


def load_model(weights: Path = DEFAULT_WEIGHTS) -> YOLO:
    weights.parent.mkdir(parents=True, exist_ok=True)
    return YOLO(str(weights))


def class_ids_for(model, labels: frozenset[str]) -> list[int]:
    return [i for i, name in model.names.items() if name in labels]


def detections_from(result) -> list[Detection]:
    """Convert one Ultralytics result into plain detections."""
    return [
        Detection(result.names[int(class_id)], float(confidence), *map(float, box))
        for class_id, confidence, box in zip(
            result.boxes.cls, result.boxes.conf, result.boxes.xyxy
        )
    ]


class Detector:
    def __init__(
        self,
        weights: Path = DEFAULT_WEIGHTS,
        labels: frozenset[str] = PRETRAINED_VEHICLE_LABELS,
        min_confidence: float = MIN_CONFIDENCE,
        image_size: int = IMAGE_SIZE,
    ):
        self._model = load_model(weights)
        self._class_ids = class_ids_for(self._model, labels)
        self._min_confidence = min_confidence
        self._image_size = image_size

    def detect(self, image: np.ndarray) -> list[Detection]:
        result = self._model.predict(
            image,
            imgsz=self._image_size,
            conf=self._min_confidence,
            classes=self._class_ids,
            verbose=False,
        )[0]
        return detections_from(result)
