# Internal completed-traversal producer

**Owner:** Mert
**Updated:** 7 November 2026, 20:29 America/New_York / 8 November 2026, 01:29 UTC
**Status:** API proposal published before implementation; synthetic verification pending.

This is an internal producer for the accepted traversal/scenario handoff in [Coordination.md](../Coordination.md). Engineering owns runtime wiring, registry approval, persistence and minute composition. This document introduces no public contract fields, accepted camera geometry or physical measurements.

## Exact proposed Python API

New module: `worker.traversal`. All input/output dataclasses are frozen. Times below are source-media seconds; points are normalized image ground-contact points, with x right and y down.

```python
TraversalGate(gate_id: str, start: tuple[float, float],
              end: tuple[float, float], direction: str)
# direction is exactly "positive" or "negative", using oriented-line cross product.

MovementDefinition(movement_id: str, version: str, view_version: str,
                   entry: TraversalGate, exit: TraversalGate, accepted: bool,
                   calibration_version: str | None, calibration_status: str,
                   calibration_evidence: str | None, distance_m: float | None,
                   distance_source: str | None)
# calibration_status: "valid", "invalid", or "missing". accepted and evidence
# refer to caller-reviewed movement/calibration/path, never mathematical checks alone.

TraversalConfig(camera_id: str, run_id: str, mode: str, context_version: str,
                view_version: str, movements: tuple[MovementDefinition, ...],
                max_gap_s: float, max_traversal_s: float,
                hysteresis: float, min_track_hits: int)

TraversalObservation(track_id: int, point: tuple[float, float],
                     vehicle_class: str = "unknown",
                     interval_state: str = "unavailable",
                     stop_method_version: str | None = None)
# interval_state: "moving", "stopped", or "unavailable"; classifies the WHOLE
# immediately preceding observation interval for THIS identity. Known states
# require an explicit method version. The producer does not classify motion.

TraversalClock(session_id: str, anchor_utc: datetime, version: str,
               basis: str, evidence_ref: str)
# basis: "estimated_hls_media", "recording_anchor", "synthetic_anchor",
# or "verified_capture"; the latter requires independently retained evidence.

producer = TraversalProducer(config: TraversalConfig)
producer.session_id(session: int) -> str
producer.update(*, session: int, media_time_s: float,
                observations: Iterable[TraversalObservation],
                context_version: str, view_version: str) -> TraversalUpdate

# TraversalUpdate fields:
# completed: tuple[CompletedTraversalEvidence, ...] -- new events only
# unavailable_reasons: tuple[str, ...]
# issues: tuple[str, ...] -- conservative discards/discontinuities
# discontinuity: bool
# duplicate: bool

# CompletedTraversalEvidence fields:
# session_id, traversal_id, vehicle_class, distance_m, traversal_time_s,
# stopped_time_s (float | None), entered_media_time_s, completed_media_time_s,
# entry_confirmed_media_time_s, exit_confirmed_media_time_s,
# stopped_intervals: tuple[StoppedInterval, ...], provenance
# StoppedInterval fields: start_media_time_s, end_media_time_s, method_version

event.to_completed_traversal(clock: TraversalClock) -> dict
# Exactly CompletedTraversal fields + nullable stopped_time_s.
event.to_record(clock: TraversalClock) -> dict
# Same fields + internal provenance, linked stopped intervals and timing basis.
```

## Deterministic rules and integration requirements

- Feed a complete per-frame snapshot of actual observed tracks for one camera/run/mode. Normalize accepted ground-contact points upstream; exclude non-road detections there. Do not pass tracker predictions as observations. A missing identity or duplicate identity in a snapshot aborts that identity and retires its numeric ID for the rest of the session. IDs must not be reused within a session.
- Sessions are monotonically increasing integers, matching the current frame session shape. Reconnect resets unfinished tracks, gate states and the per-session completion ledger; old sessions cannot affect new ones. Source overlap after reconnect is not deduplicated across sessions and must be excluded or disclosed by the integration owner.
- Adjacent source times must advance and be within the explicitly chosen `max_gap_s`. Excessive gaps/backwards time discard open tracks. Identical repeated frames are idempotent; conflicting repeats discard open tracks. No disappearance, lost track or unfinished entry produces a completion. An explicit maximum traversal duration bounds unresolved attempts.
- Each versioned movement names finite entry and exit gates and one allowed direction for each. A finite segment intersection supplies an interpolated crossing timestamp. Confirmation requires the opposite hysteresis side and minimum track hits; its later timestamp is retained separately. A touch/return, endpoint bypass or reversal is not a traversal. Gate events in the same frame are processed in crossing-time order.
- One completion at most per track/movement/session. Reentry, reversal or an extra entry during an open attempt invalidates that attempt rather than creating an extra vehicle. Failed attempts cannot rearm in that session. This deliberately undercounts ambiguous loops and tracker ID reuse.
- Accepted distance is the explicitly supplied calibrated directed segment/path length between these gates, with source and acceptance evidence for the same view. No lane-width assumption, box-motion sum or inferred scale is available. Missing/unaccepted movement, calibration or distance yields no physical completion, with a reason. An empty movement list is explicitly unavailable.
- Bump `context_version` for any movement/calibration/policy revision; supply the observed `view_version` on every update. A context/view mismatch latches this instance unavailable and discards open tracks. Rebuild only after accepted context and a fresh tracker session; never join across a view/calibration change.
- Stops are clipped to the original entry-to-exit media interval for that vehicle. All intervals must have known states under one stop method to support a total, including supported zero; otherwise `stopped_time_s` is null. Partial known stopped intervals remain evidence. Scene-wide minute stopped seconds are never an input. Unknown or conflicting track classes remain `unknown`.
- UTC is an explicit mapping: `anchor_utc + interpolated_exit_media_time`. The clock must match the event session. The original completion, not confirmation/receipt time, selects the reporting cohort. Estimated HLS UTC remains estimated; replay receipt time is not recording capture UTC. Reapplying a revised clock preserves identities and media durations; engineering must revise/retract affected minute rows transactionally. No clock means no `completed_at` record; retain the media event until a justified mapping exists.

`to_record` provenance retains camera/run/mode, producer and context/policy versions, movement/gate definitions and versions, calibration/version/acceptance reference, distance source, crossing/confirmation times, stop method and clock basis/version/evidence. It excludes raw tracker IDs. Engineering can pass `to_completed_traversal` directly to the existing calculation adapter after approved context validation, while retaining private provenance separately. It must not put these additional fields in `WorkerBatch` without an approved persistence/transport proposal.

No real geometry will be enabled, and no labels, model settings, training, manual-count review or GPU allocation are part of this checkpoint. Synthetic tests will establish state-machine mechanics only. Real calibration, direction/continuity thresholds, road observations, stopped-time classification and held-out acceptance remain separate dependencies.
