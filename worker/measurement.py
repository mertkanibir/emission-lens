"""Pure, bounded completed-media-event to measurement-v1 snapshot bridge.

Runtime wiring and durable storage belong to the caller; MEASUREMENTS.md defines
the prepare/checkpoint/enqueue/commit ordering required with the existing Outbox.
Only version references and media evidence cross the wire, never physical approval
or worker-calculated distances/emissions.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
from typing import Iterable
from uuid import NAMESPACE_URL, uuid5

from worker.metrics import VEHICLE_CLASSES
from worker.timing import MEDIA_CLOCK_VERSION
from worker.traversal import CompletedTraversalEvidence, TraversalClock

MAX_BODY_BYTES = 1_048_576
MAX_TRAVERSALS = 1000
_SAFE_INTEGER = 2**53 - 1
_CAMERAS = frozenset({"220", "222", "223", "228"})
_MODES = frozenset({"live", "replay", "synthetic"})
_UTC = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)")
_UUID = re.compile(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")
_ROW_KEYS = {"session_id", "traversal_id", "movement_id", "entry_media_s", "exit_media_s",
             "traversal_time_s", "stopped_time_s", "vehicle_class"}
_OBS_KEYS = {"vehicle_class", "count", "stopped_vehicle_seconds", "queue_count", "coverage"}


def _json(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def _copy(value):
    return json.loads(_json(value))


def _digest(value) -> str:
    return hashlib.sha256(_json(value).encode()).hexdigest()


def _exact(value, keys, name):
    if not isinstance(value, dict) or set(value) != set(keys):
        raise ValueError(f"{name} has missing or unsupported fields.")
    return value


def _text(value, name, nullable=False):
    if nullable and value is None:
        return value
    if (not isinstance(value, str) or not value.strip()
            or len(value.encode("utf-16-le")) // 2 > 256 or any(ord(c) < 32 for c in value)):
        raise ValueError(f"{name} must be bounded nonempty text.")
    return value


def _finite(value, name, maximum=1e9, minimum=0, integer=False):
    if (isinstance(value, bool) or not isinstance(value, (int, float))
            or not minimum <= value <= maximum
            or (integer and (not isinstance(value, int) or value > _SAFE_INTEGER))):
        raise ValueError(f"{name} is outside its finite supported range.")
    return value


def _uuid(value):
    if not isinstance(value, str) or not _UUID.fullmatch(value):
        raise ValueError("Expected a UUID.")
    return value.lower()


def _utc(value, name="timestamp", minute=False):
    if not isinstance(value, str) or not _UTC.fullmatch(value):
        raise ValueError(f"{name} must be a UTC timestamp.")
    try:
        at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError(f"{name} must be a valid UTC timestamp.") from None
    if minute and (at.second or at.microsecond):
        raise ValueError("A reporting minute must be UTC-minute aligned.")
    return at


def _stamp(at):
    return at.astimezone(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def _minute(value):
    return _stamp(_utc(value, minute=True))


def _run(value):
    _exact(value, ("run_id", "model_version", "device", "started_at", "ended_at", "mode"), "run")
    _text(value["run_id"], "run_id")
    for key in ("model_version", "device"):
        _text(value[key], key, True)
    if not isinstance(value["mode"], str) or value["mode"] not in _MODES:
        raise ValueError("Unsupported run mode.")
    for key in ("started_at", "ended_at"):
        if value[key] is not None:
            _utc(value[key], key)
    if value["ended_at"] is not None and (value["started_at"] is None or _utc(value["ended_at"]) < _utc(value["started_at"])):
        raise ValueError("Run end must follow a known start.")
    return _copy(value)


def _ref(value):
    if value is None:
        return None
    _exact(value, ("batch_id", "revision"), "observation_ref")
    return {"batch_id": _uuid(value["batch_id"]), "revision": _finite(value["revision"], "revision", _SAFE_INTEGER, integer=True)}


def _observations(rows):
    if not isinstance(rows, (tuple, list)) or len(rows) > len(VEHICLE_CLASSES):
        raise ValueError("At most nine observation class rows are supported.")
    for row in rows:
        _exact(row, _OBS_KEYS, "observation")
        if not isinstance(row["vehicle_class"], str) or row["vehicle_class"] not in VEHICLE_CLASSES:
            raise ValueError("Unsupported observation class.")
        for key in ("count", "stopped_vehicle_seconds", "queue_count", "coverage"):
            if row[key] is not None:
                _finite(row[key], key, 1 if key == "coverage" else _SAFE_INTEGER,
                        integer=key in ("count", "queue_count"))
    if len({r["vehicle_class"] for r in rows}) != len(rows):
        raise ValueError("Duplicate observation class.")
    if sum(r["queue_count"] is not None for r in rows) > 1 or len({r["coverage"] for r in rows if r["coverage"] is not None}) > 1:
        raise ValueError("Queue/coverage must describe one camera-minute.")
    return _copy(sorted(rows, key=lambda row: row["vehicle_class"]))


def _media_row(row):
    _exact(row, _ROW_KEYS, "retained media traversal")
    for key in ("session_id", "traversal_id", "movement_id"):
        _text(row[key], key)
    if not isinstance(row["vehicle_class"], str) or row["vehicle_class"] not in VEHICLE_CLASSES:
        raise ValueError("Unsupported traversal class.")
    for key in ("entry_media_s", "exit_media_s", "traversal_time_s"):
        _finite(row[key], key)
    elapsed = row["exit_media_s"] - row["entry_media_s"]
    if elapsed <= 0 or row["traversal_time_s"] <= 0 or abs(elapsed - row["traversal_time_s"]) > 1e-6:
        raise ValueError("Traversal time must equal its advancing media interval.")
    if row["stopped_time_s"] is not None:
        _finite(row["stopped_time_s"], "stopped_time_s", row["traversal_time_s"])
    return _copy(row)


def _validate_batch(batch):
    _exact(batch, ("measurement_version", "batch_id", "revision", "run", "camera_id", "mode", "minute",
                   "calibration_version", "mapping_version", "units", "timing", "meteorology",
                   "observation_ref", "observations", "traversals", "retract"), "measurement")
    if batch["measurement_version"] != "1.0" or not isinstance(batch["camera_id"], str) or batch["camera_id"] not in _CAMERAS:
        raise ValueError("Unsupported measurement version/camera.")
    _uuid(batch["batch_id"])
    _finite(batch["revision"], "revision", _SAFE_INTEGER, integer=True)
    run = _run(batch["run"])
    if batch["mode"] != run["mode"]:
        raise ValueError("Measurement and run modes differ.")
    minute = _utc(batch["minute"], minute=True)
    for key in ("calibration_version", "mapping_version"):
        _text(batch[key], key, True)
    if batch["units"] != {"distance": "m", "time": "s"}:
        raise ValueError("Exact metre/second units are required.")
    timing = _exact(batch["timing"], ("basis", "clock_method", "sessions"), "timing")
    if timing["basis"] != "estimated_hls_media_utc" or timing["clock_method"] != MEDIA_CLOCK_VERSION:
        raise ValueError("Only explicit estimated HLS media timing is supported in v1.")
    if not isinstance(timing["sessions"], list) or len(timing["sessions"]) > 32:
        raise ValueError("At most 32 timing sessions per envelope.")
    anchors = {}
    for session in timing["sessions"]:
        _exact(session, ("session_id", "anchor_utc"), "session")
        identity = _text(session["session_id"], "session_id")
        if identity in anchors:
            raise ValueError("Duplicate timing session.")
        anchors[identity] = _utc(session["anchor_utc"])
    met = _exact(batch["meteorology"], ("temperature_f", "relative_humidity_pct"), "meteorology")
    _finite(met["temperature_f"], "temperature_f", 200, -200)
    _finite(met["relative_humidity_pct"], "relative_humidity_pct", 100)
    _ref(batch["observation_ref"])
    _observations(batch["observations"])
    if not isinstance(batch["traversals"], list) or len(batch["traversals"]) > MAX_TRAVERSALS:
        raise ValueError("At most 1000 completed traversals per minute; snapshots cannot be split.")
    identities = set()
    for traversal in batch["traversals"]:
        _exact(traversal, _ROW_KEYS | {"completed_at"}, "traversal")
        row = _media_row({key: traversal[key] for key in _ROW_KEYS})
        key = (row["session_id"], row["traversal_id"])
        if key in identities or row["session_id"] not in anchors:
            raise ValueError("Duplicate traversal or missing session anchor.")
        identities.add(key)
        completed = _utc(traversal["completed_at"])
        try:
            expected = anchors[row["session_id"]] + timedelta(microseconds=round(row["exit_media_s"] * 1e6))
        except OverflowError:
            raise ValueError("Completion lies outside the UTC calendar.") from None
        if abs((completed - expected).total_seconds()) > 0.000002 or not minute <= completed < minute + timedelta(minutes=1):
            raise ValueError("Completion must match its anchor and reporting minute.")
    if not isinstance(batch["retract"], bool) or (batch["retract"] and (batch["observations"] or batch["traversals"])):
        raise ValueError("A retraction needs empty observations and traversals.")
    body = (_json(batch) + "\n").encode()
    if len(body) > MAX_BODY_BYTES:
        raise ValueError("Measurement body exceeds the 1 MiB limit.")
    return _copy(batch)


def serialize_measurement_batch(batch: dict) -> bytes:
    """Validate and encode exactly the canonical body given to the Outbox."""
    return (_json(_validate_batch(batch)) + "\n").encode()


@dataclass(frozen=True)
class ObservationSnapshot:
    camera_id: str
    run_id: str
    mode: str
    minute: str
    observations: tuple[dict, ...] = ()
    observation_ref: dict | None = None

    def __post_init__(self):
        if (not isinstance(self.camera_id, str) or self.camera_id not in _CAMERAS
                or not isinstance(self.mode, str) or self.mode not in _MODES):
            raise ValueError("Unsupported observation camera/mode.")
        _text(self.run_id, "run_id")
        object.__setattr__(self, "minute", _minute(self.minute))
        object.__setattr__(self, "observations", tuple(_observations(self.observations)))
        object.__setattr__(self, "observation_ref", _copy(_ref(self.observation_ref)))


@dataclass(frozen=True)
class MeasurementPlan:
    plan_id: str
    batches: tuple[dict, ...]
    unavailable_reasons: tuple[str, ...]
    retained_events: int


class MeasurementBridge:
    def __init__(self, camera_id: str, run: dict, *, max_events: int = 10000, max_minutes: int = 240):
        if not isinstance(camera_id, str) or camera_id not in _CAMERAS:
            raise ValueError("Unsupported camera.")
        _finite(max_events, "max_events", 100000, 1, integer=True)
        _finite(max_minutes, "max_minutes", 1000, 1, integer=True)
        self.camera_id, self.max_events, self.max_minutes = camera_id, max_events, max_minutes
        self._state = {"run": _run(run), "events": {}, "observations": {}, "published": {}, "revisions": {}, "last_plan_id": None}
        self._pending = None

    def pending(self) -> MeasurementPlan | None:
        if self._pending is None:
            return None
        return MeasurementPlan(self._pending["plan_id"], tuple(_copy(self._pending["batches"])),
                               tuple(self._pending["unavailable_reasons"]), len(self._pending["next_state"]["events"]))

    def prepare(self, *, events: Iterable[CompletedTraversalEvidence] = (), clocks: Iterable[TraversalClock],
                calibration_version: str | None, mapping_version: str | None, meteorology: dict,
                observations: Iterable[ObservationSnapshot] = (), remove_observation_minutes: Iterable[str] = (),
                run: dict | None = None) -> MeasurementPlan:
        if self._pending is not None:
            raise ValueError("Finish the pending measurement plan before preparing another.")
        next_state = _copy(self._state)
        current_run = _run(run if run is not None else next_state["run"])
        self._validate_run_change(next_state["run"], current_run)
        next_state["run"] = current_run
        for key, value in (("calibration_version", calibration_version), ("mapping_version", mapping_version)):
            _text(value, key, True)
        _exact(meteorology, ("temperature_f", "relative_humidity_pct"), "meteorology")
        _finite(meteorology["temperature_f"], "temperature_f", 200, -200)
        _finite(meteorology["relative_humidity_pct"], "relative_humidity_pct", 100)
        for event in events:
            if not isinstance(event, CompletedTraversalEvidence):
                raise ValueError("Completed producer media events are required.")
            provenance = event.provenance
            if (provenance.camera_id, provenance.run_id, provenance.mode) != (self.camera_id, current_run["run_id"], current_run["mode"]):
                raise ValueError("A media event belongs to another camera/run/mode.")
            row = _media_row({"session_id": event.session_id, "traversal_id": event.traversal_id,
                              "movement_id": provenance.movement.movement_id, "entry_media_s": event.entered_media_time_s,
                              "exit_media_s": event.completed_media_time_s, "traversal_time_s": event.traversal_time_s,
                              "stopped_time_s": event.stopped_time_s, "vehicle_class": event.vehicle_class})
            key = _json([event.session_id, event.traversal_id])
            retained = {"row": row, "calibration_version": provenance.movement.calibration_version, "digest": _digest(asdict(event))}
            if key in next_state["events"] and next_state["events"][key] != retained:
                raise ValueError("A completed identity was replayed with different evidence.")
            next_state["events"][key] = retained
            if len(next_state["events"]) > self.max_events:
                raise ValueError("Retained event capacity reached; no cohort was evicted.")
        removed = {_minute(minute) for minute in remove_observation_minutes}
        for minute in removed:
            next_state["observations"].pop(minute, None)
        updated = set()
        for observation in observations:
            if not isinstance(observation, ObservationSnapshot):
                raise ValueError("Explicit ObservationSnapshots are required.")
            observation = ObservationSnapshot(**asdict(observation))
            if (observation.camera_id, observation.run_id, observation.mode) != (self.camera_id, current_run["run_id"], current_run["mode"]):
                raise ValueError("Observation camera/run/mode does not match the bridge.")
            if observation.minute in updated | removed:
                raise ValueError("Conflicting observation updates for one minute.")
            updated.add(observation.minute)
            next_state["observations"][observation.minute] = _copy(asdict(observation))
        if len(next_state["observations"]) > self.max_minutes:
            raise ValueError("Observation minute capacity reached.")
        clock_map = {}
        for clock in clocks:
            if not isinstance(clock, TraversalClock) or clock.session_id in clock_map:
                raise ValueError("Supply unique current TraversalClocks.")
            clock_map[clock.session_id] = clock
            if len(clock_map) > self.max_events:
                raise ValueError("Clock mapping capacity reached.")
        buckets, reasons = {}, set()
        for item in next_state["events"].values():
            if calibration_version is not None and item["calibration_version"] != calibration_version:
                raise ValueError("Declared calibration reference differs from producer movement evidence.")
            row = item["row"]
            clock = clock_map.get(row["session_id"])
            if clock is None:
                reasons.add("missing_session_clock")
                continue
            if clock.basis != "estimated_hls_media" or clock.version != MEDIA_CLOCK_VERSION:
                reasons.add("unsupported_session_clock")
                continue
            try:
                at = clock.anchor_utc + timedelta(microseconds=round(row["exit_media_s"] * 1e6))
            except OverflowError:
                raise ValueError("Completion lies outside the UTC calendar.") from None
            minute = _stamp(at.replace(second=0, microsecond=0))
            bucket = buckets.setdefault(minute, {"traversals": [], "sessions": {}})
            bucket["traversals"].append({**row, "completed_at": _stamp(at)})
            bucket["sessions"][row["session_id"]] = _stamp(clock.anchor_utc)
        for minute in next_state["observations"]:
            buckets.setdefault(minute, {"traversals": [], "sessions": {}})
        all_minutes = set(buckets) | next_state["revisions"].keys()
        if len(all_minutes) > self.max_minutes:
            raise ValueError("Retained minute capacity reached; no published history was forgotten.")
        desired = {}
        for minute, bucket in sorted(buckets.items()):
            observation = next_state["observations"].get(minute)
            desired[minute] = self._envelope(minute, current_run, calibration_version, mapping_version, meteorology,
                                            bucket, observation, revision=0)
        old = self._state["published"]
        changed = [minute for minute in sorted(set(old) | set(desired))
                   if self._contents(old.get(minute)) != self._contents(desired.get(minute))]
        batches = []
        for minute in changed:
            before, after = old.get(minute), desired.get(minute)
            if before is not None and (after is None or self._members(before) - self._members(after)):
                revision = self._next_revision(next_state, minute)
                batches.append(self._envelope(minute, current_run, calibration_version, mapping_version,
                                              meteorology, {"traversals": [], "sessions": {}}, None, revision, True))
        for minute in changed:
            if minute in desired:
                desired[minute]["revision"] = self._next_revision(next_state, minute)
                batches.append(desired[minute])
        for minute in set(desired) - set(changed):
            desired[minute] = _copy(old[minute])
        next_state["published"] = desired
        # Validate the entire plan before advancing any state or revision.
        batches = [_validate_batch(batch) for batch in batches]
        plan_id = _digest({"before": self._state, "after": next_state, "batches": batches, "reasons": sorted(reasons)})
        next_state["last_plan_id"] = plan_id
        self._pending = {"plan_id": plan_id, "batches": batches, "unavailable_reasons": sorted(reasons), "next_state": next_state}
        return self.pending()

    @staticmethod
    def _validate_run_change(old, new):
        immutable = ("run_id", "mode", "model_version", "started_at")
        if any(old[key] != new[key] for key in immutable):
            raise ValueError("Worker run identity/provenance is immutable.")
        if any(old[key] is not None and old[key] != new[key] for key in ("device", "ended_at")):
            raise ValueError("Established device/end time cannot change.")

    @staticmethod
    def _contents(batch):
        return None if batch is None else {k: v for k, v in batch.items() if k != "revision"}

    @staticmethod
    def _members(batch):
        return {(row["session_id"], row["traversal_id"]) for row in batch["traversals"]}

    @staticmethod
    def _next_revision(state, minute):
        revision = state["revisions"].get(minute, -1) + 1
        _finite(revision, "revision", _SAFE_INTEGER, integer=True)
        state["revisions"][minute] = revision
        return revision

    def _envelope(self, minute, run, calibration, mapping, meteorology, bucket, observation, revision, retract=False):
        return _copy({
            "measurement_version": "1.0",
            "batch_id": str(uuid5(NAMESPACE_URL, _json(["emission-lens-measurement-v1", self.camera_id, run["run_id"], run["mode"], minute]))),
            "revision": revision, "run": run, "camera_id": self.camera_id, "mode": run["mode"], "minute": minute,
            "calibration_version": calibration, "mapping_version": mapping, "units": {"distance": "m", "time": "s"},
            "timing": {"basis": "estimated_hls_media_utc", "clock_method": MEDIA_CLOCK_VERSION,
                       "sessions": [{"session_id": identity, "anchor_utc": anchor} for identity, anchor in sorted(bucket["sessions"].items())]},
            "meteorology": meteorology, "observation_ref": observation["observation_ref"] if observation else None,
            "observations": observation["observations"] if observation else [],
            "traversals": sorted(bucket["traversals"], key=lambda row: (row["completed_at"], row["session_id"], row["traversal_id"])),
            "retract": retract,
        })

    def commit(self, plan_id: str) -> None:
        if self._pending is None and plan_id == self._state["last_plan_id"] and plan_id is not None:
            return
        if self._pending is None or self._pending["plan_id"] != plan_id:
            raise ValueError("Commit must name the pending plan.")
        self._state, self._pending = self._pending["next_state"], None

    def checkpoint(self) -> dict:
        payload = {"bridge_version": "1.0", "camera_id": self.camera_id, "max_events": self.max_events,
                   "max_minutes": self.max_minutes, "state": self._state, "pending": self._pending}
        return _copy({**payload, "digest": _digest(payload)})

    @classmethod
    def restore(cls, checkpoint: dict) -> MeasurementBridge:
        _exact(checkpoint, ("bridge_version", "camera_id", "max_events", "max_minutes", "state", "pending", "digest"), "checkpoint")
        payload = {key: value for key, value in checkpoint.items() if key != "digest"}
        if checkpoint["bridge_version"] != "1.0" or checkpoint["digest"] != _digest(payload):
            raise ValueError("Invalid checkpoint version/integrity.")
        _exact(checkpoint["state"], ("run", "events", "observations", "published", "revisions", "last_plan_id"), "bridge state")
        bridge = cls(checkpoint["camera_id"], checkpoint["state"]["run"], max_events=checkpoint["max_events"], max_minutes=checkpoint["max_minutes"])
        bridge._state = bridge._validate_state(checkpoint["state"])
        if checkpoint["pending"] is not None:
            pending = _exact(checkpoint["pending"], ("plan_id", "batches", "unavailable_reasons", "next_state"), "pending plan")
            if not isinstance(pending["plan_id"], str) or not re.fullmatch("[a-f0-9]{64}", pending["plan_id"]):
                raise ValueError("Invalid pending plan identity.")
            if not isinstance(pending["batches"], list) or len(pending["batches"]) > 2 * bridge.max_minutes:
                raise ValueError("Invalid pending plan capacity.")
            for batch in pending["batches"]:
                bridge._validate_scope(_validate_batch(batch))
            bridge._validate_state(pending["next_state"])
            if pending["next_state"]["last_plan_id"] != pending["plan_id"] or not isinstance(pending["unavailable_reasons"], list):
                raise ValueError("Invalid pending continuity state.")
            for reason in pending["unavailable_reasons"]:
                _text(reason, "unavailable reason")
            bridge._pending = _copy(pending)
        return bridge

    def _validate_scope(self, batch):
        run = self._state["run"]
        if (batch["camera_id"], batch["run"]["run_id"], batch["mode"]) != (self.camera_id, run["run_id"], run["mode"]):
            raise ValueError("Checkpoint mixes camera/run/mode.")

    def _validate_state(self, state):
        _exact(state, ("run", "events", "observations", "published", "revisions", "last_plan_id"), "bridge state")
        _run(state["run"])
        self._validate_run_change(self._state["run"], state["run"])
        for key, limit in (("events", self.max_events), ("observations", self.max_minutes),
                           ("published", self.max_minutes), ("revisions", self.max_minutes)):
            if not isinstance(state[key], dict) or len(state[key]) > limit:
                raise ValueError("Checkpoint retained capacity exceeded.")
        for key, item in state["events"].items():
            _exact(item, ("row", "calibration_version", "digest"), "retained event")
            row = _media_row(item["row"])
            if key != _json([row["session_id"], row["traversal_id"]]) or not isinstance(item["digest"], str) or not re.fullmatch("[a-f0-9]{64}", item["digest"]):
                raise ValueError("Invalid retained identity.")
            _text(item["calibration_version"], "calibration_version", True)
        keys = set(state["observations"]) | set(state["published"]) | set(state["revisions"])
        if len(keys) > self.max_minutes:
            raise ValueError("Checkpoint minute capacity exceeded.")
        for minute in keys:
            if _minute(minute) != minute:
                raise ValueError("Checkpoint minute is not canonical.")
        for minute, observation in state["observations"].items():
            snapshot = ObservationSnapshot(**observation)
            if (snapshot.camera_id, snapshot.run_id, snapshot.mode, snapshot.minute) != (self.camera_id, state["run"]["run_id"], state["run"]["mode"], minute):
                raise ValueError("Checkpoint observation context differs.")
        for minute, revision in state["revisions"].items():
            _finite(revision, "revision", _SAFE_INTEGER, integer=True)
        for minute, batch in state["published"].items():
            self._validate_scope(_validate_batch(batch))
            if batch["retract"] or batch["minute"] != minute or state["revisions"].get(minute) != batch["revision"]:
                raise ValueError("Checkpoint published/revision context differs.")
        if state["last_plan_id"] is not None and (not isinstance(state["last_plan_id"], str) or not re.fullmatch("[a-f0-9]{64}", state["last_plan_id"])):
            raise ValueError("Invalid committed plan identity.")
        return _copy(state)
