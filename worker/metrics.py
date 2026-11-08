"""Configured image-space vehicle crossings and stopped observations.

No camera geometry is enabled by default. Coordinates and motion thresholds are
normalized image quantities, never metres, physical speed, or engine idling.
Temporary identities remain inside the worker and must not be published.
"""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass, field

Point = tuple[float, float]
VEHICLE_CLASSES = frozenset({"car", "tesla", "pickup", "truck", "box_truck", "tractor_trailer", "bus", "motorcycle", "unknown"})
EPSILON = 1e-10


def _cross(a: Point, b: Point) -> float:
    return a[0] * b[1] - a[1] * b[0]


def _minus(a: Point, b: Point) -> Point:
    return a[0] - b[0], a[1] - b[1]


def _on_segment(point: Point, a: Point, b: Point) -> bool:
    return abs(_cross(_minus(point, a), _minus(b, a))) < EPSILON and (
        min(a[0], b[0]) - EPSILON <= point[0] <= max(a[0], b[0]) + EPSILON
        and min(a[1], b[1]) - EPSILON <= point[1] <= max(a[1], b[1]) + EPSILON
    )


def segment_intersection(a: Point, b: Point, c: Point, d: Point) -> Point | None:
    """Finite non-collinear segments, including endpoints; parallel touches do not cross."""
    r, s = _minus(b, a), _minus(d, c)
    denominator = _cross(r, s)
    if abs(denominator) <= EPSILON:
        return None
    t = _cross(_minus(c, a), s) / denominator
    u = _cross(_minus(c, a), r) / denominator
    if -EPSILON <= t <= 1 + EPSILON and -EPSILON <= u <= 1 + EPSILON:
        return a[0] + t * r[0], a[1] + t * r[1]
    return None


def point_in_polygon(point: Point, polygon: tuple[Point, ...]) -> bool:
    """Boundary-inclusive ray casting for an already validated simple polygon."""
    inside = False
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        if _on_segment(point, a, b):
            return True
        if (a[1] > point[1]) != (b[1] > point[1]):
            intersection_x = a[0] + (point[1] - a[1]) * (b[0] - a[0]) / (b[1] - a[1])
            if point[0] < intersection_x:
                inside = not inside
    return inside


def _finite(value, name: str, minimum: float, maximum: float, strictly_positive=False) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be finite.")
    if not minimum <= value <= maximum or (strictly_positive and value <= 0):
        raise ValueError(f"{name} is outside its supported range.")
    return float(value)


def _point(raw, name: str) -> Point:
    if not isinstance(raw, (list, tuple)) or len(raw) != 2:
        raise ValueError(f"{name} needs two normalized coordinates.")
    return _finite(raw[0], name, 0, 1), _finite(raw[1], name, 0, 1)


def _polygon(raw, name: str) -> tuple[Point, ...]:
    if not isinstance(raw, (list, tuple)) or not 3 <= len(raw) <= 65:
        raise ValueError(f"{name} needs 3–64 polygon vertices.")
    points = tuple(_point(value, name) for value in raw)
    if points[-1] == points[0]:
        points = points[:-1]
    if len(points) < 3 or len(points) > 64 or len(set(points)) != len(points):
        raise ValueError(f"{name} has duplicate or too few vertices.")
    area = abs(sum(_cross(a, b) for a, b in zip(points, points[1:] + points[:1]))) / 2
    if area < 1e-6:
        raise ValueError(f"{name} must have nonzero image area.")
    edges = list(zip(points, points[1:] + points[:1]))
    for index, (a, b) in enumerate(edges):
        for other, (c, d) in enumerate(edges):
            if other <= index or other == index + 1 or (index == 0 and other == len(edges) - 1):
                continue
            if segment_intersection(a, b, c, d) is not None or any(_on_segment(p, x, y) for p, x, y in ((a, c, d), (b, c, d), (c, a, b), (d, a, b))):
                raise ValueError(f"{name} must be a simple polygon without crossing edges.")
    return points


@dataclass(frozen=True)
class Gate:
    id: str
    start: Point
    end: Point
    direction: str = "both"

    def signed_distance(self, point: Point) -> float:
        vector = _minus(self.end, self.start)
        return _cross(vector, _minus(point, self.start)) / math.hypot(*vector)


