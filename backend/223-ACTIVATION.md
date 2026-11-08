# Camera 223 isolated integration and activation plan

**Owner:** Mert
**Updated:** 8 November 2026, 00:32 America/New_York / 05:32 UTC
**Status:** Prepared and checked on private cloned records. No production cutover or inference submission executed.

## Ready isolated replay target

Use private `runs/223-replay-runtime/ready.json` as the exact handoff. It points to the independently supervised production application at **`http://127.0.0.1:3139`**, its separate store/registry/token, immutable source/config/media hashes and actual acceptance checks. The live 222 app stays on **3138**, with its own store and original registry. Do not send 223 to 3138 during this checkpoint.

UI profile support is published in `87b7dd6`; the durable 3139 build includes it. Worker/measurement ingestion and preview POST/GET belong to the same Node process as the dashboard. The GPU operator must use one separately owned loopback SSH reverse forward to 3139 and route all three writer URLs through that same forwarded base. Use only this app's private token from its handoff path; never put it in a command argument, shared prompt, Git or log.

Mert's root coordination releases the single bounded 223 replay only after resource limits and the earlier reliability allocation are resolved. The prepared command uses existing verified pretrained weights, camera 223, CUDA, 640 pixels, 15 requested FPS, count-1, exact `223-image-v2` geometry and supplied mapping-linked traversal config, 90 seconds, transient previews and fresh replay outboxes. It selects only the reviewed practice extraction documented in [223-HANDOFF.md](./223-HANDOFF.md). This plan submits no job or live 223 run.

## Replay acceptance

1. Verify source/archive, model, geometry, traversal, combined-registry and replay-media hashes before inference. Save actual job/device/settings and final status. Keep 223's new run/outbox identities independent from camera 222.
2. Read `/api/measurements?camera=223&mode=replay` and the public camera view. Approval alone must produce no observations or numbers. After actual replay, require real crossings and completed candidates plus at least one supported pollutant minute before claiming physical delivery. If the run produces none, retain and report that outcome; do not manufacture traversals, alias classes or retune geometry in this check.
3. Authenticate each new 223 evidence reference and verify camera, replay mode, approved versions, source-clock timing, null linked stops and server-applied 15 m for each supported contributing traversal. Check pollutant contributions against their supported minute rows. Preserve nulls for empty, unmapped or otherwise unsupported cohorts.
4. Positive stopped-time scenario grams/changes remain null. Zero reduction preserves only a supported matching baseline. A ready minute is not a whole-window total when another minute is unavailable. Keep fleet/weather/path assumptions and assisted-reference limitations visible.
5. Verify actual replay frames and processing times advance through the same app, with visible replay labeling and correct 15 m scope. Preview absence before a worker is expected. Confirm outboxes drain and worker end metadata is retained; do not delete queues to hide failures.
6. Preserve all captured 222 sources/calculations in this clone, show no invented 223 live totals, and verify original 3138 process/registry remain unchanged. Its live store may advance naturally. Retain private evidence and a safe scalar result; an integration pass is not count/traversal field accuracy.

## Future production cutover, not executed

The current independent app allows replay acceptance without a 222 outage. A later combined production deployment is a separate coordinated operation:

1. Freeze the accepted UI/backend build and exact combined registry. Preserve the existing production build/registry/runtime pointers and an atomic store backup privately, including old calculation bodies and evidence-reference mapping. Check the relevant records remain within the documented 24-hour retention horizon.
2. Coordinate a short sender pause or buffered delivery interval. Keep existing worker/outbox state intact. Ensure only one active ingestion/preview/dashboard process owns the production endpoint; a candidate must stay on a cloned store until cutover.
3. Start the compatible build with the unchanged authoritative production store and private credential, selecting the approved combined registry. This requires a planned application transition; do not edit or restart the live 3138 instance as part of preparation. Existing cached physics may be temporarily unavailable until derivation refresh and must never be presented as zero.
4. Call the existing authenticated **POST `/api/measurements/refresh` with `{}`**. Require configured registry, expected revision, valid full stored snapshot and current evidence for every nonretracted retained entry. Compare all immutable source/revision/identity/time/observation fields and retained 222 calculations, including records outside the rolling hour. Repeated refresh should report zero changes.
5. Verify mode separation, correct old/new profile disclosures, supported-minute and incomplete-window behavior, authentication and source/evidence integrity before resuming delivery. Genuine frames must repopulate the new process's preview memory. Recheck advancing 222 heartbeats/frames and retained estimates; only then schedule any separately authorized 223 live operation.

Do not re-ingest a stored private `source`: its identities are already hashed and its digest describes the original wire envelope. Refresh through the existing route instead. Registry changes replace evidence references even when numerical inputs are identical; archive the old calculation bodies/reference map before cutover. Retention pruning remains real and is not disabled by this plan.

## Rollback

If startup, authentication, identity preservation, calculations, UI scope or current evidence checks fail, pause candidate delivery and preserve its queues/artifacts. Restore the previous verified application/registry selection, then call authenticated refresh again. Restoring the registry alone leaves stale derivations unavailable.

**Do not restore an old whole-store backup after legitimate new writes have been accepted.** Preserve those sources and revisions; rederive under the previous registry. Any new 223 source may remain retained as observations while unsupported physics becomes unavailable under the old 222-only registry. Treat unexplained source corruption as a separate recovery problem, retaining both generations.

The private 222-only snapshot test has already exercised combined refresh, idempotence, rollback and reinstallation: **16 entries/172 worker batches preserved, zero calculation differences, exact canonical snapshot and original evidence references restored on rollback**. This demonstrates the narrow registry path on the captured data; it does not prove future rollback with new 223 sources, a forced live transport failure or a zero-downtime production transition.

No contract change is proposed. Core worker 1.1 and measurement 1.0, source timestamps, scientific approvals and existing uncertainty/null rules remain intact.
