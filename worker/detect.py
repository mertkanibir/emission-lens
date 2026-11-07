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


class Detector:
    def __init__(
        self,
        weights: Path = DEFAULT_WEIGHTS,
        labels: frozenset[str] = PRETRAINED_VEHICLE_LABELS,
        min_confidence: float = MIN_CONFIDENCE,
    ):
        weights.parent.mkdir(parents=True, exist_ok=True)
        self._model = YOLO(str(weights))
        self._class_ids = [i for i, name in self._model.names.items() if name in labels]
        self._min_confidence = min_confidence

    def detect(self, image: np.ndarray) -> list[Detection]:
        result = self._model.predict(
            image,
            imgsz=IMAGE_SIZE,
            conf=self._min_confidence,
            classes=self._class_ids,
            verbose=False,
        )[0]
        return [
            Detection(result.names[int(class_id)], float(confidence), *map(float, box))
            for class_id, confidence, box in zip(
                result.boxes.cls, result.boxes.conf, result.boxes.xyxy
            )
        ]
