# Isolated delivery reliability

**Owner:** Mert
**Updated:** 8 November 2026, 00:27 America/New_York / 05:27 UTC
**Status:** Controlled HTTP and bounded GPU replay delivery checks pass. Abrupt-loss offline semantics remain an explicit gap.

The listeners, stores, tokens and queues in this lane are independent of the live camera-222 application. The approved camera-222 geometry, traversal context and server registry are copied privately without changing Carter's approvals. No test requests enter the live application. Public results contain scalar conclusions and hashes; raw payloads, temporary identities, footage, weights and credentials remain in ignored private directories.

## Controlled result

`python3 evaluation/reliability/check.py --profile runs/222-approved-handoff --directory runs/reliability/<new-directory>` runs the existing crossing/traversal producers, durable publisher and production HTTP handlers against an isolated backend process. Its trajectories are controlled software inputs, **not actual video or accuracy evidence**. They are explicitly labeled here even though the isolated transport uses replay mode to exercise the copied profile.

| Check | Observed result |
|---|---|
| Actual HTTP delivery outage | Two queued aggregate/measurement batches retained their exact bytes after HTTP 503. No backend snapshot was created during the outage. |
| Publisher recreation | New outbox instances resumed the same private files. |
| Lost acknowledgement after durable commit | The client retained its batch; exact retry returned one duplicate receipt. One crossing and one completed controlled traversal remained. |
| Backend process restart | Minutes, registry resolution, scenario and evidence references reloaded identically. Snapshot bytes remained unchanged. |
| Replay isolation | Live traffic rows remained empty. |
| Overlapping new run | Expected HTTP 409 preserved the rejected queue and committed snapshot. This is fail-closed overlap handling, not a retry recovery failure. |
| Abrupt publication loss | After 122 seconds of real wall time without another status publication, stored state remained `live` while displayed state became `degraded`. |
| Graceful completion | An explicit ended run/offline status displayed `offline`. |

The backend currently has no later read-clock threshold that changes a lost worker's displayed state from degraded to offline. This check records that limitation; it does not claim abrupt-loss offline acceptance. The worker's own source-stall status logic is separate and cannot publish after the worker process has disappeared. No core status or contract changes are made in this lane; the threshold decision is proposed to Mert's backend lane.

`node --import tsx --test backend/test/reliability.test.ts` also passed all six existing persistence/acknowledgement tests. Both Python drivers passed compilation. The new HTTP harness is an executable acceptance check rather than a change to runtime defaults.

## Bounded replay procedure

`replay.sbatch` caps one separately coordinated allocation at five minutes and one MIG slice. `replay.py` runs a single 100-second camera-222 replay through `worker.main`, using frozen source/config hashes and the existing verified pretrained model and local clip. No live source acquisition, new training, threshold change or replacement approval occurs. Preview publication is disabled in this transport check.

The private controller starts `check.py --serve --port <isolated-port>`, puts its proxy in `outage` mode, then waits for the replay driver to preserve at least six exact durable outbox files and verify their hashes three seconds later. The controller changes the proxy to `drop_ack`: one accepted POST loses its acknowledgement, and subsequent POSTs pass through. The job must finish with empty aggregate and measurement queues. Before acceptance, compare every captured body hash with a successful HTTP receipt, verify a duplicate receipt for the dropped acknowledgement, query replay/live separation, restart only this backend, and compare evidence/traffic/estimated-emissions records again.

Only the job's own compute relay and token are cleaned up. The local owned reverse forward is cancelled by its exact address; the authenticated master and the live application's existing relays remain intact. Private manifests retain the source, clip, model, profile, clock, scheduler and evidence hashes. The completed job and post-run checks are recorded below.

## GPU replay result

[Job 176092 scalar results](./result-176092.json) record **COMPLETED, 0:0, 1 minute 50 seconds**, with a five-minute wall cap and one H100 MIG 1g.10gb slice. Actual inference used `cuda:0`. The replay processed 1,333 frames over the requested 100 seconds with zero reader buffer drops in this bounded run.

| Acceptance evidence | Result |
|---|---|
| Real delivery outage | 11 HTTP 503 POST responses; seven durable queued bodies captured and rechecked unchanged after three seconds. |
| Restoration | All seven captured body hashes matched successful receipts. One committed request lost its acknowledgement; one exact retry was acknowledged as a duplicate. |
| Queue drain | Aggregate: 36 delivered, 48 attempts, zero pending. Measurement: 20 delivered, zero pending. |
| Traffic integrity | 32 crossings and eight unique completed traversals match runtime diagnostics and the persisted read path. |
| Estimated emissions integrity | Each supported minute equals its per-traversal contribution sum. Supported-minute-only totals: 35.7414593755 g CO₂ and 0.00653373649243 g NOₓ. Complete-window totals remain null because another minute lacks sufficient evidence. |
| Process restart | Fresh backend process preserves measurement minutes, evidence references, registry/scenario output, traffic/emissions records and snapshot bytes. Backend source hashes were checked before restart. |
| Mode and shutdown | Isolated live traffic/emissions rows remain empty; final replay state is offline. |
| Cleanup | Owned compute relay and exact login reverse forward are closed, remote token removed, allocation released. Live job 176075 remains running. |

The initial reload verifier assertion compared whole read envelopes, including `from`/`to` window timestamps that advance between requests. Inspection found those were the only differences; record rows and totals already matched. The verifier now compares persisted fields while excluding those two clock-dependent envelope fields, and the rerun passes. The failed assertion and correction are retained privately; this was a verification-method error, not a recovered runtime defect.

The batch warning signal is forwarded to the owned driver, which terminates/waits for its worker and closes its relay. CPU dummy-child checks verify shell TERM forwarding and exit cleanup; an intentionally failed preflight also removes the temporary token. No extra GPU allocation was used for these cleanup checks. The actual replay completed normally; scheduler-timeout cleanup and abrupt mid-inference termination were not exercised on the GPU.

## Limits

This is bounded delivery recovery, not multi-hour availability, source-stream outage recovery, field accuracy, surveyed calibration, disk-full/power-loss durability or multi-instance hosting acceptance. Camera-222 movement distance, class mixture and weather remain Carter's documented modeling assumptions. Estimated media UTC is not verified capture UTC. Missing stopped-time evidence, unsupported complete-window estimates and positive shorter-stop scenarios remain unavailable. Queue retention is bounded by the existing publisher/backend capacities and retention horizons.
