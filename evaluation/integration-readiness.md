# Engineering integration readiness

**Owner:** Mert
**Updated:** 7 November 2026, 21:04 America/New_York / 8 November 2026, 02:04 UTC
**Status:** Persistent server measurement/scenario and opt-in runtime software path complete; real scientific acceptance remains open.
**Authority:** [Plan.md](../Plan.md), [Coordination.md](../Coordination.md), core contract 1.1 and the separately versioned [measurement interface](../backend/MEASUREMENT-INGESTION.md).

## Current software path

| Layer | Delivered behavior | Remaining dependency |
|---|---|---|
| GPU ingestion/tracking | Independent camera pipelines, estimated media clock, bounded status/preview delivery, and selected-gate image observations. | Longer forced-failure runs and accepted held-out crossing/tracking checks. |
| Completed traversals | Isolated producer with entry/exit, same-session continuity, source-gap rejection, linked stopped intervals and explicit unavailable states. | Runtime/config/publisher adapter is connected and default-disabled. Actual accepted movement and stopped policies remain required. |
| Registry | Strict versioned server JSON loader checks review/evidence, camera/mode/time scope, gate references, nonsingular metre transform, fixed movement distances and CARB VMT weights. Default has no approval. | Independently supported real calibration and reviewed class mixtures must be installed privately. |
| Ingestion/evidence | Authenticated separately versioned v1.0 snapshots; hashed private session/traversal identities; source revisions, traffic, CO₂/NOₓ and private contributions in one POSIX snapshot commit. | Single-host persistent volume/credential configuration. A shared hosted adapter is deferred. |
| Corrections | Exact retries, same-revision content denial, higher-revision replacement, corrected minutes, explicit retraction, cross-run/minute ownership and duplicate completed identities. Linked worker revisions invalidate physics atomically. | Source video overlap across reconnects remains a review problem; identities do not deduplicate repeated footage across sessions. |
| Read/scenario/brief | Existing aggregate reads consume composed results. Per-traversal scenarios keep the original cohort, apply nonlinear factors per vehicle and expose signed CO₂/NOₓ differences. Briefs include quantities and evidence references. | UI owns thin routes, render/export checks and the combined production build. No physical quantity is inferred from a fixture. |
| Revocation/privacy | Registry fingerprint changes immediately suppress cached distance/grams; authenticated refresh or exact source retry recomputes derivations. Public summaries contain no private traversal/session IDs or registry paths. | Historical detailed calculation bodies are not retained after correction; only current evidence and up to 64 superseded source receipt hashes per batch. |
| Previews | Matching frame/overlay pairs expire within 60 seconds in one Node process. | Multi-instance deployment needs explicitly shared latest-frame transport; memory is not shared between processes. |

## Observation and scientific boundaries

Crossings and general observed stopped seconds are independent of completed entry-to-exit traversals. Composition preserves supported count, image queue, general stopped and coverage columns; completion-only nulls do not erase them. Completed-cohort stopped time is linked to those same completed vehicles and is never substituted with the road-wide minute stopped total. No cohort or a queue that has not cleared yields insufficient evidence, never zero grams.

The producer requests versions/movement IDs; the server resolves approval and fixed supported metre distances. Worker distances, transforms, valid flags and gram totals are unsupported transport fields. Synthetic-only review records cannot enable live/replay. Calibration validity checks include the observation source interval; public readiness describes approval at the reporting clock. Historical per-minute validity can differ from current readiness.

Only RUNEX is used; ordinary driving-cycle stops are already included. No additional ordinary-idle term, engine-running claim, EV discount or uncertainty interval is introduced. Unknown/unmapped classes withhold the whole pollutant total. Temperature/humidity are explicit assumptions within the retained Los Angeles (SC), 2026 factor scope. No current weather observation is implied.

## Timing, identity and atomicity

Source UTC is explicitly estimated as `min(received_at - media_time) + media_time` per camera session. It does not establish capture UTC or minimum transport delay. Advancing-frame processing heartbeats still determine status freshness. Reconnects have independent clocks and identities. Cross-run overlap conflicts rather than silently overwriting counts; repeated source footage needs independent review.

One writer lock and one fsynced atomic file replacement commit the authoritative source revision, composed traffic, both pollutant rows and private evidence. There is no second independently renamed evidence file presented as a transaction. Worker 1.1 remains accepted unchanged; observation reference changes trigger dependent recalculation/withholding under that same transaction. A measurement UUID correction may move its minute; the old derived minute disappears when the replacement commits. Retraction removes measurement-owned results and preserves independently supplied legacy observations. Exact retries never increment counts.

