"""Crossing snapshots on a session-local estimated HLS media clock.

Receipt bursts determine an anchor, not frame-minute membership. Anchors can
improve as backlog arrives, so published snapshots support explicit rebins.
Source capture UTC and physical footage coverage remain unavailable.
"""

from __future__ import annotations

from bisect import bisect_left
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import math
import uuid

from worker.metrics import MetricsConfig, VEHICLE_CLASSES
from worker.timing import MEDIA_CLOCK_VERSION, SessionMediaClock, duration_microseconds, media_microseconds


@dataclass
class _Minute:
    counts: Counter = field(default_factory=Counter)
    queue_count: int | None = None
    frames: int = 0
    latest_queue: tuple[datetime, int] | None = None


class _Session:
    """Scalar prefix sums permit rebins without retaining images or identities."""

    def __init__(self, labels):
        self.clock = SessionMediaClock()
        self.offsets: list[int] = []
        self.prefix = {label: [0] for label in labels}
        self.queues: list[int | None] = []

    def observe(self, offset: int, received_at: datetime, counts: Counter, queue: int | None):
        self.clock.observe(offset, received_at)
        self.offsets.append(offset)
        self.queues.append(queue)
        for label, values in self.prefix.items():
            values.append(values[-1] + counts[label])

    def minutes(self):
        begin_index = 0
        while begin_index < len(self.offsets):
            minute = self.clock.at(self.offsets[begin_index]).replace(second=0, microsecond=0)
            end = minute + timedelta(minutes=1)
            end_index = bisect_left(self.offsets, duration_microseconds(end - self.clock.anchor), lo=begin_index + 1)
            counts = Counter({label: values[end_index] - values[begin_index] for label, values in self.prefix.items()})
            yield minute.isoformat(), counts, end_index - begin_index, self.clock.at(self.offsets[end_index - 1]), self.queues[end_index - 1]
            begin_index = end_index


class MinuteAggregator:
    """One camera/run/mode and selected gate; rebins retain no vehicle IDs."""

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
        self._sessions: dict[int, _Session] = {}
        self._published: dict[str, list[dict]] = {}
        self._revisions: dict[str, int] = {}
        self._dirty = False
        self._last_session = 0
        self._last_media = -math.inf

    def observe(self, frame, update) -> None:
        if frame.camera_id != self.config.camera_id or update.camera_id != self.config.camera_id:
            raise ValueError("Aggregation cannot mix cameras.")
        if frame.session != update.session:
            raise ValueError("Metrics session must match the current frame.")
        if not self.enabled or not update.enabled:
            return
        if isinstance(frame.session, bool) or not isinstance(frame.session, int) or frame.session < 1:
            raise ValueError("A positive camera session is required.")
        offset = media_microseconds(frame.media_time_s)
        if frame.session < self._last_session:
            raise ValueError("Old sessions cannot replace current aggregation progress.")
        if frame.session == self._last_session and frame.media_time_s <= self._last_media:
            return
        increments = Counter()
        for event in update.crossings:
            if event.camera_id != self.config.camera_id or event.session != frame.session:
                raise ValueError("A crossing must belong to the current camera session.")
            if event.gate_id == self.count_gate_id:
                if event.vehicle_class not in self.supported_classes:
                    raise ValueError("Crossing class is not supported by the configured model.")
                increments[event.vehicle_class] += 1
        queue = update.queue_count if self.config.queue_region is not None and self.config.stopped_threshold_per_s is not None else None
        session = self._sessions.get(frame.session) or _Session(self.supported_classes)
        session.observe(offset, frame.received_at, increments, queue)
        self._sessions[frame.session] = session
        self._last_session, self._last_media = frame.session, frame.media_time_s
        self._dirty = True

    def _minutes(self) -> dict[str, _Minute]:
        result = {}
        for session_id, session in self._sessions.items():
            for minute, counts, frames, last_at, queue in session.minutes():
                state = result.setdefault(minute, _Minute())
                state.counts.update(counts)
                state.frames += frames
                # Source ordering, not burst arrival, chooses the latest queue.
                order = (last_at, session_id)
                if state.latest_queue is None or order > state.latest_queue:
                    state.queue_count, state.latest_queue = queue, order
        return result

    def _rows(self, minute: str, state: _Minute) -> list[dict]:
        return [{
            "camera_id": self.config.camera_id, "minute": minute,
            "run_id": self.run_id, "vehicle_class": label, "mode": self.mode,
            "count": state.counts[label], "completed_traversals": None,
            "stopped_vehicle_seconds": None, "traversal_time_s": None,
            "distance_m": None, "queue_count": state.queue_count if label == min(self.supported_classes) else None,
            "queue_length_m": None, "coverage": None,
        } for label in sorted(self.supported_classes)]

    def _batch(self, minute: str, rows: list[dict], run: dict) -> dict:
        revision = self._revisions.get(minute, -1) + 1
        self._revisions[minute] = revision
        return {
            "contract_version": "1.1",
            "batch_id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"emission-lens:{self.run_id}:{self.config.camera_id}:{self.mode}:{minute}")),
            "revision": revision, "run": dict(run), "statuses": [],
            "traffic": rows, "emissions": [],
        }

    def batches(self, run: dict) -> list[dict]:
        if run["run_id"] != self.run_id or run["mode"] != self.mode:
            raise ValueError("Aggregation run and mode are immutable.")
        if not self._dirty:
            return []
        desired = {minute: self._rows(minute, state) for minute, state in self._minutes().items()}
        changed = sorted(minute for minute in self._published.keys() | desired.keys() if self._published.get(minute) != desired.get(minute))
        result = []
        # Empty higher revisions truly retract the old batch from persistence.
        # Queue these BEFORE replacements so intermediate totals cannot inflate.
        for minute in changed:
            old, new = self._published.get(minute), desired.get(minute)
            if old and (new is None or any(a["count"] > b["count"] for a, b in zip(old, new))):
                result.append(self._batch(minute, [], run))
        for minute in changed:
            if minute in desired:
                result.append(self._batch(minute, desired[minute], run))
        self._published = desired
        self._dirty = False
        return result

    def diagnostic(self):
        minutes = self._minutes()
        return {
            "enabled": self.enabled, "image_geometry_version": self.config.version,
            "count_gate_id": self.count_gate_id, "minute_basis": "estimated_hls_media_utc",
            "clock_method": MEDIA_CLOCK_VERSION, "source_capture_utc_available": False,
            "supported_classes": sorted(self.supported_classes),
            "observed_minutes": len(minutes),
            "selected_gate_crossings_by_class": dict(sum((state.counts for state in minutes.values()), Counter())),
            "sessions": [{"session": session_id, "estimated_anchor_utc": session.clock.anchor.isoformat(), "observed_frames": len(session.offsets)} for session_id, session in self._sessions.items()],
            "limitations": ["Partial estimated media-time windows; minimum transport delay, source capture UTC and footage coverage are unknown.",
                            "Each reconnect has an independent anchor; overlapping source video across sessions cannot be deduplicated from capture UTC.",
                            "Count only the selected image gate; no physical calibration, stopped time or completed traversals are inferred.",
                            "An overlapping camera-minute from another run is rejected by persistence and requires review; never overwrite or merge it silently."],
        }
