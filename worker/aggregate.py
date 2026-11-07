"""Receipt-minute crossing snapshots from explicitly reviewed image geometry.

Source capture UTC is unavailable. These windows describe when frames arrived,
not certified footage coverage or physically calibrated traversal measurements.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import timezone
import math
import uuid

from worker.metrics import MetricsConfig, VEHICLE_CLASSES


@dataclass
class _Minute:
    counts: Counter = field(default_factory=Counter)
    queue_count: int | None = None
    frames: int = 0
    revision: int = -1
    dirty: bool = False


class MinuteAggregator:
    """One camera/run/mode, one explicitly selected gate, no track IDs retained."""

    def __init__(self, config: MetricsConfig, run_id: str, mode: str, count_gate_id: str | None = None,
                 supported_classes=frozenset({"car", "truck", "bus", "motorcycle"})):
        if mode not in {"live", "replay", "synthetic"}:
            raise ValueError("Unknown aggregation mode.")
        if count_gate_id is None:
            if len(config.gates) != 1:
                raise ValueError("Select --count-gate-id explicitly when multiple gates exist.")
            count_gate_id = config.gates[0].id
        if count_gate_id not in {gate.id for gate in config.gates}:
            raise ValueError("Selected counting gate does not exist in measurement config.")
        self.config, self.run_id, self.mode = config, run_id, mode
        self.count_gate_id = count_gate_id
        self.supported_classes = frozenset(supported_classes)
        if not self.supported_classes or self.supported_classes - VEHICLE_CLASSES:
            raise ValueError("Explicit supported model vehicle classes are required.")
        self.enabled = config.enabled and config.image_geometry_status == "reviewed"
        self._minutes: dict[str, _Minute] = {}
        self._last_session = 0
        self._last_media = -math.inf

    def observe(self, frame, update) -> None:
        if frame.camera_id != self.config.camera_id or update.camera_id != self.config.camera_id:
            raise ValueError("Aggregation cannot mix cameras.")
        if frame.session != update.session:
            raise ValueError("Metrics session must match the current frame.")
        if not self.enabled or not update.enabled:
            return
        if frame.session < self._last_session:
            raise ValueError("Old sessions cannot replace current aggregation progress.")
        if frame.session == self._last_session and frame.media_time_s <= self._last_media:
            return
        if frame.received_at.tzinfo is None or frame.received_at.utcoffset() is None:
            raise ValueError("An aware frame receipt timestamp is required.")
        increments = Counter()
        for event in update.crossings:
            if event.camera_id != self.config.camera_id or event.session != frame.session:
                raise ValueError("A crossing must belong to the current camera session.")
            if event.gate_id == self.count_gate_id:
                if event.vehicle_class not in self.supported_classes:
                    raise ValueError("Crossing class is not supported by the configured model.")
                increments[event.vehicle_class] += 1
        self._last_session, self._last_media = frame.session, frame.media_time_s
        minute = frame.received_at.astimezone(timezone.utc).replace(second=0, microsecond=0).isoformat()
        state = self._minutes.setdefault(minute, _Minute())
        state.frames += 1
        state.dirty = True
        state.counts.update(increments)
        # A queue is a latest image-space observation, stored on one class row,
        # never summed across classes or inferred from a crossing count.
        if self.config.queue_region is not None and self.config.stopped_threshold_per_s is not None:
            state.queue_count = update.queue_count

    def batches(self, run: dict) -> list[dict]:
        if run["run_id"] != self.run_id or run["mode"] != self.mode:
            raise ValueError("Aggregation run and mode are immutable.")
        result = []
        for minute, state in sorted(self._minutes.items()):
            if not state.dirty:
                continue
            state.revision += 1
            rows = [{
                "camera_id": self.config.camera_id, "minute": minute,
                "run_id": self.run_id, "vehicle_class": label, "mode": self.mode,
                "count": state.counts[label], "completed_traversals": None,
                "stopped_vehicle_seconds": None, "traversal_time_s": None,
                "distance_m": None, "queue_count": state.queue_count if label == min(self.supported_classes) else None,
                "queue_length_m": None, "coverage": None,
            } for label in sorted(self.supported_classes)]
            result.append({
                "contract_version": "1.1",
                "batch_id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"emission-lens:{self.run_id}:{self.config.camera_id}:{self.mode}:{minute}")),
                "revision": state.revision, "run": dict(run), "statuses": [],
                "traffic": rows, "emissions": [],
            })
            state.dirty = False
        return result

    def diagnostic(self):
        return {
            "enabled": self.enabled, "image_geometry_version": self.config.version,
            "count_gate_id": self.count_gate_id, "minute_basis": "frame_receipt_utc",
            "supported_classes": sorted(self.supported_classes),
            "observed_minutes": len(self._minutes),
            "selected_gate_crossings_by_class": dict(sum((state.counts for state in self._minutes.values()), Counter())),
            "limitations": ["Partial receipt windows; source capture UTC and footage coverage unavailable.",
                            "Count only the selected image gate; no physical calibration, stopped time or completed traversals are inferred.",
                            "An overlapping camera-minute from another run is rejected by persistence and requires review; never overwrite or merge it silently."],
        }
