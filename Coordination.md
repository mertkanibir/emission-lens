# Implementation coordination

**Owner:** Mert

**Updated:** 7 November 2026, 21:54 America/New_York / 8 November 2026, 02:54 UTC

Mert authorized centralized project coordination on 7 November 2026. `Plan.md` remains the master plan. This record allocates the next implementation checkpoints; it does not certify unfinished measurements or alter contract 1.1.

## Next acceptance milestone

One selected camera must demonstrate reviewed line crossings, independently supported physical calibration, completed entry-to-exit traversals, explicit visual-to-CARB assumptions, persisted estimated CO₂/NOₓ, and a baseline/scenario comparison with traceable evidence. Missing scientific inputs must remain unavailable. Extend the verified path to the other cameras only after this checkpoint.

## Current work allocation

| Work stream | Direction | Owned implementation paths | First checkpoint |
|---|---|---|---|
| Engineering integration | Mert | `backend/`, `contracts/`, `emissions/`, `infra/`; `worker/main.py`, `worker/aggregate.py`, `worker/publish.py`, `worker/timing.py`; their focused tests; `evaluation/integration-readiness.md` | Fix stale-offline display semantics, establish an agreed measurement handoff, and implement/test the remaining traffic-to-emissions and scenario integration without inventing calibration or class weights. |
| Scientific evidence and calibration | Mert coordinates, Carter retains labeling/training ownership | `config/cameras/`; `worker/metrics.py`, `worker/draw_geometry.py`, new calibration modules; matching focused tests; `evaluation/measurement-readiness.md` and new calibration evidence | Inventory actual geometry and reference evidence, preserve Carter's work, and provide a concrete reviewable per-camera measurement/calibration proposal with supported inputs and explicit blockers. No geometry is enabled merely by saving a drawing. |
| Dashboard acceptance | Mert | `frontend/`, `design-qa.md`; no backend or worker edits | Preserve the tan/green design; make readiness, stopped/live/degraded state, missing measurements, scenario assumptions, brief export and mode separation clear, then verify desktop/phone interactions. |
| Project direction and integration review | Mert | `Plan.md`, `Agents.md`, root `README.md`, this file; cross-stream decisions and final acceptance | Resolve handoff conflicts, prioritize blockers, inspect evidence and test results, and maintain the final demo/submission checklist. |

Each stream owns its package documentation and must add its own narrow timestamped `Worklog.md` entry under the repository rules. Shared root documentation is maintained by Mert's coordination stream. Existing scientific factor source bytes and evaluation records must be preserved.

## Dependencies and boundaries

1. The scientific stream publishes its measurement-readiness proposal before incompatible engineering interfaces are implemented. Existing contract 1.1 fields are preferred. Changing a producer/consumer contract requires an explicit proposal and coordination decision first.
2. The engineering stream implements and verifies supported data paths even when a physical camera input is unavailable. Synthetic arithmetic remains labeled and never enters live totals. It must distinguish ready code from field-validated outputs.
3. The dashboard stream reads the existing backend types and coordinates any new field requirements before changing their meaning. It does not activate measurement configurations or create emissions values for display.
4. Carter's dataset, labels, detector/tracker configuration and training results remain untouched. No new training, model promotion or rare-class accuracy claim is needed for this milestone. Any scientific mapping is documented as an assumption/proposal until evidence supports its use.
5. All work uses the existing shared checkout. Never discard, stash, reset or commit another stream's edits. Commit only explicitly owned paths and the stream's own worklog entry. Reread shared files before narrow edits; do not reformat the whole worklog. Coordinate before competing Git-index operations or production builds.
6. Preserve local servers and private runtime configuration. Reliability checks must use their own bounded ports/outboxes, protect active jobs and release allocations. No secret, footage, model weight or private download capability enters Git or coordination messages.

## Following checkpoints

- Test longer operation and forced outages; verify reconnect/overlap handling and the actual runtime model/settings on held-out traffic footage.
- Decide and implement a deployable persistence/preview topology. The current file store and in-memory previews support one persistent application host, not independent serverless instances.
- Validate live scenario inputs and defensible sensitivity ranges. Per-traversal scenario grams and evidence-backed briefs now have a persisted software path; comprehensive uncertainty and field validation remain open.
- Add weather and nearby schools only after the core measurement path; keep community layers and further model tuning optional.
- Rehearse the complete live and labeled-replay demonstration, verify source/licence attribution and submission status, and ensure Mert and Carter can explain the system before 8 November 2026, 11:00 America/New_York.

