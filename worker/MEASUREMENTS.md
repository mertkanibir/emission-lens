# Traversal-to-measurement bridge

**Owner:** Mert
**Updated:** 7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC
**Status:** Bridge and opt-in runtime binding are implemented and deterministically verified; real physical acceptance remains open. The exact API was published before implementation in `e945492`.

New module `worker.measurement` bridges [completed traversal evidence](./TRAVERSALS.md) to the exact separate [measurement v1 envelope](../backend/MEASUREMENT-INGESTION.md). Engineering owns the runtime call sites. It does not change `WorkerBatch` 1.1 or infer physical approval.

## Exact bridge call signatures

```python
ObservationSnapshot(camera_id: str, run_id: str, mode: str, minute: str,
                    observations: tuple[dict, ...] = (),
                    observation_ref: dict | None = None)
# Rows have exactly vehicle_class, count, stopped_vehicle_seconds,
# queue_count, coverage. A ref has exactly batch_id/revision and must refer
# to this declared camera/run/mode/minute; the server verifies the dependency.

bridge = MeasurementBridge(camera_id: str, run: dict, *,
                           max_events: int = 10000, max_minutes: int = 240)
bridge.prepare(*, events: Iterable[CompletedTraversalEvidence] = (),
               clocks: Iterable[TraversalClock], calibration_version: str | None,
               mapping_version: str | None, meteorology: dict,
               observations: Iterable[ObservationSnapshot] = (),
               remove_observation_minutes: Iterable[str] = (),
               run: dict | None = None) -> MeasurementPlan
bridge.pending() -> MeasurementPlan | None
bridge.commit(plan_id: str) -> None
bridge.checkpoint() -> dict
MeasurementBridge.restore(checkpoint: dict) -> MeasurementBridge
serialize_measurement_batch(batch: dict) -> bytes

# MeasurementPlan fields: plan_id:str, batches:tuple[dict,...],
# unavailable_reasons:tuple[str,...], retained_events:int.
```

`events` adds immutable media events; exact ID replays deduplicate, changed evidence under the same ID rejects. `clocks` supplies the complete current session mapping on each prepare. Missing or unsupported clocks leave events retained/unavailable and retract their old exported membership. V1 requires `basis="estimated_hls_media"`, `version="hls-min-anchor-v1"`; recording/capture/synthetic-anchor clocks are not relabeled as HLS. Controlled synthetic fixtures may explicitly supply an estimated-HLS clock and remain in synthetic mode.

Calibration/mapping references and explicit meteorology apply to the entire retained calculation window. Changing them revises complete snapshots; this is an explicit shared assumption, not inferred historical weather. A non-null calibration reference must match producer movement calibration versions. No distance, transform, approval status, factor, grams, raw tracker ID or incidental producer field enters the envelope. Server registry approval alone controls physical output. Unknown classes and nullable per-vehicle stopped time retain their meanings.

Observation updates replace the complete independently observed class rows/reference for their declared minute. Other observation minutes remain retained until explicitly removed. Do not reconstruct these rows from traversals. Runtime code must update/remove references when the legacy observation producer rebins; stale references cause the server to withhold dependent calculations. Empty observed rows mean unavailable observation data, never fabricated supported zeros.

## Ordered planning, retry and restart

Stable UUIDs are scoped to measurement version, camera/run/mode/minute and are distinct from legacy worker UUIDs. Revisions only increase for changed complete snapshots. If any completed ID leaves an old minute, every affected old snapshot is retracted first, before any replacement; a remaining old-minute cohort is then republished in full. Confirmation/receipt times never choose completion membership.

An outstanding plan blocks new prepares. `pending()` returns its exact envelopes; callers must finish that plan before adding observations/events. The bridge does not perform I/O. Integration uses the existing `Outbox` and `HttpSender` unchanged:

