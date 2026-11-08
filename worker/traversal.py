"""Conservative, internal entry-to-exit evidence from explicit observations.

No model, motion classifier, calibration fitting, clock estimation or I/O lives
here. Accepted directed-path distances and interval classifications are supplied
by the caller. See TRAVERSALS.md before integrating with a worker or publisher.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime, timedelta, timezone
import json
import math
from typing import Iterable
from uuid import NAMESPACE_URL, uuid5

from worker.metrics import VEHICLE_CLASSES
from worker.timing import media_microseconds

Point = tuple[float, float]
PRODUCER_VERSION = "completed-traversals-v1"
POLICY_VERSION = "observed-every-frame-one-segment-v1"
_EPSILON = 1e-12


def _text(value, name: str) -> str:
    if not isinstance(value, str) or not value.strip() or value != value.strip():
        raise ValueError(f"{name} must be a nonempty string without outer whitespace.")
    return value


def _number(value, name: str, minimum: float, maximum: float) -> float:
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not minimum <= value <= maximum):
        raise ValueError(f"{name} must be finite and between {minimum} and {maximum}.")
    return float(value)


def _integer(value, name: str, minimum: int = 0) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum:
        raise ValueError(f"{name} must be an integer at least {minimum}.")
    return value


def _point(value) -> Point:
    if not isinstance(value, (tuple, list)) or len(value) != 2:
        raise ValueError("A point needs two normalized coordinates.")
    return tuple(_number(v, "Point coordinate", 0, 1) for v in value)


def _minus(a: Point, b: Point) -> Point:
    return a[0] - b[0], a[1] - b[1]


def _cross(a: Point, b: Point) -> float:
    return a[0] * b[1] - a[1] * b[0]


def _fraction(a: Point, b: Point, c: Point, d: Point) -> float | None:
    """Trajectory fraction at a finite, nonparallel gate intersection."""
    r, s = _minus(b, a), _minus(d, c)
    denominator = _cross(r, s)
    if abs(denominator) <= _EPSILON:
        return None
    t = _cross(_minus(c, a), s) / denominator
    u = _cross(_minus(c, a), r) / denominator
    if -_EPSILON <= t <= 1 + _EPSILON and -_EPSILON <= u <= 1 + _EPSILON:
        return min(1.0, max(0.0, t))
    return None


def _on_gate(point: Point, gate: TraversalGate) -> bool:
    return abs(gate.signed_distance(point)) <= _EPSILON and all(
        min(a, b) - _EPSILON <= p <= max(a, b) + _EPSILON
        for p, a, b in zip(point, gate.start, gate.end)
    )


def _identity(*parts) -> str:
    return str(uuid5(NAMESPACE_URL, json.dumps(parts, separators=(",", ":"))))


@dataclass(frozen=True)
class TraversalGate:
    gate_id: str
    start: Point
    end: Point
    direction: str

    def __post_init__(self):
        _text(self.gate_id, "Gate ID")
        object.__setattr__(self, "start", _point(self.start))
        object.__setattr__(self, "end", _point(self.end))
        if math.dist(self.start, self.end) <= _EPSILON:
            raise ValueError("A finite gate needs distinct endpoints.")
        if self.direction not in ("positive", "negative"):
            raise ValueError("A traversal gate needs one explicit permitted direction.")

    def signed_distance(self, point: Point) -> float:
        return _cross(_minus(self.end, self.start), _minus(point, self.start)) / math.dist(self.start, self.end)


@dataclass(frozen=True)
class MovementDefinition:
    movement_id: str
    version: str
    view_version: str
    entry: TraversalGate
    exit: TraversalGate
    accepted: bool
    calibration_version: str | None
    calibration_status: str
    calibration_evidence: str | None
    distance_m: float | None
    distance_source: str | None

    def __post_init__(self):
        for name in ("movement_id", "version", "view_version"):
            _text(getattr(self, name), name)
        if not isinstance(self.entry, TraversalGate) or not isinstance(self.exit, TraversalGate):
            raise ValueError("Movement entry and exit must be explicit TraversalGates.")
        if (self.entry.gate_id == self.exit.gate_id
                or _fraction(self.entry.start, self.entry.end, self.exit.start, self.exit.end) is not None
                or any(_on_gate(p, g) for p, g in ((self.entry.start, self.exit), (self.entry.end, self.exit),
                                                 (self.exit.start, self.entry), (self.exit.end, self.entry)))):
            raise ValueError("Entry and exit gates must be distinct and must not touch.")
        if not isinstance(self.accepted, bool) or self.calibration_status not in ("valid", "invalid", "missing"):
            raise ValueError("Movement acceptance and calibration status must be explicit.")
        for name in ("calibration_version", "calibration_evidence", "distance_source"):
            if getattr(self, name) is not None:
                _text(getattr(self, name), name)
        if self.distance_m is not None:
            distance = _number(self.distance_m, "Accepted path distance", 0, 1e7)
            if distance <= 0:
                raise ValueError("Accepted path distance must be positive.")
            object.__setattr__(self, "distance_m", distance)

    def unavailable_reasons(self, view_version: str) -> tuple[str, ...]:
        checks = (
            (not self.accepted, "movement_unaccepted"),
            (self.view_version != view_version, "view_version_mismatch"),
            (self.calibration_status != "valid" or self.calibration_version is None
             or self.calibration_evidence is None, "calibration_unavailable"),
            (self.distance_m is None or self.distance_source is None, "distance_unavailable"),
        )
        return tuple(f"{self.movement_id}:{reason}" for failed, reason in checks if failed)


@dataclass(frozen=True)
class TraversalConfig:
    camera_id: str
    run_id: str
    mode: str
    context_version: str
    view_version: str
    movements: tuple[MovementDefinition, ...]
    max_gap_s: float
    max_traversal_s: float
    hysteresis: float
    min_track_hits: int

    def __post_init__(self):
        for name in ("camera_id", "run_id", "context_version", "view_version"):
            _text(getattr(self, name), name)
        if self.mode not in ("live", "replay", "synthetic"):
            raise ValueError("Mode must be live, replay or synthetic.")
        if not isinstance(self.movements, (tuple, list)) or not all(isinstance(m, MovementDefinition) for m in self.movements):
            raise ValueError("Movements must be explicit MovementDefinitions.")
        object.__setattr__(self, "movements", tuple(self.movements))
        if len({m.movement_id for m in self.movements}) != len(self.movements):
            raise ValueError("Movement IDs must be unique.")
        _number(self.max_gap_s, "Maximum source gap", 0.000001, 60)
        _number(self.max_traversal_s, "Maximum traversal duration", self.max_gap_s, 86400)
        _number(self.hysteresis, "Hysteresis", 0.000001, 0.1)
        _integer(self.min_track_hits, "Minimum track hits", 2)
        if any(math.dist(g.start, g.end) <= 2 * self.hysteresis for m in self.movements for g in (m.entry, m.exit)):
            raise ValueError("Gates must be longer than twice the hysteresis.")


@dataclass(frozen=True)
class TraversalObservation:
    track_id: int
    point: Point
    vehicle_class: str = "unknown"
    interval_state: str = "unavailable"
    stop_method_version: str | None = None

    def __post_init__(self):
        _integer(self.track_id, "Track ID")
        object.__setattr__(self, "point", _point(self.point))
        if not isinstance(self.vehicle_class, str):
            raise ValueError("Vehicle class must be a string; unknown labels remain unknown.")
        if self.vehicle_class not in VEHICLE_CLASSES:
            object.__setattr__(self, "vehicle_class", "unknown")
        if self.interval_state not in ("moving", "stopped", "unavailable"):
            raise ValueError("Interval state must be moving, stopped or unavailable.")
        if self.interval_state != "unavailable":
            _text(self.stop_method_version, "Known interval stop method")
        elif self.stop_method_version is not None:
            _text(self.stop_method_version, "Stop method")


@dataclass(frozen=True)
class TraversalClock:
    session_id: str
    anchor_utc: datetime
    version: str
    basis: str
    evidence_ref: str

    def __post_init__(self):
        for name in ("session_id", "version", "evidence_ref"):
            _text(getattr(self, name), name)
        if self.basis not in ("estimated_hls_media", "recording_anchor", "synthetic_anchor", "verified_capture"):
            raise ValueError("An explicit supported clock basis is required.")
        if (not isinstance(self.anchor_utc, datetime) or self.anchor_utc.tzinfo is None
                or self.anchor_utc.utcoffset() is None):
            raise ValueError("The clock anchor must be timezone aware.")
        object.__setattr__(self, "anchor_utc", self.anchor_utc.astimezone(timezone.utc))


@dataclass(frozen=True)
class StoppedInterval:
    start_media_time_s: float
    end_media_time_s: float
    method_version: str


@dataclass(frozen=True)
class _Crossing:
    gate_id: str
    direction: str
    time_us: int
    before_us: int
    after_us: int
    confirmed_us: int = 0


@dataclass(frozen=True)
class TraversalProvenance:
    camera_id: str
    run_id: str
    mode: str
    context_version: str
    view_version: str
    movement: MovementDefinition
    max_gap_s: float
    max_traversal_s: float
    hysteresis: float
    min_track_hits: int
    entry_crossing: _Crossing
    exit_crossing: _Crossing
    stop_method_version: str | None


@dataclass(frozen=True)
class CompletedTraversalEvidence:
    session_id: str
    traversal_id: str
    vehicle_class: str
    distance_m: float
    traversal_time_s: float
    stopped_time_s: float | None
    entered_media_time_s: float
    completed_media_time_s: float
    entry_confirmed_media_time_s: float
    exit_confirmed_media_time_s: float
    stopped_intervals: tuple[StoppedInterval, ...]
    provenance: TraversalProvenance

    def to_completed_traversal(self, clock: TraversalClock) -> dict:
        if not isinstance(clock, TraversalClock) or clock.session_id != self.session_id:
            raise ValueError("Clock and traversal must belong to the same session.")
        mode = self.provenance.mode
        if ((mode == "synthetic") != (clock.basis == "synthetic_anchor")
                or (clock.basis == "recording_anchor" and mode != "replay")):
            raise ValueError("Clock basis must match the traversal mode.")
        try:
            completed = clock.anchor_utc + timedelta(microseconds=media_microseconds(self.completed_media_time_s))
        except OverflowError:
            raise ValueError("Completion lies outside the UTC calendar.") from None
        return {
            "session_id": self.session_id, "traversal_id": self.traversal_id,
            "completed_at": completed.isoformat(timespec="microseconds").replace("+00:00", "Z"),
            "vehicle_class": self.vehicle_class, "distance_m": self.distance_m,
            "traversal_time_s": self.traversal_time_s, "stopped_time_s": self.stopped_time_s,
        }

    def to_record(self, clock: TraversalClock) -> dict:
        traversal = self.to_completed_traversal(clock)
        provenance = asdict(self.provenance)
        provenance.update({
            "producer_version": PRODUCER_VERSION, "policy_version": POLICY_VERSION,
            "entered_media_time_s": self.entered_media_time_s,
            "completed_media_time_s": self.completed_media_time_s,
            "entry_confirmed_media_time_s": self.entry_confirmed_media_time_s,
            "exit_confirmed_media_time_s": self.exit_confirmed_media_time_s,
            "stopped_intervals": [asdict(interval) for interval in self.stopped_intervals],
            "stopped_time_status": "complete" if self.stopped_time_s is not None else "unavailable",
            "completion_timing_basis": {
                "attribution": "interpolated_exit_crossing", "cohort": "original_completed_traversals",
                "clock_basis": clock.basis, "clock_version": clock.version,
                "clock_evidence_ref": clock.evidence_ref,
                "anchor_utc": clock.anchor_utc.isoformat().replace("+00:00", "Z"),
                "crossing_time_units": "source_media_microseconds",
            },
        })
        return {**traversal, "provenance": provenance}


@dataclass(frozen=True)
class TraversalUpdate:
    completed: tuple[CompletedTraversalEvidence, ...] = ()
    unavailable_reasons: tuple[str, ...] = ()
    issues: tuple[str, ...] = ()
    discontinuity: bool = False
    duplicate: bool = False


@dataclass
class _GateState:
    side: int = 0
    pending: _Crossing | None = None


@dataclass
class _MovementState:
    entry_gate: _GateState = field(default_factory=_GateState)
    exit_gate: _GateState = field(default_factory=_GateState)
    entry: _Crossing | None = None
    finished: bool = False


@dataclass(frozen=True)
class _Interval:
    start_us: int
    end_us: int
    state: str
    method: str | None


@dataclass
class _Track:
    point: Point
    time_us: int
    label: str
    hits: int = 1
    movements: dict[str, _MovementState] = field(default_factory=dict)
    intervals: list[_Interval] = field(default_factory=list)


class TraversalProducer:
    def __init__(self, config: TraversalConfig):
        if not isinstance(config, TraversalConfig):
            raise ValueError("A TraversalConfig is required.")
        self.config = config
        self._unavailable = tuple(reason for m in config.movements for reason in m.unavailable_reasons(config.view_version))
        if not config.movements:
            self._unavailable = ("movement_missing",)
        self._movements = tuple(m for m in config.movements if not m.unavailable_reasons(config.view_version))
        self._session: int | None = None
        self._time_us: int | None = None
        self._signature: tuple | None = None
        self._tracks: dict[int, _Track] = {}
        self._retired: set[int] = set()
        self._blocked = False

    def session_id(self, session: int) -> str:
        _integer(session, "Session")
        return _identity("traversal-session-v1", self.config.camera_id, self.config.run_id, self.config.mode, session)

    def _retire_all(self):
        self._retired.update(self._tracks)
        self._tracks.clear()

    def update(self, *, session: int, media_time_s: float,
               observations: Iterable[TraversalObservation], context_version: str,
               view_version: str) -> TraversalUpdate:
        _integer(session, "Session")
        now = media_microseconds(media_time_s)
        observations = tuple(observations)
        if not all(isinstance(o, TraversalObservation) for o in observations):
            raise ValueError("Supply explicit TraversalObservations.")
        _text(context_version, "Observed context version")
        _text(view_version, "Observed view version")
        if self._session is not None and session < self._session:
            return TraversalUpdate(unavailable_reasons=self._unavailable, issues=("stale_session",))
        if context_version != self.config.context_version or view_version != self.config.view_version:
            self._blocked = True
        if self._blocked:
            self._retire_all()
            return TraversalUpdate(unavailable_reasons=self._unavailable + ("context_or_view_changed",), discontinuity=True)
        issues = []
        discontinuity = False
        if session != self._session:
            discontinuity = self._session is not None
            if discontinuity:
                issues.append("session_changed")
            self._tracks.clear()
            self._retired.clear()
            self._session, self._time_us, self._signature = session, None, None
        signature = tuple(sorted((o.track_id, o.point, o.vehicle_class, o.interval_state, o.stop_method_version or "") for o in observations))
        if now == self._time_us:
            if signature == self._signature:
                return TraversalUpdate(unavailable_reasons=self._unavailable, duplicate=True)
            self._retire_all()
            return TraversalUpdate(unavailable_reasons=self._unavailable, issues=("conflicting_repeat",), discontinuity=True)
        if self._time_us is not None and now < self._time_us:
            self._retire_all()
            return TraversalUpdate(unavailable_reasons=self._unavailable, issues=("backwards_media_time",), discontinuity=True)
        if self._time_us is not None and now - self._time_us > round(self.config.max_gap_s * 1e6):
            self._retire_all()
            issues.append("excessive_source_gap")
            discontinuity = True
        frequencies = Counter(o.track_id for o in observations)
        missing = self._tracks.keys() - frequencies.keys()
        duplicates = {identity for identity, count in frequencies.items() if count > 1}
        if missing:
            issues.append("track_lost")
        if duplicates:
            issues.append("duplicate_track_id")
        for identity in missing | duplicates:
            self._tracks.pop(identity, None)
            self._retired.add(identity)
        completed = []
        for observation in sorted(observations, key=lambda o: o.track_id):
            if observation.track_id in self._retired:
                continue
            track = self._tracks.get(observation.track_id)
            if track is None:
                track = _Track(observation.point, now, observation.vehicle_class,
                               movements={m.movement_id: _MovementState() for m in self._movements})
                self._tracks[observation.track_id] = track
                for movement in self._movements:
                    state = track.movements[movement.movement_id]
                    self._gate(movement.entry, state.entry_gate, track, observation.point, now)
                    self._gate(movement.exit, state.exit_gate, track, observation.point, now)
                continue
            track.hits += 1
            if track.label != observation.vehicle_class:
                track.label = "unknown"
            interval = _Interval(track.time_us, now, observation.interval_state, observation.stop_method_version)
            if (track.intervals and track.intervals[-1].end_us == interval.start_us
                    and (track.intervals[-1].state, track.intervals[-1].method) == (interval.state, interval.method)):
                track.intervals[-1] = replace(track.intervals[-1], end_us=now)
            else:
                track.intervals.append(interval)
            track_completed = []
            for movement in self._movements:
                state = track.movements[movement.movement_id]
                if state.finished:
                    continue
                events = []
                for role, gate, gate_state in (("entry", movement.entry, state.entry_gate), ("exit", movement.exit, state.exit_gate)):
                    event = self._gate(gate, gate_state, track, observation.point, now)
                    if event is not None:
                        events.append((event.time_us, role, gate, event))
                for _, role, gate, event in sorted(events, key=lambda item: item[0]):
                    if state.finished:
                        break
                    if event.direction != gate.direction:
                        state.finished = True
                        issues.append("wrong_direction")
                    elif role == "entry":
                        if state.entry is not None:
                            state.finished = True
                            issues.append("reentry")
                        else:
                            state.entry = event
                    elif state.entry is None or event.time_us <= state.entry.time_us:
                        state.finished = True
                        issues.append("exit_without_ordered_entry")
                    elif event.time_us - state.entry.time_us > round(self.config.max_traversal_s * 1e6):
                        state.finished = True
                        issues.append("traversal_timeout")
                    else:
                        track_completed.append(self._complete(track, observation.track_id, movement, state.entry, event))
                        state.finished = True
                starts = [c.time_us for c in (state.entry, state.entry_gate.pending) if c is not None]
                if not state.finished and starts and now - min(starts) > round(self.config.max_traversal_s * 1e6):
                    state.finished = True
                    issues.append("traversal_timeout")
            if track_completed:
                # One selected road segment per identity: ambiguous overlapping
                # movement definitions cannot create multiple cohort members.
                for state in track.movements.values():
                    state.finished = True
                if len(track_completed) == 1:
                    completed.extend(track_completed)
                else:
                    issues.append("ambiguous_movement_completion")
            retain = [c.time_us for state in track.movements.values() if not state.finished
                      for c in (state.entry, state.entry_gate.pending) if c is not None]
            if retain:
                earliest = min(retain)
                track.intervals = [replace(i, start_us=max(i.start_us, earliest)) for i in track.intervals if i.end_us > earliest]
            else:
                track.intervals.clear()
            track.point, track.time_us = observation.point, now
        self._time_us, self._signature = now, signature
        completed.sort(key=lambda e: (e.completed_media_time_s, e.traversal_id))
        return TraversalUpdate(tuple(completed), self._unavailable, tuple(sorted(set(issues))), discontinuity)

    def _gate(self, gate: TraversalGate, state: _GateState, track: _Track,
              point: Point, now: int) -> _Crossing | None:
        distance = gate.signed_distance(point)
        raw_side = 1 if distance > _EPSILON else -1 if distance < -_EPSILON else 0
        far_side = 1 if distance >= self.config.hysteresis else -1 if distance <= -self.config.hysteresis else 0
        if state.side == 0:
            state.side = far_side
            return None
        previous_distance = gate.signed_distance(track.point)
        previous_side = 1 if previous_distance > _EPSILON else -1 if previous_distance < -_EPSILON else 0
        if raw_side == state.side:
            state.pending = None
        elif previous_side == state.side:
            fraction = _fraction(track.point, point, gate.start, gate.end)
            if fraction is not None:
                state.pending = _Crossing(gate.gate_id, "positive" if state.side < 0 else "negative",
                                          track.time_us + round(fraction * (now - track.time_us)), track.time_us, now)
        if raw_side == 0 and not _on_gate(point, gate):
            state.pending = None
        if far_side == -state.side:
            event = state.pending
            state.side, state.pending = far_side, None
            if event is not None and track.hits >= self.config.min_track_hits:
                return replace(event, confirmed_us=now)
        return None

    def _complete(self, track: _Track, track_id: int, movement: MovementDefinition,
                  entry: _Crossing, exit: _Crossing) -> CompletedTraversalEvidence:
        intervals = [replace(i, start_us=max(i.start_us, entry.time_us), end_us=min(i.end_us, exit.time_us))
                     for i in track.intervals if i.end_us > entry.time_us and i.start_us < exit.time_us]
        covered = sum(i.end_us - i.start_us for i in intervals)
        methods = {i.method for i in intervals}
        known = (covered == exit.time_us - entry.time_us and bool(intervals)
                 and all(i.state != "unavailable" for i in intervals) and len(methods) == 1)
        stops = tuple(StoppedInterval(i.start_us / 1e6, i.end_us / 1e6, i.method)
                      for i in intervals if i.state == "stopped")
        stopped_time = sum(i.end_us - i.start_us for i in intervals if i.state == "stopped") / 1e6 if known else None
        provenance = TraversalProvenance(
            self.config.camera_id, self.config.run_id, self.config.mode, self.config.context_version,
            self.config.view_version, movement, self.config.max_gap_s, self.config.max_traversal_s,
            self.config.hysteresis, self.config.min_track_hits, entry, exit,
            next(iter(methods)) if known else None,
        )
        return CompletedTraversalEvidence(
            self.session_id(self._session),
            _identity(PRODUCER_VERSION, self.session_id(self._session), self.config.context_version,
                      movement.movement_id, movement.version, track_id),
            track.label, movement.distance_m, (exit.time_us - entry.time_us) / 1e6, stopped_time,
            entry.time_us / 1e6, exit.time_us / 1e6, entry.confirmed_us / 1e6, exit.confirmed_us / 1e6,
            stops, provenance,
        )