The local snapshot retains up to 5,000 worker batches and 1,000 measurement batches, bounded by a 24-hour acceptance horizon and a shared 32 MiB ceiling. Corruption fails closed and preserves the file. Source identities are hashed with camera/run scope before persistence. Public scenarios, brief/export text and measurement/camera reads contain aggregates/evidence references only; per-traversal contributions require bearer authentication.

## Scenario binding

For each original completed vehicle:

```text
scenario traversal time = observed total time - linked stopped time × reduction fraction
```

Keep distance, original reporting membership, class mix, meteorology and factor catalog fixed. Select each vehicle's scenario speed bin before summing. Signed changes may increase a pollutant; do not clamp them to savings. Missing linked stopped evidence withholds positive-reduction scenarios while retaining supported baseline estimates. Zero reduction may preserve baseline without stopped evidence. A zero remaining duration or speed outside factor support withholds the requested scenario. Hypothetical outputs never enter observed live totals.

The additive public scenario fields name CO₂ and NOₓ separately. The legacy unlabeled `estimate_g` remains null. General observation stopped seconds retain their original descriptive meaning; the explicit `completed_cohort` reports the linked comparison cohort.

## Verification completed at the server checkpoint

`npm test -w @emission-lens/backend` passes **99 tests**; `npx tsc -p backend/tsconfig.json` and `npx tsc -p contracts/tsconfig.json` pass. Seventeen new measurement integration checks cover ingest → durable reload → reads → per-pollutant scenario → brief, source integrity and privacy, immutable retries, revisions/retractions/clock corrections, mode/run overlap, missing/unapproved/time-scoped registries, immediate revocation, observation-reference changes, missing stops, unknown classes/movements, HTTP authentication and body/query bounds. Approval records exist only in temporary synthetic test stores.

The preceding 82-test checkpoint includes pure estimator/report/scenario arithmetic and independent atomic reader, failed commit, lost acknowledgement and stale-lock recovery checks. An abandoned recovery claim fails closed rather than being recursively reaped. These tests do not constitute a forced live HLS outage or measured crossing accuracy.

Engineering does not run the production web build during this shared wave; UI owns it and coordination runs independent final HTTP acceptance. No new GPU training, model promotion, hosting, public port, physical calibration or production class mapping is activated here.

## Remaining acceptance

1. Runtime wiring and [private configuration/setup](../worker/RUNTIME-MEASUREMENTS.md) are complete. Install reviewed inputs when available; default camera/physical approvals remain disabled/missing.
2. UI/coordination finish combined route/render/export and HTTP restart/revocation checks on a stable published revision.
3. Install independently supported calibration and accepted movement/class/stopped evidence privately after Mert/Carter count review; demonstrate one camera end to end before expansion.
4. Run the actual configured pipeline through bounded source outage/reconnect/restart and replay acceptance, then rehearse the demonstration and retain its limitations.
5. Provision shared hosted storage only if moving beyond the persistent single-host topology. Promise-based ingestion transactions are ready for an adapter; synchronous compatibility reads still require deliberate migration.

Missing physical references and held-out validation can block live acceptance regardless of software progress. No synthetic test fixture replaces that evidence or supplies a credible field-acceptance time.

**Runtime verification (7 November 2026, 21:04 America/New_York / 8 November 2026, 02:04 UTC):** Nine focused adapter/orchestration tests cover actual main-loop sender binding with simulated frames, linked stops, source-clock rebins, legacy reference updates, cross-session rejection and forced partial enqueue/restart. Outbox/checkpoint ordering persists the complete plan before any dependent delivery. Existing producer/bridge tests independently validate actual TypeScript parser and server ingestion compatibility. This checkpoint starts no detector, GPU job, training, source-media collection or real calibration activation.

**Final engineering checks (7 November 2026, 21:04 America/New_York / 8 November 2026, 02:04 UTC):** 99 backend tests and backend/contract type checks pass. The focused worker suite passes 172 tests plus 112 subtests with isolated pinned Python dependencies, including nine adapter/main-loop checks and the committed producer/bridge's TypeScript parser/server compatibility checks. Measurement-only runs now retain established device and final end metadata across multiple minute snapshots, preserving restart/provenance denial. The three reviewed window/timestamp/identity boundaries have focused regressions. Scientific evidence and the real configured delivery/replay/outage checkpoint remain open.
