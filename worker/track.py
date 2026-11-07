"""Follow each vehicle across frames from one camera, and settle its class.

Each camera gets its own tracker, so IDs never cross between cameras. IDs also
restart after a reconnect, because the video before and after is not continuous.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from worker.detect import (
    DEFAULT_WEIGHTS,
    IMAGE_SIZE,
    PRETRAINED_VEHICLE_LABELS,
    Detection,
    class_ids_for,
    detections_from,
    load_model,
)
from worker.stream import Frame

# ByteTrack's second pass matches weak boxes to existing tracks, which needs
# detections below its 0.25 threshold for starting new tracks.
TRACKING_MIN_CONFIDENCE = 0.1
TESLA = "tesla"
FALLBACK_FOR_TESLA = "car"
TESLA_MIN_CONFIDENCE = 0.85
TESLA_MIN_FRAMES = 3


@dataclass(frozen=True)
class TrackedVehicle:
    track_id: int
    detection: Detection
    label: str  # The track's settled class, which can differ from this frame's guess.


class TrackLabeler:
    """Decide one class per track from all of its frames.

    A Tesla needs several confident frames. Anything less is reported as a car,
    so the system never claims an electric vehicle it cannot support.
    """

    def __init__(self):
        self._scores: dict[int, Counter] = defaultdict(Counter)
        # Keep exact lifetime count/sum rather than one value per frame.
        self._tesla_evidence: dict[int, list[float]] = defaultdict(lambda: [0, 0.0])

    def add(self, track_id: int, detection: Detection) -> str:
        if detection.label == TESLA:
            self._tesla_evidence[track_id][0] += 1
            self._tesla_evidence[track_id][1] += detection.confidence
            self._scores[track_id][FALLBACK_FOR_TESLA] += detection.confidence
        else:
            self._scores[track_id][detection.label] += detection.confidence
        return self.label(track_id)

    def label(self, track_id: int) -> str:
        tesla_frames, tesla_score = self._tesla_evidence.get(track_id, (0, 0.0))
        majority, majority_score = self._scores[track_id].most_common(1)[0]
        if (
            majority == FALLBACK_FOR_TESLA
            and tesla_frames >= TESLA_MIN_FRAMES
            and tesla_score / tesla_frames >= TESLA_MIN_CONFIDENCE
            and tesla_score > majority_score / 2
        ):
            return TESLA
        return majority

    def reset(self) -> None:
        self._scores.clear()
        self._tesla_evidence.clear()

    def retain(self, track_ids: set[int]) -> None:
        """Retain class history while ByteTrack can still recover the track."""
        for mapping in (self._scores, self._tesla_evidence):
            for track_id in set(mapping) - track_ids:
                del mapping[track_id]


class CameraTracker:
    """Detect and track vehicles for one camera."""

    def __init__(
        self,
        weights: Path = DEFAULT_WEIGHTS,
        labels: frozenset[str] = PRETRAINED_VEHICLE_LABELS,
        image_size: int = IMAGE_SIZE,
        model=None,
    ):
        self._model = model or load_model(weights)
        self._class_ids = class_ids_for(self._model, labels)
        self._image_size = image_size
        self._labeler = TrackLabeler()
        self._session: int | None = None

    def update(self, frame: Frame) -> list[TrackedVehicle]:
        new_session = frame.session != self._session
        if new_session:
            self._labeler.reset()
            # Always persist frame-to-frame and explicitly clear state at a
            # media discontinuity. This does not depend on whether a library
            # version refreshes its registered callback's persist argument.
            predictor = getattr(self._model, "predictor", None)
            for tracker in getattr(predictor, "trackers", ()):
                tracker.reset()
            self._session = frame.session

        result = self._model.track(
            frame.image,
            persist=True,
            tracker="bytetrack.yaml",
            imgsz=self._image_size,
            conf=TRACKING_MIN_CONFIDENCE,
            classes=self._class_ids,
            verbose=False,
        )[0]
        predictor = getattr(self._model, "predictor", None)
        trackers = getattr(predictor, "trackers", ())
        if trackers:
            recoverable = {
                int(track.track_id)
                for tracker in trackers
                for track in (*tracker.tracked_stracks, *tracker.lost_stracks)
            }
            self._labeler.retain(recoverable)
        if result.boxes.id is None:  # No confirmed tracks in this frame.
            return []

        vehicles = []
        for track_id, detection in zip(result.boxes.id, detections_from(result)):
            track_id = int(track_id)
            label = self._labeler.add(track_id, detection)
            vehicles.append(TrackedVehicle(track_id, detection, label))
        return vehicles
