# Engineering integration readiness

**Owner:** Mert
**Updated:** 7 November 2026, 19:41 America/New_York / 8 November 2026, 00:41 UTC
**Status:** First engineering software checkpoint complete; live measurement-to-emissions acceptance remains open.
**Authority:** [Plan.md](../Plan.md), [Coordination.md](../Coordination.md), contract 1.1.

## Acceptance and current boundary

The next live milestone requires one camera to produce reviewed crossings and calibrated completed traversals, server-side traceable CO₂/NOₓ estimates, persisted evidence, and a shorter-stop comparison. The complete live emissions path is **not finished**. It requires additional code as well as physical evidence; it is not only configuration work.

| Layer | Current implementation | Remaining dependency |
|---|---|---|
| GPU ingestion/tracking | Four independent pipelines and bounded status/preview delivery demonstrated. | Longer runs, controlled source interruptions, held-out traffic/tracking evaluation. |
| Image observations | Reviewed geometry can drive selected-gate crossings and optional image-space queues. Repository example is disabled. | Scientific review of actual camera configurations and crossing error. Saving a drawing does not validate it. |
| Completed traversals | Standalone estimator accepts a supplied completed cohort. Worker aggregation still leaves distance, completed traversals, traversal time and stopped seconds null. | Entry/exit traversal producer and approved physical calibration, with explicit run/session and clock provenance. |
| Emissions | Validated CARB RUNEX catalog and per-completed-traversal arithmetic exist. Worker emits no emissions. | Trusted calibration/class-mapping registries, server orchestration and authoritative composed minute writes. |
| Scenarios | Independent per-traversal calculator/report is implemented and tested on explicit synthetic inputs. Aggregate-only dashboard API still has null grams, and now suppresses nonzero-change traversal time when its stopped cohort is not linked. | Persisted completed-cohort evidence and an agreed additive UI/brief handoff; minute-average factors are not a substitute. |
| Persistence | Validated atomic single-host file store and revisioned worker batches. | Shared hosted adapter and a versioned calculation-evidence ledger. Existing SQL drafts are not applied. |
| Previews | Exact frame/overlay pairs expire in one Node process within 60 seconds. | Single-process deployment or an explicitly shared ephemeral transport; multi-instance memory is not shared. |

## Proposed measurement-to-calculation handoff

Coordination accepted the internal per-completed-traversal stopped-time calculation path in `da94f99`. The scientific [measurement-readiness proposal](./measurement-readiness.md) agrees on completion-minute attribution and separate observed-versus-completed stopped cohorts. Registry/evidence publication details below remain proposals, not permission to mark geometry valid or enable a class mixture. Core contract 1.1 records are retained. No new required worker-packet fields or calibration registry are silently activated.

1. **One coherent source scope:** camera ID, worker run, live/replay/synthetic mode, UTC reporting minute, immutable observation revision and time basis. The existing media clock is estimated HLS UTC (`t:hls-min-anchor-v1`), not verified capture UTC. A replay clock describes playback unless original recording context is supplied.
2. **Completed cohort:** existing `CompletedTraversal` fields (`session_id`, opaque `traversal_id`, `completed_at`, `vehicle_class`, `distance_m`, `traversal_time_s`) plus optional per-traversal `stopped_time_s`. The producer must observe the configured entry-to-exit path within one camera session. Distances need independently supported road calibration. Completion timestamps must fall in the requested reporting minute; convert UTC `+00:00` values to canonical `Z` at the boundary without pretending capture UTC was measured.
3. **Stopped-time cohort:** per-traversal stopped seconds refer to those same completed vehicles, within their own total traversal times. `traffic_minute.stopped_vehicle_seconds` can include other vehicles still in view; it cannot be subtracted from completed traversal time as if the cohorts matched.
4. **Trusted calibration registry:** use the existing `CameraCalibration` ID/version/status/gates/reference-measurements/transform shape. The scientific stream must propose the concrete reference/transform representation, coordinate frame, measured units, independent validation evidence and validity limits. A versioned JSON carrier shared by Python and the server is preferred to two manually divergent registries, subject to coordination. The current server registry remains missing for every camera. A worker's assertion of `valid` is not approval.
5. **Explicit mapping registry:** engineering can load a versioned `ClassMapping` only after its VMT weights and evidence/scenario assumptions are reviewed. No default car-to-LDA, truck-weight mixture or Tesla EV discount enters live totals. The retained CARB factors already include regional fuel/model-year mixtures. Temperature/humidity remain explicit supported assumptions, not current weather observations.
6. **Calculation evidence:** retain calibration/mapping/factor/method versions, meteorology, source run/revision/time basis and per-traversal factor/bin contributions under a private evidence reference. Keep raw footage, plate/person identities and model weights out of this ledger. Opaque traversal identities exist only for camera/session deduplication and traceability; they are not cross-camera vehicle identities.