## Reporting checkpoint

Every stream reports in its own conversation: completed paths and commit, commands/results, demonstrated behavior, remaining evidence gaps, and the next dependency. Mert reads those reports and progress snapshots centrally. No automatic external communication, fabricated measurements or promise of unattended monitoring is implied.

**Dispatch checkpoint (7 November 2026, 19:31 America/New_York / 8 November 2026, 00:31 UTC):** Mert sent the scoped engineering, scientific-evidence and dashboard assignments to the three existing work streams. All three acknowledged ownership and began work. Their checkpoints are in progress; no implementation result or scientific approval is implied by dispatch.

## Finish-line decisions — 7 November 2026, 19:38 America/New_York / 8 November 2026, 00:38 UTC

Mert directed the fastest complete, evidence-backed demonstration while continuing independent useful work in parallel. The existing persistent single-host architecture is the first operational target. Shared multi-instance/serverless hosting, additional context layers, further training and cosmetic redesign do not block that local acceptance checkpoint; they remain later work rather than silently certified features.

1. **Software checkpoint:** finish and publish the independent backend/scenario, calibration-arithmetic and dashboard-readiness work, then run combined checks on a stable revision. Synthetic inputs are explicitly labeled; passing arithmetic does not prove camera calibration.
2. **Scientific checkpoint:** obtain a camera-222 source clip and reviewed selected-gate events, independently scaled road references with held-out validation, documented class mappings and accepted calibrated completed traversals. If any input is absent, state the precise dependency and keep affected quantities unavailable. This remains required for the live-emissions milestone; its finish time is not inferred from code readiness.
3. **Operational checkpoint:** run the actual runtime settings through the demonstrated single-host delivery/replay path, perform bounded forced-outage and restart checks, verify evidence retention and mode separation, and rehearse the three-minute demonstration plus submission checklist. Expand accepted measurements to the other cameras after the first validated camera.

### Traversal/scenario handoff decision

Mert accepts the internal per-completed-traversal scenario input described in `evaluation/measurement-readiness.md` and the engineering `ScenarioTraversal` proposal: each completed traversal has its own `stopped_time_s`, or null when unavailable. It is distinct from `traffic_minute.stopped_vehicle_seconds`, which retains its general observation-minute meaning. Never subtract road-wide minute stopped seconds from a completed-traversal cohort's duration.

Keep original completion timestamps/cohort fixed for baseline/scenario comparison, compute speed and RUNEX factors per traversal before summing, retain signed changes, and withhold a positive-reduction scenario if linked stopped evidence is missing. Real outputs still require accepted calibration, class mapping and explicit meteorology. Hypothetical rows never enter observed live totals. Internal calculation inputs/evidence may be implemented and tested now. This approval does not change contract 1.1, authorize new public batch fields, or approve camera geometry/class mixtures; any persistence/transport extension needs a concrete schema and validation proposal first.

Engineering owns the integration/consumer side; the scientific stream owns the documented producer evidence and calibration primitives. The current scene-wide stopped total is not a substitute for traversal-linked evidence. These decisions remove the internal calculation handoff blocker while preserving the scientific acceptance gate.

## Ready-to-connect backend implementation — 7 November 2026, 20:25 America/New_York / 8 November 2026, 01:25 UTC

Mert directed completion of the independently implementable backend while Mert and Carter compare model counts with manual counts. This expands the next software checkpoint from calculation-only helpers to the producer, authenticated ingestion, approved server registries, durable evidence/composed estimates, and scenario/read/brief binding. Scientific approval, count acceptance, model selection and labeling remain with their existing review process.

