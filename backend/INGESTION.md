# Worker ingestion and local persistence

**Owner:** Mert
**Updated:** 7 November 2026, 18:53 America/New_York (23:53 UTC)

The worker sends aggregate records to the authenticated HTTP ingestion route. The additive transport envelope carries contract `1.1`, a UUID `batch_id`, nonnegative integer `revision`, one `run`, and `statuses`, `traffic`, and `emissions` arrays. It does not carry frames, personal identities, or cross-camera tracking IDs. Every row must belong to the declared run's mode. Traffic rows must name that run. Unknown fields, cameras, enums, non-finite values, negative counts, non-UTC timestamps, duplicate row keys, and mixed modes reject the entire batch.

`heartbeat_at` is evidence of processing progress. `last_source_timestamp` is capture UTC when available; it stays null for Caltrans frames without machine-readable capture UTC. An unavailable capture timestamp also requires null `processing_delay_ms`. No capture-to-dashboard latency is inferred from receipt time. Source capture cannot follow the processing heartbeat. Ingestion rejects event timestamps more than five minutes ahead of server time.

## Traffic-minute time basis

New runs marked `t:hls-min-anchor-v1` assign traffic minutes from a session-local estimated HLS media clock: `anchor = min(received_at - media_time)`, then `estimated_time = anchor + media_time`. Later anchor improvements rebin earlier scalar observations. Each camera/reconnect has an independent anchor; this does not establish capture UTC or remove the unknown minimum transport delay. Heartbeats and preview receipt timestamps keep their original meanings. For replay, the estimate is anchored to playback receipts rather than the recording's original capture time.

`get_traffic_window` labels estimated-media windows and warns about mixed timing bases when legacy or unspecified record times share the window. Existing receipt-based records are not retroactively moved without their source observations. Source footage can overlap across reconnects/runs, so starting at a new receipt-minute boundary does not guarantee disjoint observations.

## Configure

Set `EMISSION_LENS_STORE_PATH` to an absolute path on a persistent local POSIX volume, for example an ignored `runs/worker-store.json` in the repository. Set the worker authentication token through the server environment as documented by the HTTP route. There is no default public write credential. Missing persistence configuration returns HTTP 503; it never acknowledges an unpersisted write. Without a configured store, readers retain the existing offline/live and labeled synthetic fixtures.

The store uses an exclusive writer lock, private file permissions, a file flush, atomic rename, and a directory flush. Independent request processes read the same committed snapshot. A crashed writer's lock can be recovered once its process is confirmed absent. Active-lock contention returns HTTP 503 for an unchanged retry. Corrupt or unreadable snapshots fail closed and are preserved for recovery.

Read views are cached against the configured path, device/inode, byte length, and nanosecond modification/change times. Atomic replacement or external modification invalidates the cache. Returned records are frozen so callers cannot change another request's evidence. Ingestion transactions always reread the committed file under the writer lock. Dynamic store paths are excluded from the frontend build's file tracing; local data is read only at runtime.

This is a single-host store for a local or self-hosted demonstration. Do not place it on ephemeral serverless storage or assume separate application hosts share it. The Postgres drafts remain unapplied. A hosted deployment still needs a persistent shared database adapter.

## Retries, revisions, and retention

