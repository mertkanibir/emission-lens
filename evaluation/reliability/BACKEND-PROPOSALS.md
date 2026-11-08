# Backend reliability proposals

**Owner:** Mert

**Updated:** 8 November 2026, 00:35 America/New_York / 8 November 2026, 05:35 UTC

**Status:** Prioritized proposals only. Runtime, contracts, live job 176075, application 3138 and its active registry/store are unchanged. Mert coordinates any core backend edits before implementation.

The completed [bounded delivery check](./README.md) and [job 176092 results](./result-176092.json) remain the accepted scope. The raw queued bodies and fixed-clock reload recheck are now retained privately for independent audit; these do not expand acceptance. Original post-restart response bytes were not recovered. No additional GPU work is proposed here.

| Priority | Gap and proposed next milestone | Acceptance before claiming completion |
|---|---|---|
| 1 | Decide how an absent worker ages from degraded to processing offline. Proposed behavior is below; Mert reviews policy and consistent status copy before any core edit. | Deterministic boundary, explicit-offline, clock-skew, recovery and replay/live isolation checks; original records and snapshot bytes unchanged. |
| 2 | Make complete private evidence capture part of the existing acceptance harness: raw queued bodies, empty final outbox directory inventory, fixed-clock before/after responses, snapshot hashes and source manifest. | A separate offline audit can rehash every captured byte, correlate all delivered bodies and compare full reload responses without a running worker, credential or GPU. Never stage payloads or identities. |
| 3 | Exercise capacity/retention and ambiguous restart recovery in private CPU stores. Existing bounds are 24-hour retention, 5,000 aggregate receipts, 1,000 measurement entries and 32 MiB per snapshot; publisher outboxes are separately bounded. | Capacity rejection preserves committed bytes and pending batches. Exact same-identity retries deduplicate within retained history. Older/conflicting revisions and overlapping new runs stay rejected and queued; no automatic replacement/merge or promise beyond the retention horizon. |
| 4 | Add isolated commit-failure evidence at write, file sync, rename and directory sync, including a crash while holding a recovery claim. | Readers see a valid committed snapshot. A failure after rename may already have committed: an unchanged retry must resolve idempotently. Preserve abandoned claims for explicit operator recovery; never delete a live writer's lock or touch an application store. |
| 5 | If shared hosting is selected, specify transactional persistence and ephemeral preview delivery separately before replacing the local adapter. | Same batch/revision, provenance, retraction, overlap and mode-isolation rules pass against the new adapter, including concurrent writers and restart. No multi-instance or hosted acceptance is implied by local-file checks. |

## Concrete status-policy proposal

Retain the stored worker status and derive only its displayed availability from an explicitly supplied read clock. A heartbeat reports advancing frame processing, not verified capture UTC or proof that the external source is reachable.

| Input | Proposed displayed state |
|---|---|
| Stored offline, or no heartbeat | Offline, as today. |
| Active stored state with heartbeat age from −30,000 through 120,000 ms | Preserve the stored state. |
| Heartbeat age greater than 120,000 ms through 300,000 ms | Degraded. |
| Heartbeat age greater than 300,000 ms | Offline, described as processing unavailable. |
| Heartbeat more than 30,000 ms in the future | Degraded due to clock inconsistency; do not infer an absence timeout from future time. |

A fresh advancing heartbeat restores the stored active state. Explicit offline takes precedence over freshness. These five-minute/120-second boundaries are proposed product policy, not measured reliability guarantees. They remain unapproved and unimplemented.

Do not write a synthetic run end, delete history, replace missing values with zero or label capture UTC as known when a heartbeat expires. Existing historical estimates retain their timestamps and quality states. Do not claim that the camera itself is offline solely because processing heartbeats stopped. No core contract field addition is proposed; any later reason-field/API change needs a separate contract review.

A future implementation should use one backend read policy, with boundary checks at 120,000/120,001 and 300,000/300,001 ms, missing/future heartbeat, explicit offline, resumed processing and independent live/replay records. Consumer wording must agree across status, dashboard and brief. Preserve current live operation while reviewing this proposal.

## Handoff and current limits

The final private audit handoff indexes all seven captured outage bodies and the retained post-job empty outboxes. Its new local reload pair uses a fixed read clock and byte-identical snapshot copy; full before/after replay and live responses match, as do the original persisted measurement records. The private handoff distinguishes newly captured reload responses from the missing original after-response bytes. No result or scientific-approval change follows from retaining them.

Extended operation, actual source-stream outages, GPU abrupt termination/timeout, disk-full/power loss and shared hosting remain open. Those checks require separately coordinated scope; they are not authorizations to disturb the live worker or application.