- Engineering implements the registry/evidence/composition proposal in `evaluation/integration-readiness.md`: missing-by-default, server-controlled versioned calibration/mapping records; separately versioned additive measurement ingestion; explicit camera/run/mode/minute/revision and estimated-media timing; completed traversals with their own linked stopped time; atomic traffic/CO₂/NOₓ/private evidence publication and coherent retractions. Exact envelope/registry/read/handler structures must be published in `backend/MEASUREMENT-INGESTION.md` before implementation. Core worker contract 1.1 remains supported unchanged. Caller-supplied approval flags cannot authorize physical quantities.
- The producer stream owns only the new isolated `worker/traversal.py` component, its tests and `worker/TRAVERSALS.md`. It prepares deterministic gate/session/gap/stopped-interval mechanics using explicit configuration and synthetic trajectories. It does not alter model/tracker code, camera drawings or the active count review. Engineering owns its runtime/publisher integration.
- The dashboard stream owns thin frontend route adapters and the existing camera/scenario/brief consumers. It documents required fields first, consumes the published backend contract, and verifies per-pollutant baseline/scenario/signed differences, readiness and unchanged live/replay/synthetic separation. No design pass or invented measurements belongs to this checkpoint.

### Acceptance

Use controlled labeled fixtures to exercise authenticated ingest → durable reload → traffic/emissions reads → baseline/scenario → brief/export, plus denied/malformed/unapproved/missing evidence, duplicate/revision/retraction, reconnect/overlap and public-data privacy boundaries. Private traversal IDs and registry paths never enter public responses or exports. Atomically related records must share one authoritative commit; separate independent file renames are not presented as a database transaction.

A passing software path means reviewed inputs can be installed without another architectural rewrite. Actual live counts still require accepted gate/model checks; physical emissions require independently supported calibration and explicit class/meteorology assumptions. Shared hosted storage and a real Supabase project remain separate deployment configuration/adapter work; unavailable credentials or scientific evidence do not block completion of the working single-host software path.

## Software acceptance and supporting work — 7 November 2026, 21:08 America/New_York / 8 November 2026, 02:08 UTC

Mert verified the server measurement path using temporary synthetic-only registry approvals and an independently started production HTTP server. `evaluation/check_measurement_path.py` exercises authenticated ingest, exact retry, application stop/restart and durable reload, original retained CARB CSV rates, separate observation/completed cohorts, independent pollutant scenarios, private evidence authorization, exact brief attachment export, producer-distance rejection, immediate registry revocation and atomic retraction. All nine checks pass. Its fixed synthetic clock deliberately matches the application's labeled demo fixtures and must remain within ingestion retention; no real camera, mapping or field emission is approved by this test.

The completed traversal producer and measurement bridge are committed. Their synthetic checks include the actual TypeScript parser and isolated server ingestion, ordered partial clock rebins, immutable evidence identities, durable pending plans and unchanged-byte HTTP retries. Engineering's opt-in runtime adapter uses separate worker/measurement endpoints and outboxes, persists private bridge checkpoints before delivery and recovers pending plans before flushing. A simulated-frame check exercises the actual worker orchestration without a detector or GPU. Production camera settings remain disabled/unvalidated; reviewed settings and server approval records still have to be installed privately.

Dashboard routes now consume the measurement summaries and per-pollutant scenarios. Exact temperature/humidity assumptions survive mixed-minute windows and brief export; small NOₓ totals remain distinguishable from zero. Desktop/phone acceptance covers camera navigation, live/replay/synthetic separation, missing evidence, scenario bounds and local export. The finished cream/forest layout is preserved.

The combined checkpoint includes server/runtime revision `55bfaa1`, bridge `60ca6df`, dashboard `9e3b082` with final verification `95195ff`, and branding revision `d96ae5b`. Mert independently reran all 99 backend tests, 24 frontend tests using the frontend TypeScript configuration, 37 measurement/adapter tests, root type checks, production build and all nine production HTTP acceptance checks. Engineering also recorded 172 worker tests plus 112 subtests. The ignored duplicate generated route declaration was removed before the passing final build/type checks; its local recurrence and cleanup are documented in the dashboard acceptance record.

The separate [four GPU count comparisons and two-minute four-camera benchmark](./evaluation/count-check-175806.md) add bounded execution evidence. They ran the previous runtime revision, do not include the new configured measurement path, and do not establish accuracy: Carter's accepted manual crossing answer key remains pending. They do not replace the final configured replay/outage demonstration.

### Branding and contributor display