1. Prepare; atomically persist a private `bridge.checkpoint()` containing the pending plan before enqueueing anything.
2. Enqueue all `plan.batches` in their returned order into a **separate measurements outbox**. Do not flush yet. Partial capacity/error leaves the plan pending; retry `pending()` with identical bodies. Existing queued bodies deduplicate by UUID/revision.
3. After every envelope is durably queued, `commit(plan.plan_id)` and atomically persist the committed checkpoint. Only then flush that outbox. Never flush a pending plan: after a crash, retrying an already superseded earlier revision could otherwise conflict.
4. On restart, restore the private checkpoint first. Finish a retained pending plan before flushing; otherwise flush the committed outbox normally. A lost HTTP acknowledgement retries identical bytes through the unchanged FIFO sender.

Drain previous committed work before starting a new plan, and configure enough bounded outbox capacity for the entire plan (`sum(len(serialize_measurement_batch(b)) for b in plan.batches)`). If partial enqueue reaches capacity, retain the pending checkpoint and queued files, then reopen the outbox with sufficient bounded capacity to finish. Do not flush partially queued pending-plan revisions to make room. A private checkpoint write failure must also prevent flushing.

Use `HttpSender("https://<server>/api/measurements", token)` (or the existing loopback tunnel), and an outbox directory separate from `/api/worker` delivery. Obtain the token from existing private runtime configuration; no credential is retained in bridge state. Never send this envelope to `/api/worker`.

Retention is explicitly bounded and fails closed rather than dropping old cohort members: at most `max_events`, `max_minutes` distinct batch/revision keys and 32 session mappings per envelope. V1 allows at most 1000 traversals per minute and a 1 MiB serialized body, including the outbox newline. A full minute is not split into competing snapshots. Limits reject the entire preparation without advancing revisions or losing input events. Runtime must choose a bounded run/retention window and resolve old ownership explicitly; there is no automatic cross-run overlap merge or silent historical eviction.

The checkpoint is a private integrity-checked JSON object with committed retained media facts, published snapshots/revisions and optional pending next state. Persist it atomically with restrictive permissions alongside the separate outbox. This is producer continuity state, not a public contract or registry approval record.

## Verified checkpoint

```bash
python -m pytest tests/test_measurement.py tests/test_traversal.py tests/test_metrics.py tests/test_calibration.py tests/test_timing.py tests/test_publish.py -q
```

**127 tests plus 112 subtests passed**, including 28 new bridge cases. The tests check Python JSON through the actual TypeScript `parseMeasurementBatch` and an isolated in-memory server repository, including partial cohort rebins, retraction-before-replacement, exact server retry and an empty registry that yields no physical estimates. A separate bounded loopback HTTP test uses the existing `HttpSender`/`Outbox` to verify dedicated endpoint/authentication, temporary HTTP failure and identical retry bytes. Pending/committed checkpoint restore, partial outbox enqueue/restart, mutable caller copies, 1000-traversal and 32-session boundaries, 1 MiB ASCII expansion, capacity rollback and source/run/mode separation are covered.

The bridge makes no HTTP requests or disk writes itself. Runtime binding must retain pending checkpoints before enqueue, commit/persist before flush, update matching legacy observation references and supply current clocks. Existing runtime snapshot helpers must delegate this bookkeeping to `MeasurementBridge` to benefit from these tested rules. Do not run two independently revisioning producers for the same camera/run/minute.

The bridge-only implementation checkpoint ran no GPU, collected no media and changed no model/tracker/configuration, manual review or camera enablement. Runtime ingestion/storage is implemented separately by engineering. Physical calibration, class mapping, stopped-time classification and count acceptance remain independent requirements; this bridge neither approves them nor invents values.

**Runtime handoff reconciliation (7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC):** Engineering's [runtime adapter](./RUNTIME-MEASUREMENTS.md) now implements the call sites, separate endpoints/outboxes and durable plan ordering described above. [Queue portability evidence](./QUEUE-PORTABILITY.md) records the later native platform checks. Server storage/read/scenario integration is also implemented. These changes supersede the earlier code-handoff dependency; reviewed physical inputs, human count acceptance for remaining cameras and configured field/replay/outage verification are still required.
