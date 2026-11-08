"""Deliver aggregate-only worker batches with a bounded, restartable outbox.

The outbox contains no credentials or frames. Each request keeps its batch ID
across retries so an interrupted HTTP response cannot duplicate observations.
"""

import json
import os
import tempfile
import threading
from contextlib import contextmanager, nullcontext
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

_WINDOWS = os.name == "nt"


class PublishError(RuntimeError):
    """Delivery failed without exposing endpoint or credential details."""


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        # A misconfigured endpoint must never forward a bearer token elsewhere.
        return None


def _sync_directory(directory):
    # The Windows CRT rejects directory opens. Its publication path below uses
    # a write-through native move instead; real POSIX sync failures still fail.
    if _WINDOWS:
        return
    descriptor = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _windows_replace(source, destination):
    """Same-volume replacement with native write-through, using closed files."""
    import ctypes
    from ctypes import wintypes

    move = ctypes.WinDLL("kernel32", use_last_error=True).MoveFileExW
    move.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.DWORD]
    move.restype = wintypes.BOOL
    # No COPY_ALLOWED fallback: source and destination must stay on one volume.
    if not move(os.fsdecode(source), os.fsdecode(destination), 0x1 | 0x8):
        raise ctypes.WinError(ctypes.get_last_error())


def _replace_file(source, destination):
    if _WINDOWS:
        _windows_replace(source, destination)
    else:
        os.replace(source, destination)
        _sync_directory(Path(destination).parent)


def _remove_acknowledged(path):
    if _WINDOWS:
        # Retire the HTTP name with write-through before deleting it. A crash
        # or denied cleanup leaves a private marker, never a resendable batch.
        acknowledged = path.with_suffix(".acked")
        _replace_file(path, acknowledged)
        acknowledged.unlink()
    else:
        path.unlink()
        _sync_directory(path.parent)