Mert reviewed the new Junction Lens identity direction for Emission Lens, then requested a green center leaf and thinner surrounding corner bars. Revision `d96ae5b` replaces the diamond with the leaf and reduces bar thickness from 12 to 7 units; all variants/icons retain their existing asset paths. The compact mark and favicon are integrated; vector wordmarks, reversed/monochrome variants and raster submission icons are available in `frontend/public/brand/`, with usage and font attribution in `branding/README.md`. Branding does not change scientific claims or camera readiness.

The Release & Submission Manager owns the stale GitHub contributor display. Current reachable main-history attribution and GitHub's contributor API were reconciled to Mert and Carter; the homepage still showed cached older contributors. A support request was submitted after Mert's separate approval. Repository-setting workarounds remain subject to their explicit approval and publication coordination. No history rewrite, forced push or successful display removal is implied by the support submission.

### Remaining gates

1. Mert and Carter finish the selected-gate count/tracking review; no labels, weights or runtime model promotion belongs to this backend checkpoint.
2. Accept one camera's geometry and independently supported physical movement calibration; approve documented visual-to-CARB assumptions and explicit meteorology, then install the versioned private settings/registry.
3. Demonstrate actual reviewed completed traversals through worker → persisted estimated CO₂/NOₓ → scenario → brief, followed by bounded forced-outage and labeled-replay rehearsal on the final runtime.
4. Configure a shared hosted database and preview topology if the demo must run beyond the verified single persistent host. Supabase is not yet provisioned or wired.
5. Finish Devpost/demo materials and final rehearsal; contributor-cache resolution remains with the release stream. Optional context layers and further training do not block the local software checkpoint.

## Carter's count handoff — 7 November 2026, 21:31 America/New_York / 8 November 2026, 02:31 UTC

Mert read the latest completed project-chat outputs and Carter's 21:16–21:25 America/New_York messages. Carter is handling camera 220 and assigned count acceptance for **223 and 228** to Mert. These numbers are camera IDs. His committed `b1a5edf` enables only 222/count-1 after its human comparison, with pretrained YOLO11n/640 at requested 15 FPS. Mert safely fast-forwarded the shared checkout to that revision; no model weights or labels changed.

### Dispatched work

| Work stream | Owner and paths | Current assignment |
|---|---|---|
| Independent video review | Mert; new video-validation engineer, `evaluation/video_validation/`, focused new tests, private `data/raw/video_validation/` | Review all four supplied clips, starting with 223/228. Freeze practice-selected gates, then independently inspect held-out video and hash timestamped ledgers before seeing Carter/model references. Extend the queue to remaining video/windows without reprocessing identical frozen inputs. |
| Media and model execution | Mert; existing GPU/data stream, private clips and safe scalar execution evidence | Acquire the clips once, retain hashes/PTS/recording provenance and run the existing pretrained 640/15-FPS baseline at the frozen geometry. Keep outputs away from the blind visual review until its ledger freezes. |
| Queue portability | Mert; existing full-stack stream, `worker/publish.py`, focused tests/docs and optional narrow CI | Investigate Carter's 13 Windows PermissionError reports without weakening POSIX durability. Distinguish unsupported directory syncing from open temporary-file locking; obtain actual Windows CI evidence when available. |
| Consumer acceptance | Mert; dashboard stream, existing frontend boundaries | Verify that reviewed 222 image counts do not imply supported speed, distance or emissions, while the other cameras remain pending. Preserve the completed design. |
| Evidence reconciliation | Mert; central planning and `evaluation/calibration/222-count-audit.md` | Reproduce existing claims, preserve original human evidence, resolve matching/boundary/hash conventions and make acceptance decisions explicit. |

### Review protocol and current evidence

