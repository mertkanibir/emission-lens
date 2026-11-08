# Reliability checkpoint

**Owner:** Mert
**Updated:** 7 November 2026, 19:39 America/New_York / 8 November 2026, 00:39 UTC

## Verified in this checkpoint

`node --import tsx --test backend/test/reliability.test.ts` passes six bounded tests using synthetic records and private temporary stores:

| Failure or boundary | Observed behavior |
|---|---|
| Old writer lock still owned by a live child process | The write returns 503, committed bytes remain unchanged, the live lock is preserved, and an independent reader still loads the committed snapshot. |
| Confirmed crashed writer | After the dead owner and old lock are verified, a new update succeeds and releases its own lock. |
| Existing recovery claim | Stale-lock recovery returns 503 without deleting either lock or mutating the store. |
| Two stale-lock reapers interleaved with a new live writer | A paused stale-owner probe cannot remove the new writer's lock; both serialized updates complete and all batch receipts remain. |
| In-progress or failed transaction | Independent reader processes see the old committed snapshot until replacement; an update failure preserves bytes and releases its own lock. |
| HTTP acknowledgement lost after durable commit | The client sees a network failure, then an exact retry receives `duplicate: true`; one batch and its original count remain stored. |

The lock recovery implementation now takes a separate exclusive `.lock.recovery` claim and rereads the current writer owner/age before unlinking a stale writer lock. This closes the concurrent-reaper case where two processes had both inspected a dead owner before one acquired a new live lock. The regression deliberately controls this interleaving with child processes; it is not a camera outage test.

A recovery claim is never reaped automatically. A process that crashes while holding it can block subsequent stale-lock recovery. Recovery requires an operator to drain writers, verify owners are absent, preserve the committed snapshot, and remove only the abandoned claim. Malformed owner files and PID reuse can also require operator review. This checkpoint performs no such action on an application store. All writer processes must use the same locking protocol.

Backend type checking passes with `npx tsc -p backend/tsconfig.json`. No frontend build, GPU allocation, source-stream request, credential exposure, footage or hosting change was made for these tests.

## Coverage that remains missing

- Existing Python stream tests exercise scripted failed opens, stalled media and reconnects. Publisher tests exercise HTTP response failures, restart retries, bounded outboxes and ordered revisions. These are bounded unit/integration checks, not a real forced HLS outage.
- The recorded four-camera GPU performance interval is 120 seconds, with buffer drops on two cameras. The separate live delivery interval is 90 seconds. Neither establishes multi-hour reliability or complete footage coverage.
- Mid-inference worker termination, full-machine restart/power loss, disk-full/fsync/rename fault injection, extended source outage and replayed-source overlap after reconnect have not been demonstrated end to end here.
- The local snapshot has an explicit 24-hour/5,000-receipt retention horizon and 32 MiB capacity. Recovery and duplicate guarantees do not imply a permanent archive beyond that horizon.

## Deployable topology decision

The existing code supports one persistent Node application host with a persistent POSIX volume for aggregate snapshots and exactly one application process for ephemeral previews. Worker delivery reaches its authenticated HTTP route over an encrypted private relay or a configured HTTPS endpoint. This topology preserves the current stack and can be self-hosted; it is not a claim that a hosted deployment exists.

Multiple independent application instances cannot share the current process-memory preview map, and local file paths alone do not define a shared database. A deployable multi-instance adapter needs a shared transactional aggregate store preserving batch UUID/revision atomicity, mode isolation, provenance and retractions. It also needs a bounded ephemeral preview transport with per-camera/mode ordering, 60-second expiry and no raw-media history. The planned PostgreSQL/Supabase path is compatible with that direction, but the adapter and preview service remain unimplemented. No paid service is provisioned and no public port is opened by this checkpoint.