@dataclass(frozen=True)
class MetricsConfig:
    camera_id: str
    version: str
    enabled: bool
    image_geometry_status: str
    road_region: tuple[Point, ...]
    excluded_regions: tuple[tuple[Point, ...], ...]
    gates: tuple[Gate, ...]
    min_track_hits: int = 3
    hysteresis: float = 0.01
    max_gap_s: float = 1.0
    stopped_threshold_per_s: float | None = None
    stopped_min_duration_s: float = 3.0
    queue_region: tuple[Point, ...] | None = None

    @classmethod
    def from_dict(cls, raw: dict) -> MetricsConfig:
        required = {"camera_id", "version", "enabled", "image_geometry_status", "road_region", "excluded_regions", "gates"}
        optional = {"min_track_hits", "hysteresis", "max_gap_s", "stopped_threshold_per_s", "stopped_min_duration_s", "queue_region"}
        if not isinstance(raw, dict) or required - raw.keys() or raw.keys() - required - optional:
            raise ValueError("Measurement config has missing or unsupported fields.")
        if not isinstance(raw["camera_id"], str) or not re.fullmatch(r"[0-9]{1,32}", raw["camera_id"]):
            raise ValueError("camera_id must be a numeric camera identifier.")
        if not isinstance(raw["version"], str) or not re.fullmatch(r"[A-Za-z0-9._-]{1,128}", raw["version"]):
            raise ValueError("A stable measurement version is required.")
        if not isinstance(raw["enabled"], bool) or raw["image_geometry_status"] not in ("reviewed", "unvalidated"):
            raise ValueError("Use a boolean enabled flag and reviewed/unvalidated image_geometry_status.")
        if raw["enabled"] and raw["image_geometry_status"] != "reviewed":
            raise ValueError("Image geometry must be reviewed before enabling metrics.")
        region = _polygon(raw["road_region"], "road_region")
        if not isinstance(raw["excluded_regions"], list) or len(raw["excluded_regions"]) > 16:
            raise ValueError("excluded_regions must be a list of at most 16 polygons.")
        exclusions = tuple(_polygon(value, "excluded_region") for value in raw["excluded_regions"])
        hysteresis = _finite(raw.get("hysteresis", 0.01), "hysteresis", 0, 0.1, True)
        hits = raw.get("min_track_hits", 3)
        if isinstance(hits, bool) or not isinstance(hits, int) or not 2 <= hits <= 100:
            raise ValueError("min_track_hits must be an integer from 2 to 100.")
        if not isinstance(raw["gates"], list) or not 1 <= len(raw["gates"]) <= 8:
            raise ValueError("Configure 1–8 finite counting gates.")
        gates = []
        for value in raw["gates"]:
            if not isinstance(value, dict) or set(value) != {"id", "start", "end", "direction"}:
                raise ValueError("Each gate needs id, start, end and direction.")
            if not isinstance(value["id"], str) or not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", value["id"]):
                raise ValueError("Gate id must be a stable short identifier.")
            if value["direction"] not in ("both", "positive", "negative"):
                raise ValueError("Gate direction must be both, positive or negative.")
            gate = Gate(value["id"], _point(value["start"], "gate start"), _point(value["end"], "gate end"), value["direction"])
            if math.dist(gate.start, gate.end) <= max(0.001, 2 * hysteresis):
                raise ValueError("A gate must be longer than the hysteresis band.")
            if not all(point_in_polygon(point, region) for point in (gate.start, gate.end)):
                raise ValueError("Gate endpoints must be inside the road region.")
            gates.append(gate)
        if len({gate.id for gate in gates}) != len(gates):
            raise ValueError("Gate ids must be unique.")
        threshold = raw.get("stopped_threshold_per_s")
        if threshold is not None:
            threshold = _finite(threshold, "stopped_threshold_per_s", 0, 1)
        queue = None if raw.get("queue_region") is None else _polygon(raw["queue_region"], "queue_region")
        if queue is not None and threshold is None:
            raise ValueError("A queue region needs an explicit image motion threshold.")
        if queue is not None and not all(point_in_polygon(point, region) for point in queue):
            raise ValueError("The queue region must be inside the road region.")
        return cls(raw["camera_id"], raw["version"], raw["enabled"], raw["image_geometry_status"], region, exclusions,
                   tuple(gates), hits, hysteresis,
                   _finite(raw.get("max_gap_s", 1.0), "max_gap_s", 0, 60, True), threshold,
                   _finite(raw.get("stopped_min_duration_s", 3.0), "stopped_min_duration_s", 0, 600, True), queue)