- **Practice:** `[60,180)` clip seconds; inspect unannotated timestamped sequences with gate overlays and road visible on both sides. Choose the designated gate using practice only; freeze its geometry and metrics policy before held-out scoring.
- **Held-out:** `[360,480)` clip seconds; record gate, direction, event time, supported visual class, uncertainty and frame/PTS references. Sparse contact sheets alone do not certify full temporal coverage. Keep assisted visual review distinct from Carter's human annotations; initial assisted ledgers have `human_confirmed=false`.
- **Comparison:** One-to-one, same gate/direction, default 1.5-second tolerance; canonical comparison maximizes matched events, then minimizes summed absolute timing error with deterministic tie-breaking. Preserve legacy closest-first results separately. Report total and per-direction errors, precision/recall, disputed events, missingness and coverage. Totals-only references cannot establish event-level precision/recall.
- **Provenance:** Retain original media and raw geometry hashes plus canonical JSON/selected-geometry fingerprints; LF/CRLF differences alone can change byte hashes. Retain original endpoint annotations and simultaneous distinct vehicles; do not silently normalize invalid timestamps into an interval or discard them as duplicates.
- **Acceptance:** Carter's proposed recall ≥85% and absolute total error ≤15% is an initial screening result. Flag precision/direction/visibility failures even when an aggregate screen passes. No camera is enabled solely by an assisted review; Mert/Carter must accept the evidence. Counting approval never authorizes physical calibration or estimated emissions.

The 223 and 228 videos and companion recording JSONs are downloaded into their ignored camera clip directories and hash-verified. Existing 222 media is available. Camera 220 media/reference availability and Carter's additional human keys remain pending discovery/sharing. The four-video/full-recording queue is assigned, **not completed or verified**. Mert requested a shared folder link if one exists while independent work proceeds on available files. Raw video, frames, temporary review sheets and private download capabilities stay out of Git.

The numerical [222 audit](./evaluation/calibration/222-count-audit.md) reproduces Carter's original results and records the boundary/direction sensitivity. It is not an additional visual annotation or a reason to overwrite the original key. The other project chats' completed software outputs remain valid at their documented synthetic/local scope; contributor-display setting changes remain on hold.

## First review results and priority clarification

**Updated:** 7 November 2026, 21:54 America/New_York / 8 November 2026, 02:54 UTC

Mert clarified that additional recordings/references will come **after 223 and 228 are successful**. Resolve those two first. Broad full-file/four-camera expansion is deferred; the queue retains its unreviewed intervals rather than claiming completion. No further media request is required for the current two-camera diagnosis.

- The independent review harness/report is published in `410a46f`; all 14 focused tests pass, independently rerun by Mert. Three initial held-out ledgers froze before corresponding reference access. A separate read-only min-cost max-flow audit reproduced all comparison counts and minimum timing gaps and checked source/freeze/geometry/reference hashes. See the [review report](./evaluation/video_validation/report.md).
- Camera 222's assisted ledger matches 62 of Carter's 64 literal interior annotations, with four assisted extras and two misses; the two original end annotations remain separately unresolved. Original-compatible comparison is also preserved. This is one-window agreement, not a new human annotation or a general accuracy guarantee.
- Camera 223 has 129 model passages versus 125–136 assisted passages. Candidate-inclusive agreement recall is 91.91%, precision 96.90%, and total difference −5.15%; excluding endpoint ambiguity also passes the provisional aggregate screen. Endpoint/directional adjudication and final count-only acceptance remain open.
- Camera 228 has 69 model passages versus 105–120 assisted passages. Its deficit remains 34.29–42.50% under both ambiguity bounds, so it is not successful on this screen. No geometry/model/policy is changed or camera enabled on the basis of the score. Actual disputed footage supports several finite-gate passages inside the road and outside exclusions; the pipeline root cause is not yet established.
- GPU job 175884 completed all four original baseline runs on CUDA in 1m28s, passed 30 tests plus 12 subtests and released its allocation. Private outputs and safe provenance are published in `a07b13d`; new-camera human-reference metrics remain unavailable. The existing inclusive-end checker sampled no exact end frames, so the actual frame sets also satisfy the declared half-open windows.
- Carter's reported queue portability issue is fixed in `845ce3c` with native verification in `8915278`: Windows and Linux each pass 53 tests plus 15 subtests; macOS checks also pass. See [platform evidence](./worker/QUEUE-PORTABILITY.md). This is normal-operation/restart evidence, not a power-loss proof.
- The dashboard consumer check preserves unavailable physical outputs and mode separation. The public read model does not yet expose Carter's count-review decision, so its conservative count-review-not-reported wording remains a known display gap; no scientific flag or design change was inferred.

### Authorized next diagnostic

