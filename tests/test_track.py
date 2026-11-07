from datetime import datetime, timezone
from types import SimpleNamespace

import numpy as np

from worker.detect import Detection
from worker.stream import Frame
from worker.track import CameraTracker, TrackLabeler


def detection(label, confidence=0.9):
    return Detection(label, confidence, 0, 0, 10, 10)


def frame(session):
    return Frame("222", session, 1, 0.0, datetime.now(timezone.utc), np.zeros((4, 4, 3)))


class FakeModel:
    names = {0: "person", 2: "car", 7: "truck"}

    def __init__(self, ids=(1,)):
        self.ids = ids
        self.calls = []

    def track(self, image, **kwargs):
        self.calls.append(kwargs)
        boxes = SimpleNamespace(
            id=None if self.ids is None else list(self.ids),
            cls=[2] * len(self.ids or ()),
            conf=[0.9] * len(self.ids or ()),
            xyxy=[[0, 0, 10, 10]] * len(self.ids or ()),
        )
        return [SimpleNamespace(boxes=boxes, names=self.names)]


def test_label_follows_the_most_confident_class():
    labeler = TrackLabeler()
    labeler.add(1, detection("truck", 0.4))
    labeler.add(1, detection("car", 0.9))
    assert labeler.label(1) == "car"


def test_confident_tesla_over_several_frames_is_a_tesla():
    labeler = TrackLabeler()
    for _ in range(3):
        labeler.add(1, detection("tesla", 0.9))
    assert labeler.label(1) == "tesla"


def test_tesla_below_threshold_is_a_car():
    labeler = TrackLabeler()
    for _ in range(5):
        labeler.add(1, detection("tesla", 0.8))
    assert labeler.label(1) == "car"


def test_too_few_tesla_frames_is_a_car():
    labeler = TrackLabeler()
    labeler.add(1, detection("tesla", 0.95))
    labeler.add(1, detection("tesla", 0.95))
    assert labeler.label(1) == "car"


def test_mostly_plain_car_frames_stay_a_car():
    labeler = TrackLabeler()
    for _ in range(3):
        labeler.add(1, detection("tesla", 0.9))
    for _ in range(4):
        labeler.add(1, detection("car", 0.9))
    assert labeler.label(1) == "car"


def test_tesla_votes_cannot_turn_a_truck_into_a_tesla():
    labeler = TrackLabeler()
    for _ in range(3):
        labeler.add(1, detection("tesla", 0.9))
    for _ in range(4):
        labeler.add(1, detection("box_truck", 0.9))
    assert labeler.label(1) == "box_truck"


def test_tracks_are_labeled_independently():
    labeler = TrackLabeler()
    labeler.add(1, detection("bus"))
    labeler.add(2, detection("car"))
    assert (labeler.label(1), labeler.label(2)) == ("bus", "car")


def test_tracker_keeps_state_within_a_session_and_resets_on_reconnect():
    model = FakeModel()
    tracker = CameraTracker(model=model)
    tracker.update(frame(1))
    resets = []
    model.predictor = SimpleNamespace(trackers=[SimpleNamespace(
        reset=lambda: resets.append(True), tracked_stracks=[], lost_stracks=[],
    )])
    tracker.update(frame(1))
    assert resets == []
    tracker.update(frame(2))
    assert resets == [True]
    assert [call["persist"] for call in model.calls] == [True, True, True]


def test_track_label_history_releases_expired_tracks_and_bounds_tesla_evidence():
    labeler = TrackLabeler()
    for _ in range(100):
        labeler.add(1, detection("tesla", 0.9))
    labeler.add(2, detection("bus"))
    assert labeler.label(1) == "tesla"
    assert len(labeler._tesla_evidence[1]) == 2
    labeler.retain({2})
    assert set(labeler._scores) == {2}
    assert not labeler._tesla_evidence


def test_real_bytetrack_callbacks_preserve_state_and_reset_on_reconnect():
    """Use actual CPU callbacks and synthetic boxes; no model download needed."""
    from collections import defaultdict
    import torch
    from ultralytics.engine.results import Results
    from ultralytics.trackers import register_tracker

    class SyntheticModel:
        names = {2: "car"}

        def __init__(self):
            self.callbacks = defaultdict(list)
            self.predictor = SimpleNamespace(
                args=SimpleNamespace(mode="track", task="detect", tracker="bytetrack.yaml"),
                dataset=SimpleNamespace(bs=1, mode="image"),
                device=torch.device("cpu"),
            )

        def add_callback(self, event, callback):
            self.callbacks[event].append(callback)

        def track(self, image, **kwargs):
            register_tracker(self, kwargs["persist"])
            for callback in self.callbacks["on_predict_start"]:
                callback(self.predictor)
            self.predictor.results = [Results(
                orig_img=image, path="synthetic-frame.jpg", names=self.names,
                boxes=torch.tensor([[0, 0, 10, 10, 0.9, 2]], dtype=torch.float32),
            )]
            for callback in self.callbacks["on_predict_postprocess_end"]:
                callback(self.predictor)
            return self.predictor.results

    model = SyntheticModel()
    tracker = CameraTracker(model=model)
    assert [v.track_id for v in tracker.update(frame(1))] == [1]
    actual_tracker = model.predictor.trackers[0]
    assert actual_tracker.frame_id == 1
    assert [v.track_id for v in tracker.update(frame(1))] == [1]
    assert model.predictor.trackers[0] is actual_tracker
    assert actual_tracker.frame_id == 2
    assert [v.track_id for v in tracker.update(frame(2))] == [1]
    assert model.predictor.trackers[0] is actual_tracker
    assert actual_tracker.frame_id == 1
    assert len(model.callbacks["on_predict_start"]) == 1


def test_tracker_only_asks_for_vehicle_classes():
    model = FakeModel()
    CameraTracker(model=model).update(frame(1))
    assert model.calls[0]["classes"] == [2, 7]


def test_tracker_returns_vehicles_with_ids_and_labels():
    vehicles = CameraTracker(model=FakeModel(ids=(4, 9))).update(frame(1))
    assert [(v.track_id, v.label) for v in vehicles] == [(4, "car"), (9, "car")]


def test_tracker_handles_a_frame_with_no_tracks():
    assert CameraTracker(model=FakeModel(ids=None)).update(frame(1)) == []


def test_draw_leaves_the_original_frame_untouched():
    from worker.live_view import draw
    from worker.track import TrackedVehicle

    image = np.zeros((50, 80, 3), dtype=np.uint8)
    canvas = draw(image, [TrackedVehicle(3, detection("car"), "car")], "LIVE test")
    assert image.sum() == 0
    assert canvas.sum() > 0


def test_rate_meter_counts_frames_in_its_window():
    from worker.live_view import RateMeter

    meter = RateMeter(window_s=2.0)
    rates = [meter.tick(t * 0.5) for t in range(9)]  # Two frames per second.
    assert rates[-1] == 2.0