@dataclass(frozen=True)
class CrossingEvent:
    camera_id: str
    session: int
    track_id: int  # Ephemeral; aggregate then discard, never publish this identity.
    gate_id: str
    direction: str
    vehicle_class: str
    media_time_s: float


@dataclass(frozen=True)
class MetricsUpdate:
    """Image observations; positive queue counts are visible lower bounds.

    A positive queue count is not a complete inventory of an occluded region.
    Zero still requires no unresolved missing queue identities.
    """

    camera_id: str
    session: int
    enabled: bool
    crossings: tuple[CrossingEvent, ...]
    counts_by_class: dict[str, int] | None
    queue_count: int | None
    stopped_seconds_delta_by_class: dict[str, float] | None
    discontinuity: bool
    skipped_detections: int = 0


@dataclass
class _GateState:
    stable_side: int = 0
    pending_direction: int = 0


@dataclass
class _TrackState:
    point: Point
    media_time_s: float
    first_media_time_s: float
    hits: int = 1
    stationary_s: float = 0.0
    stopped: bool = False
    gates: dict[str, _GateState] = field(default_factory=dict)


class CameraMetrics:
    """One camera's session-local image metrics, with no road-plane claims."""

    def __init__(self, config: MetricsConfig):
        self.config = config
        self._session: int | None = None
        self._last_media: float | None = None
        self._tracks: dict[int, _TrackState] = {}
        self._counted: set[tuple[int, str, str]] = set()
        self._counts = Counter()
        self._queue_missing: set[int] = set()
        self._queue_observed_since: float | None = None

    def _inside_road(self, point: Point) -> bool:
        return point_in_polygon(point, self.config.road_region) and not any(point_in_polygon(point, region) for region in self.config.excluded_regions)

    def _reset(self, session: int) -> None:
        self._session, self._last_media = session, None
        self._tracks.clear()
        self._counted.clear()
        self._counts.clear()
        self._queue_missing.clear()
        self._queue_observed_since = None

    def _result(self, events=(), queue=None, stopped=None, discontinuity=False, skipped=0) -> MetricsUpdate:
        active = self.config.enabled and self.config.image_geometry_status == "reviewed"
        return MetricsUpdate(self.config.camera_id, self._session, active, tuple(events),
                             {name: self._counts[name] for name in sorted(VEHICLE_CLASSES)} if active else None,
                             queue, stopped, discontinuity, skipped)

    def update(self, frame, vehicles) -> MetricsUpdate:
        if frame.camera_id != self.config.camera_id:
            raise ValueError("A metrics instance cannot process another camera.")
        vehicles = tuple(vehicles)
        identities = [vehicle.track_id for vehicle in vehicles]
        if any(isinstance(identity, bool) or not isinstance(identity, int) or identity < 0 for identity in identities):
            raise ValueError("Tracked vehicles need a nonnegative integer identity.")
        if len(set(identities)) != len(identities):
            raise ValueError("A track may appear only once in a frame.")
        if isinstance(frame.session, bool) or not isinstance(frame.session, int) or frame.session < 1:
            raise ValueError("A positive reader session is required.")
        media = _finite(frame.media_time_s, "media_time_s", 0, 10**12)
        if self._session is not None and frame.session < self._session:
            raise ValueError("An old reader session cannot replace the current session.")
        new_session = frame.session != self._session
        if new_session:
            self._reset(frame.session)
        if not self.config.enabled or self.config.image_geometry_status != "reviewed":
            return self._result(discontinuity=new_session)
        if self._last_media is not None and media <= self._last_media:
            # Repeated/frozen source frames never add crossings or stopped seconds.
            return self._result(stopped={} if self.config.stopped_threshold_per_s is not None else None, discontinuity=True)
        discontinuity = new_session or (self._last_media is not None and media - self._last_media > self.config.max_gap_s)
        prior_queue = {
            track_id for track_id, state in self._tracks.items()
            if self.config.queue_region is not None and point_in_polygon(state.point, self.config.queue_region)
        }
        if discontinuity:
            self._queue_missing.update(prior_queue)
            self._queue_observed_since = media
            self._tracks.clear()  # Deduplication survives footage gaps within this session.
        self._last_media = media
        self._tracks = {key: state for key, state in self._tracks.items() if media - state.media_time_s <= self.config.max_gap_s}
        height, width = frame.image.shape[:2]
        if height <= 0 or width <= 0:
            raise ValueError("Frame dimensions must be positive.")
        events, seen = [], set()
        stopped_deltas = {} if self.config.stopped_threshold_per_s is not None else None
        queue_count = 0 if self.config.queue_region is not None else None
        queue_unknown = self.config.queue_region is not None and (
            discontinuity or self._queue_observed_since is None
            or media - self._queue_observed_since < self.config.stopped_min_duration_s
        )
        skipped = 0
        for vehicle in vehicles:
            track_id, label = vehicle.track_id, vehicle.label
            d = vehicle.detection
            coordinates = (d.x1, d.y1, d.x2, d.y2)
            if label not in VEHICLE_CLASSES or any(not math.isfinite(value) for value in coordinates) or not (0 <= d.x1 < d.x2 <= width and 0 <= d.y1 < d.y2 <= height):
                self._tracks.pop(track_id, None)
                skipped += 1
                if self.config.queue_region is not None:
                    queue_unknown = True
                continue
            point = ((d.x1 + d.x2) / (2 * width), d.y2 / height)
            seen.add(track_id)
            # Re-observation is required to resolve an occluded queue identity;
            # time passing alone does not prove it left the image region.
            self._queue_missing.discard(track_id)
            if not self._inside_road(point):
                self._tracks.pop(track_id, None)
                continue
            prior = self._tracks.get(track_id)
            if prior is None:
                state = _TrackState(point, media, media)
            else:
                state = prior
                state.hits += 1
                dt = media - state.media_time_s
                if stopped_deltas is not None:
                    speed = math.dist(point, state.point) / dt
                    was_stopped = state.stopped
                    state.stationary_s = state.stationary_s + dt if speed <= self.config.stopped_threshold_per_s else 0.0
                    state.stopped = state.stationary_s >= self.config.stopped_min_duration_s and state.hits >= self.config.min_track_hits
                    # No retrospective credit across the initial qualifying interval.
                    if state.stopped and was_stopped:
                        stopped_deltas[label] = stopped_deltas.get(label, 0.0) + dt
            for gate in self.config.gates:
                gate_state = state.gates.setdefault(gate.id, _GateState())
                distance = gate.signed_distance(point)
                side = 1 if distance > self.config.hysteresis else -1 if distance < -self.config.hysteresis else 0
                if prior is not None:
                    crossing_point = segment_intersection(state.point, point, gate.start, gate.end)
                    if crossing_point is not None and self._inside_road(crossing_point) and abs(distance) > EPSILON:
                        # A touch alone is insufficient: a later segment must
                        # actually depart the finite gate onto the other side.
                        gate_state.pending_direction = 1 if distance > 0 else -1
                if side:
                    if gate_state.stable_side and side != gate_state.stable_side:
                        direction = "positive" if side > 0 else "negative"
                        key = (track_id, gate.id, direction)
                        if gate_state.pending_direction == side and state.hits >= self.config.min_track_hits and key not in self._counted and gate.direction in ("both", direction):
                            self._counted.add(key)
                            self._counts[label] += 1
                            events.append(CrossingEvent(frame.camera_id, frame.session, track_id, gate.id, direction, label, media))
                    gate_state.stable_side = side
                    gate_state.pending_direction = 0
            state.point, state.media_time_s = point, media
            self._tracks[track_id] = state
            if self.config.queue_region is not None and point_in_polygon(point, self.config.queue_region):
                if media - state.first_media_time_s < self.config.stopped_min_duration_s or state.hits < self.config.min_track_hits:
                    queue_unknown = True
                elif state.stopped:
                    queue_count += 1
        if self.config.queue_region is not None:
            missing = prior_queue - seen
            self._queue_missing.update(missing)
            for track_id in missing:
                if track_id in self._tracks:
                    state = self._tracks[track_id]
                    state.stationary_s, state.stopped = 0.0, False
                    state.first_media_time_s = media
            # Retain missing evidence beyond the motion-history expiry. Neither
            # a timeout nor a source gap is a visibly observed empty queue.
            # Current qualified stops nevertheless support a positive visible
            # lower bound. Historical loss alone cannot erase that evidence;
            # every current-frame qualification/visibility blocker still wins.
            queue_unknown = queue_unknown or (bool(self._queue_missing) and queue_count == 0)
        return self._result(events, None if queue_unknown else queue_count, stopped_deltas, discontinuity, skipped)