The GPU/data stream may run one short, at most three-minute job tracing camera 228's **practice** dense release at 83–110s with unchanged n/640, requested 15 FPS and frozen geometry. Tracker/sampler initialization starts at 60s to match the existing practice recipe. Retain source PTS, sample decisions, detection/track ground points, road/exclusion eligibility, hit/gap/gate-state and crossing decisions privately. Do not alter worker decisions or treat instrumentation as a throughput benchmark. Source PTS replay reproduces the extra sampler omissions, but most rejected frames are 0.333–0.667ms before the sampling threshold; a tiny floating-point epsilon is not an established explanation for the count deficit.

After identifying a concrete cause, propose the smallest practice-selected repair, freeze it and evaluate separately on camera 228's reserved **unviewed `[720,840)`** interval. The earlier 900–1020 suggestion is superseded. The renderer enforces that reservation; no original failed held-out score is reclassified as fresh evidence after tuning. Physical calibration/emissions and contributor-setting changes remain outside this count-diagnostic checkpoint.

## Camera 222 calibration handoff — 7 November 2026, 22:25 America/New_York / 8 November 2026, 03:25 UTC

Carter's new email and commits `37a6043`/`3fc1110` supply a camera-to-aerial calibration tool, correspondences and a proposed `222-eastbound-through` movement from count-3 to count-1. The video-review stream safely merged those commits without rewriting the count-review history. Current image geometry is `222-image-v4`; the original count-1 coordinates are unchanged, and historical frozen reviews retain their own saved version/hashes.

The proposed ground segment is 20.0 m, with 10 fit pairs (0.821 m RMS), five held-out landmark pairs (1.411 m RMS), and leave-one-out remeasurements of 19.33–20.51 m. This range is fit sensitivity, not a statistical confidence interval. Carter explicitly records an incomplete independent LARIAC scale check, unknown local imagery accuracy, curved left-turn paths that can cross both gates, and unvalidated traversal/stopped-time observations. See [the original movement evidence](./evaluation/calibration/222-movement-eastbound.json).

The existing full-stack stream owns validating the attached traversal configuration and staging the private server registry/runtime handoff. The configuration loads with null mapping and null stopped-observation policy. Its 70 °F / 60% RH values are proposed fixed assumptions, not observed weather. No CARB mixture, stopped time, physical approval or whole-intersection coverage is inferred. A pending registry and isolated replay checks may exercise the software path while keeping unsupported physical values unavailable. No separate GPU run for this handoff is authorized yet; the 223/228 trial remains the immediate compute priority.

In parallel, anchored 228 practice evidence shows some vehicles have eligible raw detections but gain confirmed tracks only after crossing; metrics then lacks a stable pre-crossing side. Installed ByteTrack score-fusion logic supports testing one private `fuse_score=false` candidate. It also affects first-stage association, so restored passages and new false associations must both be checked. Every other model, geometry, threshold, sampling and metric setting stays fixed, with actual tracker arguments recorded. Failed observer/control attempts are preserved separately; candidate efficacy and the reserved fresh-window result are not yet established. No production tracker default or camera is changed by a practice trial.

**Practice-trial update (7 November 2026, 22:34 America/New_York / 8 November 2026, 03:34 UTC):** Corrected job 175957 completed in 48 seconds. Control and candidate used identical 1,392 samples; the control reproduces the saved baseline, and effective tracker arguments differ only in score fusion. Candidate count-1 passages increased from 66 to 123, with 85.51% temporal agreement recall and 95.93% precision against the candidate-inclusive assisted key. This is a practice score, not human or fresh validation accuracy. Spatial review then found duplicate associations for single vehicles, including overlapping front/full-body boxes, so the candidate is **improved but unapproved**; time matching can hide a duplicate substituted for a nearby missed vehicle.

One resolution-only practice alternative is authorized: the same pretrained weights at image size 1280, original score fusion and every other default unchanged. Its outcome is pending. No candidate is promoted, and `[720,840)` stays unviewed until a defensible practice-selected recipe is frozen. The separate 223 practice transcription defect is invalidated/superseded; all original held-out ledgers remain unchanged and pass independent chronology/repeated-block checks. Current tests also reject out-of-order or unreviewed repeated-block freezes while retaining genuinely simultaneous distinct vehicles.