- Retrying the same UUID and revision with identical content returns `duplicate: true`; counts are not incremented. Reordering object properties does not change content identity.
- Changing content at the same revision, submitting an older revision, changing run provenance, or reopening an ended run returns HTTP 409. Device provenance may transition from null to its first verified device after warmup, then remains fixed.
- A higher revision explicitly replaces the entire retained batch, rather than adding counts. A higher revision with `traffic: []` removes that batch's prior traffic rows; an emptied minute is absent, not an unsupported zero or a null placeholder. Later snapshots of the same camera-minute-class and same run remain snapshots, rather than increments. Event time prevents delayed older batches from rolling back newer heartbeats or cumulative minute rows.
- For a clock rebin, the worker queues required retractions before replacement minutes. FIFO order survives retries, restart and a backward wall-clock adjustment. A multi-batch correction can temporarily leave incomplete data, but moved counts are not added twice.
- A camera-minute-class already owned by another run returns HTTP 409. This avoids silently losing or double-counting overlapping observations across restarts; integration must resolve such windows explicitly before publishing traffic rows.
- Ended runs publish offline camera states. An old retry cannot resurrect that run.
- The local ledger prunes on successful writes to the most recently accepted **5,000 batches within 24 hours**. History and duplicate receipts are limited to that retention horizon. It is not a permanent archive. A separate **32 MiB** snapshot ceiling returns HTTP 507 before replacing the existing store. Old batches without an event in the current 24-hour window are rejected.

Legacy synthetic worker writes do not alter the labeled synthetic fixtures. The separate measurement path may create an explicitly synthetic persisted test namespace; when its receipts exist, synthetic reads use that namespace, including after retraction, rather than resurrecting static fixtures. Live/replay remain separate and synthetic data never enters live totals.

## Scientific limits

Camera calibration is still missing. Numeric distance or metre-based queue metrics from live/replay batches are rejected until the corresponding camera has valid calibration. Numeric emissions require valid calibration and factor/method provenance. Unavailable, insufficient-evidence, and calibration-invalid emissions must have null estimates and null ranges, including when a producer attempts to send zero. Counts remain line-crossing counts; detector-box observations are not counts.

By default the runtime publishes empty traffic/emissions arrays. Explicitly enabled, reviewed image geometry can support selected-gate crossing counts and configured image-based queues independently of physical calibration. Unsupported traversal, distance, speed, coverage and emissions quantities remain unavailable. A progressing detector can legitimately update worker status while traffic and emissions remain unavailable.

## Verification

`npm test` covers persisted rereads, idempotent retries, revision conflicts and full-batch replacement/retraction, timing-basis disclosures, out-of-order progress, run provenance, cross-run overlaps, mode isolation, whole-batch rejection, unknown capture UTC, calibration suppression, malformed input, expired/future events, corruption, and unconfigured persistence. `npm run typecheck` checks the shared contracts, backend and frontend.

**Preview note (7 November 2026, 18:30 America/New_York / 23:30 UTC):** `POST /api/frames` uses the same private bearer token and a bounded JSON body containing one JPEG with matching worker-drawn overlays. `GET /api/cameras/[id]/frame?mode=live|replay` returns the latest labeled frame. The process holds at most eight camera/mode frames, removes them within 60 seconds, and never writes them to disk or the aggregate ledger. Multi-process or multi-host deployments need a separate ephemeral preview transport; this implementation is verified in one local server process.

**Documentation note (7 November 2026, 18:53 America/New_York / 23:53 UTC):** Mert reconciled these instructions with the implemented media-clock correction, empty-batch retractions and optional reviewed image measurements. Contract 1.1 fields are unchanged. [Timing evidence and limitations](../evaluation/timing-alignment.md) remain distinct from capture-time, calibration or environmental-impact validation.


**Measurement extension (7 November 2026, 20:49 America/New_York / 8 November 2026, 01:49 UTC):** [Measurement v1.0](./MEASUREMENT-INGESTION.md) extends the same private atomic snapshot with source revisions, completed-cohort evidence and authoritative CO₂/NOₓ rows. Worker contract 1.1 still rejects caller-supplied unsupported physical quantities. Measurement distances and mixture approval resolve solely from the private server registry. Observation-revision changes atomically invalidate their dependent calculation while preserving independent crossing/queue/general-stop fields. Read-cache identity includes the current registry fingerprint, so revoked approval cannot leave old physical values cached. Public reads never expose raw traversal/session identifiers. The old static-calibration statement below applies to the legacy route; no real calibration is activated by this extension.