class HttpSender:
    def __init__(self, url: str, token: str, timeout_s: float = 3.0):
        parsed = urlsplit(url)
        if parsed.username or parsed.password or parsed.fragment:
            raise ValueError("The ingest endpoint must not contain credentials or fragments.")
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("The ingest endpoint must be an HTTP(S) URL.")
        if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            if os.environ.get("EMISSION_LENS_ALLOW_HTTP") != "1":
                raise ValueError("Use HTTPS or a loopback tunnel; private HTTP requires EMISSION_LENS_ALLOW_HTTP=1.")
        if not token or "\n" in token or "\r" in token:
            raise ValueError("A nonempty worker token is required.")
        self._url = url
        self._token = token
        self._timeout_s = timeout_s
        self._opener = build_opener(_NoRedirect())

    def __call__(self, body: bytes) -> bool:
        request = Request(
            self._url,
            data=body,
            headers={"Authorization": "Bearer " + self._token, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with self._opener.open(request, timeout=self._timeout_s) as response:
                return 200 <= response.status < 300
        except HTTPError as error:
            if error.code in {408, 425, 429} or error.code >= 500:
                return False
            raise PublishError(f"Worker batch rejected with HTTP {error.code}; queued batch retained.") from None
        except (URLError, TimeoutError, OSError):
            return False


class Outbox:
    """One runtime owns an outbox directory; disk capacity fails closed."""

    def __init__(self, directory: Path, sender, max_batches: int = 256, max_bytes: int = 8_000_000):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.sender = sender
        self.max_batches = max_batches
        self.max_bytes = max_bytes
        self.delivered = 0
        self.attempts = 0
        self._queue_lock = threading.RLock()
        self._flush_lock = threading.Lock()
        self._delivery_ready = True

    def pending(self) -> list[Path]:
        with self._queue_lock:
            return sorted(self.directory.glob("*.json"))

    @contextmanager
    def publication(self):
        """Withhold new HTTP leases until a complete checkpoint is committed.

        A failed publication stays blocked in this process. Recovery must finish
        the retained plan/checkpoint before delivery can resume. An older request
        already in flight owns only its previously committed immutable body.
        """
        with self._queue_lock:
            self._delivery_ready = False
            yield
            self._delivery_ready = True

    def enqueue(self, envelope: dict) -> None:
        with self._queue_lock:
            self._enqueue(envelope)

    def _enqueue(self, envelope: dict) -> None:
        # JSON encoding also rejects NaN/Infinity before anything reaches disk.
        body = (json.dumps(envelope, allow_nan=False, separators=(",", ":")) + "\n").encode()
        batch_id = envelope["batch_id"]
        if not isinstance(batch_id, str) or any(c not in "0123456789abcdef-" for c in batch_id) or len(batch_id) != 36:
            raise ValueError("Expected a UUID batch ID.")
        revision = envelope.get("revision")
        if isinstance(revision, bool) or not isinstance(revision, int) or revision < 0:
            raise ValueError("Expected a nonnegative integer batch revision.")
        # Time prefix provides FIFO order even when requests use random UUIDs.
        # Each cumulative revision remains immutable and separately retryable.
        # Old filename format remains readable for already queued batches.
        candidates = [*self.directory.glob(f"*-{batch_id}-r{revision}.json"), *self.directory.glob(f"*-{batch_id}.json")]
        existing = [path for path in candidates if json.loads(path.read_bytes()).get("revision") == revision]
        if existing:
            if existing[0].read_bytes() != body:
                raise PublishError("A queued batch ID cannot be reused with different content.")
            return
        queued = self.pending()
        if len(queued) >= self.max_batches or sum(p.stat().st_size for p in queued) + len(body) > self.max_bytes:
            raise PublishError("Worker outbox is full; undelivered batches were preserved.")
        import time

        # A backwards wall-clock adjustment must not put a replacement before
        # the earlier retraction, including when resuming a nonempty outbox.
        last_order = max((int(path.name.split("-", 1)[0]) for path in queued), default=-1)
        order = max(time.time_ns(), last_order + 1)
        path = self.directory / f"{order:020d}-{batch_id}-r{revision}.json"
        fd, temporary = tempfile.mkstemp(prefix=".batch-", dir=self.directory)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(body)
                handle.flush()
                os.fsync(handle.fileno())
            _replace_file(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def flush(self, limit: int = 8) -> int:
        # Serialize senders, but never hold the producer mutex across HTTP.
        with self._flush_lock:
            return self._flush(limit)

    def _flush(self, limit: int) -> int:
        sent = 0
        with self._queue_lock:
            if not self._delivery_ready:
                return 0
            if _WINDOWS:
                # Failed cleanup blocks later HTTP revisions until it is resolved.
                for acknowledged in sorted(self.directory.glob("*.acked")):
                    acknowledged.unlink()
            paths = self.pending()[:limit]
        for path in paths:
            with self._queue_lock:
                if not self._delivery_ready:
                    break
                body = path.read_bytes()
                self.attempts += 1
            if not self.sender(body):
                break
            with self._queue_lock:
                _remove_acknowledged(path)
                sent += 1
                self.delivered += 1
        return sent


def measurement_url(ingest_url: str) -> str:
    """Derive the sibling route without copying private URL query values."""
    from urllib.parse import urlunsplit

    parsed = urlsplit(ingest_url)
    if parsed.path.rstrip("/") != "/api/worker":
        raise ValueError("Set EMISSION_LENS_MEASUREMENT_URL for a custom ingest path.")
    return urlunsplit((parsed.scheme, parsed.netloc, "/api/measurements", "", ""))


class TraversalBridge:
    """Explicit, default-disabled producer → complete v1 measurement snapshots.

    The local movement context enables evidence production only. The server
    independently resolves approval and distance; neither is sent as authority.
    Tracker IDs and frame pixels never enter this outbox.
    """

    @classmethod
    def from_config(cls, raw, metrics, run, state_path=None):
        if (
            isinstance(raw, dict)
            and set(raw) == {"bridge_version", "enabled"}
            and raw["bridge_version"] == "1.0"
            and raw["enabled"] is False
        ):
            return None
        required = {
            "bridge_version",
            "enabled",
            "camera_id",
            "context_version",
            "view_version",
            "calibration_version",
            "mapping_version",
            "meteorology",
            "policy",
            "movements",
            "stop_observation",
        }
        if (
            not isinstance(raw, dict)
            or set(raw) != required
            or raw["bridge_version"] != "1.0"
            or raw["enabled"] is not True
        ):
            raise ValueError(
                "Traversal bridge needs the exact enabled v1 configuration or the disabled default."
            )
        if (
            metrics is None
            or not metrics.enabled
            or metrics.image_geometry_status != "reviewed"
        ):
            raise ValueError(
                "Traversal production requires explicitly enabled reviewed image geometry."
            )
        if (
            raw["camera_id"] != metrics.camera_id
            or raw["view_version"] != metrics.version
        ):
            raise ValueError(
                "Traversal bridge must match the selected measurement camera/view version."
            )
        return cls(raw, metrics, run, state_path)

    def __init__(self, raw, metrics, run, state_path=None):
        from copy import deepcopy
        from worker.traversal import (
            MovementDefinition,
            TraversalConfig,
            TraversalGate,
            TraversalProducer,
        )
        from worker.metrics import point_in_polygon

        self._raw, self._metrics, self._run_id, self._mode = (
            deepcopy(raw),
            metrics,
            run["run_id"],
            run["mode"],
        )
        met = raw["meteorology"]
        import math

        if not isinstance(met, dict) or set(met) != {
            "temperature_f",
            "relative_humidity_pct",
        }:
            raise ValueError(
                "Explicit temperature and humidity assumptions are required."
            )
        for key, low, high in (
            ("temperature_f", -200, 200),
            ("relative_humidity_pct", 0, 100),
        ):
            value = met[key]
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                or not low <= value <= high
            ):
                raise ValueError(
                    "Meteorological assumptions must be finite and within supported bounds."
                )
        for key in ("calibration_version", "mapping_version"):
            if raw[key] is not None and (
                not isinstance(raw[key], str)
                or not raw[key].strip()
                or len(raw[key]) > 256
            ):
                raise ValueError("Version references must be bounded strings or null.")
        policy = raw["policy"]
        if not isinstance(policy, dict) or set(policy) != {
            "max_gap_s",
            "max_traversal_s",
            "hysteresis",
            "min_track_hits",
        }:
            raise ValueError(
                "Explicit traversal gap, duration, hysteresis and hit policy is required."
            )
        self._stop = raw["stop_observation"]
        if self._stop is not None:
            if not isinstance(self._stop, dict) or set(self._stop) != {
                "method_version",
                "image_displacement_per_s",
                "review_evidence_refs",
            }:
                raise ValueError(
                    "Stopped-interval policy needs an explicit reviewed image-motion method."
                )
            threshold = self._stop["image_displacement_per_s"]
            if (
                isinstance(threshold, bool)
                or not isinstance(threshold, (int, float))
                or not math.isfinite(threshold)
                or not 0 <= threshold <= 1
            ):
                raise ValueError(
                    "Stopped image displacement threshold must be within [0,1]."
                )
            refs = self._stop["review_evidence_refs"]
            if (
                not isinstance(refs, list)
                or not refs
                or any(not isinstance(ref, str) or not ref.strip() for ref in refs)
            ):
                raise ValueError(
                    "Stopped intervals need explicit review evidence; use null when unavailable."
                )
            if (
                not isinstance(self._stop["method_version"], str)
                or not self._stop["method_version"].strip()
            ):
                raise ValueError("Stopped intervals need a method version.")
        if not isinstance(raw["movements"], list) or len(raw["movements"]) > 100:
            raise ValueError("Configure a bounded set of explicit movements.")
        gates = {g.id: g for g in metrics.gates}
        movements = []
        keys = {
            "movement_id",
            "version",
            "entry_gate_id",
            "exit_gate_id",
            "entry_direction",
            "exit_direction",
            "accepted",
            "calibration_version",
            "calibration_status",
            "calibration_evidence",
            "distance_m",
            "distance_source",
        }
        for value in raw["movements"]:
            if (
                not isinstance(value, dict)
                or set(value) != keys
                or value["calibration_version"] != raw["calibration_version"]
            ):
                raise ValueError(
                    "Movement fields and calibration version must match the bridge configuration."
                )
            selected = []
            for side in ("entry", "exit"):
                gate = gates.get(value[side + "_gate_id"])
                direction = value[side + "_direction"]
                if (
                    gate is None
                    or direction not in ("positive", "negative")
                    or gate.direction not in ("both", direction)
                ):
                    raise ValueError(
                        "Movement needs an existing image gate and a compatible explicit direction."
                    )
                selected.append(TraversalGate(gate.id, gate.start, gate.end, direction))
            movements.append(
                MovementDefinition(
                    value["movement_id"],
                    value["version"],
                    raw["view_version"],
                    *selected,
                    value["accepted"],
                    value["calibration_version"],
                    value["calibration_status"],
                    value["calibration_evidence"],
                    value["distance_m"],
                    value["distance_source"],
                )
            )
        config = TraversalConfig(
            raw["camera_id"],
            run["run_id"],
            run["mode"],
            raw["context_version"],
            raw["view_version"],
            tuple(movements),
            **policy,
        )
        self._producer = TraversalProducer(config)
        self._point_in_polygon = point_in_polygon
        from worker.measurement import MeasurementBridge

        self._bridge = MeasurementBridge(raw["camera_id"], dict(run))
        self._state_path = Path(state_path) if state_path is not None else None
        self._clocks, self._completed, self._new_events, self._refs = {}, [], [], {}
        self._positions, self._session, self._last_media = {}, None, None
        self._issues = {}

    def observe(self, frame, vehicles):
        from collections import Counter
        from worker.timing import SessionMediaClock, media_microseconds
        from worker.traversal import TraversalObservation
        import math

        if frame.camera_id != self._raw["camera_id"]:
            raise ValueError("Traversal bridge cannot mix cameras.")
        if self._session is not None and frame.session < self._session:
            return
        if (
            frame.session == self._session
            and self._last_media is not None
            and frame.media_time_s <= self._last_media
        ):
            return
        if frame.session != self._session:
            self._positions.clear()
            self._session = frame.session
            if len(self._clocks) >= self._bridge.max_events:
                raise PublishError(
                    "Traversal bridge clock capacity reached; preserve the outbox and start a reviewed new run."
                )
        clock = self._clocks.setdefault(frame.session, SessionMediaClock())
        clock.observe(media_microseconds(frame.media_time_s), frame.received_at)
        observations, positions = [], {}
        height, width = frame.image.shape[:2]
        for vehicle in vehicles:
            detection = vehicle.detection
            point = ((detection.x1 + detection.x2) / (2 * width), detection.y2 / height)
            if not all(math.isfinite(v) and 0 <= v <= 1 for v in point):
                continue
            if not self._point_in_polygon(point, self._metrics.road_region) or any(
                self._point_in_polygon(point, region)
                for region in self._metrics.excluded_regions
            ):
                continue
            prior = self._positions.get(vehicle.track_id)
            state, method = "unavailable", None
            if self._stop is not None and prior is not None:
                previous, at = prior
                elapsed = frame.media_time_s - at
                if 0 < elapsed <= self._producer.config.max_gap_s:
                    state = (
                        "stopped"
                        if math.dist(previous, point) / elapsed
                        <= self._stop["image_displacement_per_s"]
                        else "moving"
                    )
                    method = self._stop["method_version"]
            observations.append(
                TraversalObservation(
                    vehicle.track_id, point, vehicle.label, state, method
                )
            )
            positions[vehicle.track_id] = (point, frame.media_time_s)
        update = self._producer.update(
            session=frame.session,
            media_time_s=frame.media_time_s,
            observations=observations,
            context_version=self._raw["context_version"],
            view_version=self._raw["view_version"],
        )
        self._positions, self._last_media = positions, frame.media_time_s
        for issue, count in Counter(update.issues + update.unavailable_reasons).items():
            self._issues[issue] = self._issues.get(issue, 0) + count
        if len(self._completed) + len(update.completed) > 10_000:
            raise PublishError(
                "Traversal evidence capacity reached; preserve delivery and rotate the run."
            )
        self._completed.extend((frame.session, event) for event in update.completed)
        self._new_events.extend(update.completed)

    def publish(self, run, observation_batches=(), outbox=None):
        """Persist pending → enqueue whole plan → commit/persist → permit flush."""
        from worker.measurement import ObservationSnapshot
        from worker.timing import MEDIA_CLOCK_VERSION
        from worker.traversal import TraversalClock

        if run["run_id"] != self._run_id or run["mode"] != self._mode:
            raise ValueError("Traversal bridge run/mode cannot change.")
        # A previous partial enqueue must finish before preparing a new revision.
        if self._bridge.pending() is not None:
            _queue_measurement_plan(self._bridge, outbox, self._state_path)
            self._new_events.clear()
        previous_refs = dict(self._refs)
        for item in observation_batches:
            minutes = {row["minute"] for row in item["traffic"]}
            if not minutes:
                for minute, ref in list(self._refs.items()):
                    if ref["batch_id"] == item["batch_id"]:
                        del self._refs[minute]
            for minute in minutes:
                ref = {"batch_id": item["batch_id"], "revision": item["revision"]}
                self._refs[minute] = ref
        removed = [minute for minute in previous_refs if minute not in self._refs]
        updates = [
            ObservationSnapshot(
                self._raw["camera_id"],
                self._run_id,
                self._mode,
                minute,
                observation_ref=ref,
            )
            for minute, ref in self._refs.items()
            if previous_refs.get(minute) != ref
        ]
        clocks = [
            TraversalClock(
                self._producer.session_id(session),
                clock.anchor,
                MEDIA_CLOCK_VERSION,
                "estimated_hls_media",
                "session-minimum-receipt-minus-media",
            )
            for session, clock in self._clocks.items()
        ]
        plan = self._bridge.prepare(
            events=tuple(self._new_events),
            clocks=clocks,
            calibration_version=self._raw["calibration_version"],
            mapping_version=self._raw["mapping_version"],
            meteorology=dict(self._raw["meteorology"]),
            observations=updates,
            remove_observation_minutes=removed,
            run=dict(run),
        )
        count = len(plan.batches)
        _queue_measurement_plan(self._bridge, outbox, self._state_path)
        self._new_events.clear()
        return count

    def diagnostic(self):
        return {
            "enabled": True,
            "camera_id": self._raw["camera_id"],
            "completed_traversals": len(self._completed),
            "session_count": len(self._clocks),
            "issues": dict(self._issues),
            "stopped_interval_policy_configured": self._stop is not None,
            "timing_basis": "estimated_hls_media_utc",
            "physical_approval_source": "server_registry_only",
        }


def _write_measurement_checkpoint(path, checkpoint):
    if path is None:
        return
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    body = (
        json.dumps(checkpoint, allow_nan=False, separators=(",", ":")) + "\n"
    ).encode()
    if len(body) > 32 * 1024 * 1024:
        raise PublishError(
            "Measurement checkpoint capacity reached; committed state was preserved."
        )
    fd, temporary = tempfile.mkstemp(prefix=".measurement-state-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        _replace_file(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def _queue_measurement_plan(bridge, outbox, state_path):
    # A background sender may deliver only complete, durably committed plans.
    with outbox.publication() if outbox is not None else nullcontext():
        _publish_measurement_plan(bridge, outbox, state_path)


def _publish_measurement_plan(bridge, outbox, state_path):
    plan = bridge.pending()
    if plan is None:
        # A previous post-commit disk error must be repaired before any flush.
        _write_measurement_checkpoint(state_path, bridge.checkpoint())
        return
    if outbox is not None and (
        state_path is None
        or Path(state_path).parent.resolve() != outbox.directory.resolve()
    ):
        raise ValueError(
            "Durable measurement delivery requires a private checkpoint alongside its outbox."
        )
    _write_measurement_checkpoint(state_path, bridge.checkpoint())
    if outbox is not None:
        for batch in plan.batches:
            outbox.enqueue(batch)
    bridge.commit(plan.plan_id)
    _write_measurement_checkpoint(state_path, bridge.checkpoint())


def recover_measurement_outbox(outbox):
    """Finish retained plans before delivery; never reopen old tracker identities."""
    from worker.measurement import MeasurementBridge

    path = outbox.directory / "bridge.checkpoint"
    if path.exists():
        try:
            if path.stat().st_size > 32 * 1024 * 1024:
                raise ValueError("Checkpoint exceeds capacity.")
            bridge = MeasurementBridge.restore(json.loads(path.read_text()))
        except (ValueError, TypeError, KeyError, OSError):
            raise PublishError(
                "Measurement checkpoint is unreadable; preserve it for recovery."
            ) from None
        _queue_measurement_plan(bridge, outbox, path)
    elif outbox.pending():
        raise PublishError(
            "Measurement outbox has no checkpoint; preserve it for recovery."
        )
    outbox.flush(limit=outbox.max_batches)
    if outbox.pending():
        raise PublishError(
            "Previous measurement delivery is incomplete; retry the retained outbox before starting another run."
        )