### Proposed server composition boundary

The implemented [build_completed_traversal_report](../backend/TRAVERSAL-REPORT.md) is a pure calculation/report boundary: validated supplied traversals → contract-shaped completion aggregates + emissions + optional per-traversal scenario evidence. Its stage is `calculation_only`; it does not register calibration, publish a live record, overwrite a crossing snapshot or write persistence.

Crossing counts and completed traversals are different observations. The report leaves line `count`, all-observed stopped seconds, queue and coverage unavailable unless their proper producer supplies them. Before publication, a server orchestrator must compose the crossing snapshot with the completed-cohort output for the **same** camera/run/mode/minute/revision. Blindly upserting report rows with null counts over worker crossing rows would erase supported counts; summing the two would also be wrong.

The authoritative composed batch should update traffic and both pollutant rows together, with matching evidence/revision references. If media-clock alignment changes a reporting minute, retract/recompute its dependent traffic, emissions and scenarios coherently; the current empty-revision mechanism must not leave old emissions behind in another batch. A private evidence table/ledger and the registry/transport linkage need a concrete proposal and coordination decision before a producer/consumer contract changes. No migration is applied in this checkpoint. The legacy aggregate-only scenario no longer subtracts general observation-minute stops from completed-cohort duration; nonzero changes withhold scenario traversal time until linked per-traversal evidence exists.

## Independent scenario calculation

The implemented [scenario engine](../emissions/SCENARIOS.md) uses the existing per-traversal RUNEX estimator with identical calibration, class mapping, factor catalog and meteorology on both sides. For each completed vehicle, hold distance and the original cohort fixed and set:

```text
scenario traversal time = observed total time - observed stopped time × reduction fraction
```

Then select each traversal's own speed bin and sum its grams. Do not apply a nonlinear factor to a whole-minute average. Stops are already included in RUNEX; add no separate ordinary-idle term. Missing stopped evidence or a zero remaining duration withholds the scenario instead of inventing zero emissions or infinite speed. Zero reduction may return the unchanged supported baseline. A faster scenario can increase a pollutant estimate across factor bins; do not clamp it to a saving.

The cohort retains its original reporting membership for comparison. This is not a prediction that signal changes move the same vehicles between minutes, and it omits network effects and displaced queues. Unsupported EV replacement and statistical confidence intervals remain out of scope. Explicit synthetic calibration/mapping inputs can verify this arithmetic without activating them for a real camera.

## Reliability coverage and topology

Published GPU evidence covers a 120-second four-camera benchmark and a separate 90-second local delivery run, with 82 measurement buffer drops in the benchmark. This does not establish six-hour reliability or forced source-outage recovery. Stream reconnect unit tests use scripted capture failures; tracker callback tests check actual persistence/reset on synthetic boxes. HTTP/outbox tests cover transient failures and exact retry identity, while backend tests cover atomic revisions, corrupt-store failure and receipt ordering. These must not be described as a forced live HLS outage.

A deployable first topology can retain the current stack: **one persistent Node application process**, a private durable POSIX data volume, server-side worker credential, and an authenticated outbound worker connection through TLS or the verified SSH relay. No public GPU endpoint is needed. This is a topology proposal, not a provisioned deployment. Review TLS, backup/restore and credential provisioning before publication; none is created by this checkpoint.

For independent application instances or a serverless frontend, replace local persistence with a shared database adapter and route reads/writes through the same authority. Existing sync query/store calls would need an explicit async/read-adapter boundary; copying a local JSON file into a serverless filesystem is not shared persistence. Keep preview JPEGs in a separate latest-frame transport/cache with bounded TTL and camera/mode isolation, or route them through one persistent preview service. Do not persist raw previews as long-term database evidence. Current per-process memory cannot support random load-balanced preview reads.

## Next dependencies

- Scientific stream: measurement-readiness proposal, actual reviewed image geometry, entry/exit and reference/transform representation, independently supported distances and per-completed-vehicle stopped evidence.
- Coordination: approve calibration registry/clock/observation-revision linkage, calculation-evidence persistence and authoritative composed minute ownership before incompatible interfaces are implemented.
- Engineering: the pure report/scenario checkpoint is complete. Next implement the approved producer/orchestrator/persistence wiring. Live emissions remain unavailable until both code and evidence pass.
- Dashboard: consume explicit per-pollutant scenario evidence after that handoff; retain existing nulls while no supported source exists. Aggregate-only scenario grams remain unfinished.

## Completed checkpoint and exact verification

- `displayedState` preserves an explicitly stored offline state as its last heartbeat ages. Stale active states still become degraded. A focused regression covers both behaviors.
- `build_completed_traversal_report` validates supplied cohorts, produces existing completion aggregates and per-traversal estimated emissions, and optionally attaches a separate hypothetical scenario. `count`, general-observation stopped seconds, queues and coverage remain null. This function writes no store and approves no calibration.
- `compare_completed_traversal_scenario` computes baseline/scenario per vehicle, preserves the original cohort, and returns signed CO₂/NOₓ changes. Tests use retained factors with explicitly synthetic calibration and mapping assumptions; no live configuration is activated.
- Aggregate-only `compare_scenario` retains the illustrative stopped-time reduction but withholds nonzero-change traversal durations/speeds/grams because road-wide stops are not a completed cohort. Zero change can preserve original supported traversal duration.
- A narrow recovery-claim fix serializes stale writer-lock reapers and rereads the current owner before deletion. [Six reliability checks](../backend/RELIABILITY.md) cover active-owner contention, confirmed dead-owner recovery, held recovery claims, controlled concurrent reapers, independent atomic readers, failed transactions and a lost HTTP acknowledgement followed by an idempotent retry. An abandoned recovery claim fails closed and requires controlled operator recovery; it is not recursively reaped.

Verification on this checkpoint: `npm test` passes **82 backend tests**; `npx tsc -p backend/tsconfig.json` and `npx tsc -p contracts/tsconfig.json` pass. The 12 scenario tests and 11 report tests exercise supported synthetic inputs, nonlinear bins, missing evidence, mode/window/identity validation and input immutability. Initial test-orchestration and expectation errors were corrected before the passing runs. No production web build is run by engineering during this wave; dashboard acceptance owns that build and coordination arranges combined validation. No new GPU job, training, hosting, source-stream collection, public port or camera activation occurs in this checkpoint.

## Rough effort and next dependency

The immediate target remains the existing persistent single-host demonstration. This is a dependency assessment, not a promised delivery time:

| Remaining software work | Relative effort after accepted inputs | Required first |
|---|---|---|
| Same-session entry/exit producer with per-traversal stopped evidence and continuity rejection | Medium, one or two focused implementation/clip-test checkpoints | Scientific movement/gate semantics, actual reviewed geometry, supported distance method and stopped policy. |
| Trusted calibration/mapping loader and authoritative composed traffic/emissions writer with private evidence revisions | Medium, one coordinated checkpoint plus tests | Approved shared representation, version/provenance linkage and explicit mapping assumptions. |
| Scenario/read/brief handoff and one-camera delivery/replay/outage acceptance | One combined checkpoint | Persisted accepted cohort/evidence and coordinated UI per-pollutant consumption. |
| Multi-instance hosting | Deferred | Complete and rehearse the single-host path first. |

Missing physical references and independent held-out validation can block live acceptance regardless of software progress. They have no credible completion time derived from this engineering checkpoint. No camera/class evidence is replaced by the synthetic test fixtures.
