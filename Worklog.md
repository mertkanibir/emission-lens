# Worklog — Emission Lens

Running record of repository work. Newest entries first.

Times are shown in America/New_York and UTC. Authors are Mert and Carter only.

---

### 7 November 2026, 20:39 America/New_York / 8 November 2026, 01:39 UTC

- **Who:** Mert
- **Done:** Implemented the internal completed-traversal producer in worker/traversal.py, its focused synthetic trajectory tests and worker/TRAVERSALS.md handoff. Published the exact API first in 031ec04. The pure state machine links ordered finite entry/exit crossings to explicit accepted path distance, preserves estimated crossing and confirmation times, clips per-vehicle stopped intervals and maps completion UTC only through an explicit same-session clock.
- **Completed:** Combined traversal/metrics/calibration/timing checks pass: 90 tests plus 97 subtests; all 43 traversal cases also pass under the system standard-library runner. Verified missing/invalid calibration or distance stays unavailable, unknown classes stay unknown, unsupported stops stay null, duplicate IDs/frames and overlapping movements do not inflate completions, and loss/gaps/reconnect/view changes cannot join unfinished tracks. Clock rebins retain identities and durations; no raw tracker ID is exported. Scoped whitespace and approved Mert author/push identity checks pass.
- **Still open:** Engineering owns runtime observation/clock wiring, accepted registries, private evidence persistence and transactional minute composition. Real scaled road references, direction/continuity acceptance, independent stop classification and held-out count/tracking validation remain required. This is tested mechanics, not enabled live physical measurement. No camera drawing, detector/tracker/training setting, labels, manual review, GPU job, backend/public contract or other stream file was changed; contract 1.1 remains unchanged by this work.

### 7 November 2026, 20:33 America/New_York / 8 November 2026, 01:33 UTC

- **Who:** Mert
- **Done:** Created the isolated Junction Lens identity kit in `branding/` and new `frontend/public/brand/` assets. The mark combines curved intersection corners with an observation diamond, using the existing forest/cream/ink palette and outlined bundled Manrope ExtraBold. Added primary, reversed and monochrome SVG lockups/marks, a compact favicon SVG, 16/32 px ICO, five PNG icon sizes, a rendered review sheet, exact tokens, usage notes and a reproducible asset builder.
- **Completed:** Seven production SVGs parse and render with no live text, external resources or scripts; five RGBA icon dimensions, the two ICO sizes, tokens and the 1200 × 960 review sheet pass checks. Inspected the rendered primary/reversed/single-color lockups and 16/24/32/48/64 px badge checks. The optional authoring dependencies are isolated under `/tmp`; no application dependencies changed. Scoped whitespace checks pass.
- **Still open:** Mert reviews the identity before deliberate dashboard/favicon integration. No existing frontend source/layout/CSS, scientific contract, camera, model, label, worker or backend was changed. The kit is not activated or externally published and asserts no scientific validation or trademark clearance. Concurrent implementation work remains untouched.

### 7 November 2026, 20:29 America/New_York / 8 November 2026, 01:29 UTC

- **Who:** Mert
- **Done:** Published the exact internal completed-traversal producer API in worker/TRAVERSALS.md before implementation, for engineering's independent runtime/persistence wiring. Scoped work to a new pure module, its tests and package document.
- **Completed:** Explicit entry/exit roles, directions, accepted distance/calibration evidence, continuity/identity policy, traversal-linked stops and UTC attribution are proposed without extending contract 1.1. Reviewed current contracts and the accepted scenario handoff; checked document whitespace and the approved author/push account.
- **Still open:** Implement and verify the producer with synthetic trajectories, then publish its tested checkpoint. Runtime wiring, storage composition, real calibration and manual count/model validation remain their owners' work; no camera/model/data settings or GPU job changed.

### 7 November 2026, 20:25 America/New_York / 8 November 2026, 01:25 UTC

- **Who:** Mert
- **Done:** Started the next implementation wave at Mert's direction while Mert and Carter validate counts. Assigned complete backend measurement ingestion/approved registries/evidence composition to engineering, an isolated deterministic traversal producer to the data stream, and thin-route/scenario/brief binding to the dashboard stream. Accepted the existing integration proposal under explicit additive-schema, atomicity, timing, cohort and server-approval constraints; exact structures are to be published before implementation.
- **Completed:** All three streams acknowledged the bounded tasks and began work. Recorded the new scope and acceptance criteria in the master plan and coordination record. Existing model, labels, camera drawings and active validation are preserved. Scoped documentation/whitespace checks pass; this coordination change adds no runtime transport field or scientific approval.
- **Still open:** Complete and verify the new producer, server registry/measurement/evidence path, public read/scenario/brief binding, and a controlled end-to-end software run. Scientific count/calibration/mapping acceptance and actual shared hosted persistence remain separate gates. No live-emissions result is claimed from synthetic test inputs.

### 7 November 2026, 19:48 America/New_York / 8 November 2026, 00:48 UTC

- **Who:** Mert
- **Done:** Reconciled Carter's newly published four camera drawings and count-check helper without altering their saved geometry. Completed one bounded five-minute-capped GPU replay diagnostic on the fresh camera-222 clip, comparing Carter's drawing and the separate selected-lane proposal. Updated the readiness report, drawing inventory, provisional visual/runtime alignment and scalar execution evidence; preserved concurrent integration/dashboard work.
- **Completed:** All four drawings parse and remain disabled/unvalidated. Empire AI job 175741 completed 0:0 in 34 seconds, processed 703 sampled YOLO11n/640/5 FPS frames on CUDA with ByteTrack, and released its slice. All 62 focused tests plus 47 subtests passed on compute. Four scalar confirmations fall within provisional visual candidate brackets; this is not human-confirmed accuracy. Carter drawing events remain separate by gate/direction, never summed as unique flow. Saved production files were not enabled; in-memory reviewed copies were used only for offline diagnostic execution. Script/clip/weight hashes and the exact check script are retained. Removed the remote temporary clip copy; the ignored local copy remains solely for pending human review/demo use.
- **Still open:** Independent human selected-gate answer key and accepted count/tracking error; scaled current-view road control points, uncertainty, held-out reference distances and agreed tolerances; calibrated continuous traversals and linked stopped intervals. Public LA County imagery is georeferenced but dated 2013 and was not adopted as a current measurement. All physical calibration remains missing. No label/training/model promotion, physical quantity, regulatory mixture or external message was introduced. Existing contract 1.1 is unchanged; the accepted internal traversal-stopped-time handoff is documented separately from scene-wide minute stops.

### 7 November 2026, 19:43 America/New_York (8 November 2026, 00:43 UTC)

- **Who:** Mert
- **Done:** Completed the bounded engineering integration checkpoint: preserved explicit offline camera states as heartbeat age grows; added a calculation-only completed-traversal report and per-traversal shorter-stop CO₂/NOₓ scenario with signed changes; removed the aggregate stopped/cohort-duration shortcut for nonzero scenarios; serialized stale writer-lock recovery. Published package API/method/reliability documentation and the concrete measurement/registry/persistence proposal in `evaluation/integration-readiness.md`, following the accepted internal handoff in `Coordination.md`.
- **Completed:** All 82 backend tests pass, including 12 synthetic per-traversal scenario tests, 11 report tests, the offline/cohort regressions and six bounded reliability cases. Backend and contract type checks pass. Synthetic examples use retained CARB factors with explicitly fake calibration and mapping assumptions, activate no camera and write no live emissions. Concurrent lock reapers, lost HTTP acknowledgements, atomic readers and transaction failures are covered. Local documentation targets and scoped whitespace checks pass. No production web build was run during the parallel dashboard wave.
- **Still open:** Same-session entry/exit and traversal-linked stopped producer, approved calibration/class registries, private calculation-evidence persistence, authoritative composed minute writes and coordinated per-pollutant UI/read/brief binding. Physical scale/crossing validation and long live source-outage/restart tests remain required. The current aggregate-only scenario still has unavailable grams; this is ready calculation code, not a finished live emissions pipeline. Existing single-host deployment is the immediate target; multi-instance hosting is deferred. No training, labels, weights, real geometry, credentials or other stream edits were changed by this checkpoint.

### 7 November 2026, 19:42 America/New_York / 8 November 2026, 00:42 UTC

- **Who:** Mert
- **Done:** Finished bounded camera-222 crossing-review preparation and authoritative scaled-source discovery. Published four provisional event candidates with clip/geometry hashes and media-time brackets, and recorded LA County/Torrance source checks. Reconciled the producer document with the accepted internal per-traversal stopped_time_s decision in Coordination.md, without adding public fields or changing minute stopped-time meaning.
- **Completed:** The private source clip and review contact sheet provide concrete playback evidence; event candidates are explicitly not human-confirmed, exhaustive or accepted counts, and have no runtime matching result. The LA County service metadata is accessible and georeferenced but dated 2013; no current matching control points, appropriate ground-distance conversion or positional-uncertainty evidence was established. The standalone calibration primitive and its previously passed 19 mathematical tests / focused 58 tests plus 47 subtests are complete. Structured evidence checks preserve null accepted counts and empty accepted ground references. No raw media, guesses, external messages, training/model changes, GPU allocations or actual camera enablement were introduced.
- **Still open:** A human must confirm/refine selected-gate events and compare the actual YOLO11n/640 runtime; independently scaled current-view control points plus held-out validation distances, uncertainties and acceptance tolerances must be supplied. Engineering can consume the approved per-traversal stopped-time interface now, but real calibrated traversal evidence remains absent. All physical calibrations and unsupported physical/emissions outputs remain unavailable. No further calibration abstraction is needed for this checkpoint; the remaining dependency is field evidence.

### 7 November 2026, 19:38 America/New_York / 8 November 2026, 00:38 UTC

- **Who:** Mert
- **Done:** Completed the bounded scientific-readiness checkpoint with standalone homography/projection/held-out distance-residual checks, synthetic mathematical tests and a fresh temporary camera-222 source recording. Updated the published readiness artifact with recording provenance and verification; preserved all real camera configurations and Carter's training/labeling work.
- **Completed:** Captured 14 HLS segments totaling 140.519 seconds; decoded 2,108 1280×720 frames spanning decoder times 0–140.452 s with no nonadvancing timestamps. Recorded clip SHA-256, receipt times, zero recorder-reported sequence gaps and one retrieval/poll error; no capture-UTC or complete-coverage claim follows. All 19 new calibration tests pass, and the focused metrics/drawing/recording/calibration suite passes 58 tests plus 47 subtests. Geometry syntax accepts the separate disabled/unvalidated proposal. Git ignores both raw footage and the private review overlay. Mathematical checks do not approve camera calibration; no real config was enabled, physical reference fabricated, transport contract changed or GPU allocation used.
- **Still open:** Human selected-gate crossing review and runtime YOLO11n/640 comparison on the new clip; Carter's actual drawings/review notes; independently scaled landmarks and road distances for camera 222; and coordination approval of traversal-linked stopped evidence before scenario wiring. All shared physical calibrations remain missing; speeds, distance-based queues, calibrated traversals and estimated emissions remain unsupported. Temporary footage is retained only for the pending review/demo purpose and must be removed when that ends. Unrelated engineering and dashboard edits are preserved.

### 7 November 2026, 19:38 America/New_York / 8 November 2026, 00:38 UTC

- **Who:** Mert
- **Done:** Reviewed all three active implementation streams and the published measurement-readiness proposal. Prioritized a tested software checkpoint, real one-camera scientific evidence, then single-host integration/replay rehearsal. Accepted a separate internal per-traversal stopped-time input for scenarios while preserving observation-minute stopped-time semantics and contract 1.1. Identified independent scaled road references as the unresolved live-emissions dependency.
- **Completed:** Recorded the handoff decision and fastest completion sequence in `Coordination.md`. Existing local persistence/preview/SSH architecture remains the first demonstration target; extra context, model training, redesign and multi-instance hosting stay off this immediate dependency chain. Documentation scope/whitespace were checked; concurrent runtime edits are preserved. No live calibration, mapping, transport field or emissions output is approved by this decision.
- **Still open:** The three code checkpoints are in progress. Real geometry/crossing review, physical reference measurements and validation, accepted completed-traversal evidence, class mappings, stable-revision combined tests, outage/replay rehearsal and submission verification remain necessary. No completion percentage or field-validation ETA is claimed without supporting evidence.

### 7 November 2026, 19:35 America/New_York / 8 November 2026, 00:35 UTC

- **Who:** Mert
- **Done:** Published the scientific measurement-readiness inventory and a separate disabled camera-222 image-geometry proposal, preserving Carter's drawings, labeling and training ownership. Specified manual selected-gate held-out checks, independent physical-reference requirements, the actual-runtime evaluation gap and a proposed calibrated traversal/stopped-interval handoff for engineering.
- **Completed:** Local inventory confirms no actual per-camera measurement JSON, no retained recorded source clip, no manual crossing answer key and no independently scaled road references in the inspected roots. All shared physical calibrations remain missing. The proposal records the inspected still's hash, normalized ROI/gate and image direction; it is not loaded by the worker. Geometry syntax validation and all 23 existing metrics tests pass. The report identifies the stopped-time/completed-traversal cohort mismatch before integration; no contract semantics were silently changed.
- **Still open:** A bounded camera-222 source recording is in progress for a new manual/runtime review. Carter's actual drawings and any private clips remain external dependencies. Physical calibration needs independently scaled references and held-out validation. Runtime YOLO11n/640 crossing accuracy, calibrated traversals, traversal-linked stops and numeric VMT-based mappings remain unproven. No camera was enabled, no model/label altered and no external message or GPU allocation used.

### 7 November 2026, 19:29 America/New_York (8 November 2026, 00:29 UTC)

- **Who:** Mert
- **Done:** Read the recent completed work and user constraints for the three existing implementation work streams. Established centralized direction in `Coordination.md` and linked it from the master plan. Defined disjoint engineering, scientific-evidence and dashboard ownership, protected Carter's training/labeling work, and set one verified camera-to-emissions/scenario flow as the next milestone. Defined shared-checkout safeguards, contract proposal gates and report requirements.
- **Completed:** The existing work streams were identified and their last assignments were complete. Published the coordination scope, sent all three authorized task assignments, and verified that each acknowledged its ownership and began work. This changes project coordination documentation only; no runtime, schema, model, calibration or class mixture is changed.
- **Still open:** Review the three in-progress implementation checkpoints, verify their evidence and resolve handoffs. Physical calibration, approved mappings, complete traffic/emissions/scenario integration, longer reliability checks, hosted deployment and final demo/submission remain open. No new accuracy, live-emissions or environmental-impact claim is made.
### 7 November 2026, 19:30 America/New_York (00:30 UTC)

- **Who:** Carter
- **Done:** Added `evaluation/check_counts.py`, which exports a stretch of a recorded clip with gates and a clip clock for manual counting, and runs the live worker's detector, tracker, and gate metrics on the same stretch using an in-memory reviewed copy of the geometry.
- **Completed:** All tests pass. Camera 222's review video (clip time 1:00 to 3:00) and model count are written to the ignored `data/raw/count_check/`; the model count is held back until Carter's manual count is done.
- **Still open:** Carter's manual count for 222, then cameras 220, 223, and 228. Retraining with more data is deferred until the product works on the pretrained model; the MIO-TCD converter was removed.

### 7 November 2026, 19:05 America/New_York (00:05 UTC)

- **Who:** Carter
- **Done:** Drew road regions, parking exclusions, and counting gates for cameras 220, 222, 223, and 228 (`config/cameras/<id>.measurement.json`, version v1, disabled and unvalidated). The drawing tool now checks each outline when Enter is pressed and previews the closing edge. Re-ran the detector comparison on Mert's tuned model (job 175644).
- **Completed:** All four configs load with `MetricsConfig.from_dict`. The independent comparison reproduces Mert's result: tuned any-vehicle F1 83% vs 90% pretrained; truck precision rose from 21% to 32% but truck recall fell from 58% to 27%; bus, motorcycle, tractor-trailer, and Tesla got worse or stayed at zero. The pretrained model stays in use.
- **Still open:** Gate counts need checking against manual crossing counts on recorded clips before any camera is marked reviewed. The tuned weights stay local in `weights/` and are not committed.

### 7 November 2026, 18:55 America/New_York (23:55 UTC)

- **Who:** Mert
- **Done:** Reconciled the root README, master plan, agent status summary, contracts, backend/ingestion, frontend and evaluation Markdown with completed HLS timing integration and current GPU/training evidence. Added discoverable timing links, estimated-versus-capture semantics, empty-revision retractions, mixed-basis notes and remaining blockers. Corrected the master plan's worker command to include the required output path and verified compute environment. Historical run/worklog results remain dated records.
- **Completed:** Documentation now distinguishes local GPU status/previews from hosted deployment and validated traffic/emissions, and records that fine-tuning completed without promotion. Checked local documentation targets, evidence/provenance references, runnable CLI flags and whitespace. No runtime, schema or scientific-model change in this documentation pass.
- **Still open:** Actual image-geometry review, held-out traffic validation, independent physical calibration, visual-to-CARB mappings, extended outage/reliability checks and shared hosted persistence. Capture UTC and validated coverage remain unavailable. Concurrent dashboard edits are preserved.

### 7 November 2026, 18:49 America/New_York (23:49 UTC)

- **Who:** Mert
- **Done:** Replaced receipt-minute vehicle aggregation with a per-session minimum-offset HLS media clock. Added scalar-prefix rebins for earlier frames when startup backlog improves the anchor, ordered empty-revision retractions before replacement minutes, source-ordered queue selection, exact microsecond boundaries, and clock-version provenance/read-path disclosures. Hardened outbox FIFO across backward wall-clock steps. Documented the change before implementation; contract 1.1 fields remain unchanged and capture UTC stays unavailable.
- **Completed:** Focused Python timing/aggregation/runtime/delivery tests pass, as do all 51 backend tests, package type checks and the production build. Tests cover the 30-second backlog, publishing before anchor convergence, retraction persistence without duplicate/null totals, reconnect/mode isolation, queue ordering, minute boundaries and FIFO restart behavior. A 30-second live camera-222 timing check processed 204 advancing frames with no reader drops and a 25.060645-second anchor improvement; the reader stopped cleanly and no imagery was saved. The former receipt-boundary test was updated for the intended media-time semantics. Existing live/model evidence is preserved.
- **Still open:** Estimated media UTC still has unknown minimum transport delay; this is not source capture UTC, measured latency or validated coverage. Historical receipt windows are unchanged. Overlapping footage after reconnect, cross-run minute conflicts, physical calibration, reviewed class mappings and emissions remain separate work. No real geometry or training state was changed. Concurrent dashboard/training edits are preserved.

### 7 November 2026, 18:47 America/New_York (23:47 UTC)

- **Who:** Mert
- **Done:** Completed Carter's Empire AI fine-tuning sequence. Job 175644 trained YOLO11s on the audited dataset, ran the fixed 60-frame held-out comparison and a CUDA tensor check, and released its allocation. Retrieved and checksummed the best checkpoint and epoch CSV, preserved the job log and actual batch script, and delivered the requested private results package to Carter through Mert's Binghamton Drive and email. Merged Carter's concurrent geometry-tool commit while retaining both dated worklog entries and preserving unrelated working changes.
- **Completed:** Scheduler reports COMPLETED / 0:0, 10m25s; early stopping at epoch 40, best validation checkpoint epoch 20. All 17 focused evaluation tests passed on compute. Downloaded checkpoint SHA-256 matches the remote GPU verification. Held-out any-vehicle F1 was 0.8253 tuned versus 0.8996 pretrained; image-count MAE was 2.8167 versus 2.35. The candidate was not promoted; existing runtime model selection is unchanged. Published scalar comparison/provenance only; no raw imagery, weights, credentials or private download tokens are committed. Verified Carter has reader-only access to the package. Both GPU allocations are released; Mert's SSH connection remains available.
- **Still open:** Improving assisted training-label quality and class coverage, then collecting a new independent evaluation set for a future training iteration. Tractor-trailer training and motorcycle validation evidence are absent, and the Tesla tracking rule is not validated. Calibration, emissions and runtime integration work remain separate; this result does not establish traffic-count or environmental accuracy. No contract or product-scope change was applied.

### 7 November 2026, 18:40 America/New_York (23:40 UTC)

- **Who:** Carter
- **Done:** Added `python -m worker.draw_geometry <camera>`, a click tool that draws a camera's road region, parking exclusions, and counting gates on a frame from its recorded clip, shows each gate's positive side, and saves `config/cameras/<id>.measurement.json` for Mert's `MetricsConfig`. Set aside Carter's duplicate slice 4 worker in favour of Mert's runtime. Mert's training job is running on an H100 MIG 1g.10gb slice.
- **Completed:** 167 Python tests pass. The tool validates with the worker's own `MetricsConfig.from_dict` before saving, saves only as disabled and unvalidated, and its `+` arrow matches the worker's signed-distance direction. Frames load from all four recorded clips.
- **Still open:** Carter draws the four cameras. Counts then need checking against manual crossing counts on held-out clip time before any camera is marked reviewed and enabled. Mert's worker assigns camera-minutes by receipt time, which bursty HLS delivery and the opening backlog distort; a media-time anchor was proposed to Mert.

### 7 November 2026, 18:35 America/New_York (23:35 UTC)

- **Who:** Mert
- **Done:** Read Carter's Empire AI fine-tuning instructions, reused Mert's authenticated SSH connection and verified compute environment, downloaded and audited the shared dataset, completed GPU preflight job 175643, and launched fine-tuning job 175644 with held-out comparison after training. Corrected supported-zero F1 and explicit empty-test errors in the detector comparison; preserved unrelated integration work.
- **Completed:** Dataset has 280 train / 60 validation / 60 test images, matching class order, valid labels, no cross-split filename or exact-image duplicates, chronological camera splits and 30/30 matching Mert test exports. Preflight completed one YOLO11s COCO8 epoch at size 1280 / batch 8 and direct HLS access passed. All 17 focused comparison tests passed on the allocated compute environment. No raw images, weights or credentials are committed.
- **Still open:** Job 175644 training, checkpoint retrieval, final held-out comparison and private handoff package. Training labels include assisted drafts. Tractor-trailer has no train/validation examples; motorcycle validation is absent. No model promotion, accuracy improvement or environmental-impact claim is established.

### 7 November 2026, 18:32 America/New_York (23:32 UTC)

- **Who:** Mert
- **Done:** Completed job 175627's four-camera CUDA benchmark, authenticated GPU-to-dashboard status/preview delivery, paced real-source replay and shutdown verification. Published scalar diagnostics and tested-source hashes, documented the verified loopback-only SSH relay, and wired optional reviewed image-gate metrics into receipt-minute snapshots with stable batch IDs and cumulative revisions. Clarified empty traffic copy so it does not imply a disconnected detector. Updated the current project status and setup documentation.
- **Completed:** The 120-second benchmark processed 2,655 frames and recorded 82 buffer drops on two cameras. A separate 90-second live run delivered 18 persisted batches and 47 matching annotated previews with no pending uploads or preview failures. Browser checks decoded the frame/overlay at desktop and 390 px phone widths with no page errors/overflow; all four cameras changed offline at graceful shutdown. Paced replay stayed separate from live and delivered successfully. The final runtime check kept the example geometry disabled and completed delivery. All 150 Python tests plus 29 subtests passed on compute; all 49 backend tests, package type checks, factor checks, production build and the integration CI jobs passed. The tested runtime hashes match the corresponding source manifest. The temporary clip was removed, the private relay closed, and scheduler state is COMPLETED/0:0 for job 175627; its allocation is released.
- **Still open:** Actual road ROI/gate review and independent measured calibration, validated completed traversals and visual-to-CARB mappings, held-out model promotion, longer operation/forced-outage testing, and hosted shared persistence/deployment. No live crossing count, physical speed, emissions, accuracy or environmental-benefit claim was invented. Optional metrics remain disabled for real cameras. Other work in progress is preserved; no teammate input or raw labeling work was changed.

### 7 November 2026, 18:23 America/New_York (23:23 UTC)

- **Who:** Mert
- **Done:** Added the runnable four-camera worker, strict contract-1.1 batch parser, authenticated ingestion, atomic single-host persistence, read API, automatic dashboard refresh, expiring same-frame previews, bounded delivery outbox, paced labeled replay, and independent tracker/session handling. Added an offline gate/ROI metrics engine and disabled configuration example, four-camera benchmark tooling, CI, package type checks, and corrected Mert's training job account/QOS/environment. No real camera geometry or live class mapping is enabled. Local runtime credentials are private ignored files.
- **Completed:** Both shared packages and the frontend type-check, all 49 backend/HTTP/storage/preview tests pass, and the production web build passes. All 127 Python tests and 29 subtests passed on the allocated compute node, including real Ultralytics tracker continuity/reset callbacks without a model download. The preview route's first type check exposed a handler-context mismatch; the route now wraps the testable handler and checks pass. The worker emits no placeholder traffic rows or invented emissions. Processing freshness is independent of unavailable capture UTC. GPU job 175627 is running bounded four-camera evaluation; results are not yet claimed.
- **Still open:** Complete the real GPU delivery and browser verification, publish diagnostic evidence, and release the allocation. Camera geometry, measured calibration, reviewed regulatory-class mappings and held-out model promotion remain required. The local file store is for one persistent host; hosted shared persistence and deployment remain open. Carter's label work is preserved and no training run is started on incomplete data.

### 7 November 2026, 18:20 America/New_York (23:20 UTC)

- **Who:** Carter
- **Done:** Merged Carter's and Mert's Label Studio test exports and built the training dataset (280 train, 60 validation, 60 human-reviewed test frames). Added `evaluation/compare_models.py`, which scores pretrained and fine-tuned detectors on the test frames, and recorded the pretrained baseline in `evaluation/model_comparison.md`.
- **Completed:** 89 Python tests pass after restoring the CARB files with LF endings under Mert's `.gitattributes`. Pretrained baseline: any-vehicle precision 94%, recall 86%; truck precision 21%, mostly SUVs called trucks.
- **Still open:** Mert's training run on Empire AI. The tuned model's comparison runs once `best.pt` arrives. Training has no tractor-trailer examples and few Tesla, box-truck, and motorcycle examples.

### 7 November 2026, 18:12 America/New_York (23:12 UTC)

- **Who:** Mert
- **Done:** Started the independently completable integration scope authorized by Mert, preserving Carter's labeling work. Upgraded MapLibre GL JS to 6.17.0 for the maintainer's critical sanitizer advisory and adapted its named-module import. Added a Git attributes rule preserving published CARB factor artifacts byte-for-byte across operating systems.
- **Completed:** All 29 backend tests and the production frontend build pass. The first build exposed MapLibre 6's removal of its default export; the import was corrected and the rebuild passed. The production dependency audit reports zero vulnerabilities. The factor files are preserved without changing their published bytes. Integrated Carter's recorder, reviewed-label merge, and training-job commits after the first push detected concurrent remote work; preserved both worklog records.
- **Still open:** Worker orchestration, authenticated ingestion, persistence, sustained four-camera GPU evaluation, and dashboard delivery are in progress. Valid road calibration and reviewed class mappings remain prerequisites for live emissions; none are assumed by this change.

### 7 November 2026, 17:26 America/New_York (22:26 UTC)

- **Who:** Carter
- **Done:** Added `python -m worker.dataset merge`, which puts Label Studio test-frame exports in place of the drafts and records them as human-reviewed. `build` now reads `data/raw/reviewed` and refuses to run until every test frame was reviewed by a person. Added `infra/train.sbatch` for Mert's Empire AI training job.
- **Completed:** 76 Python tests pass, excluding the two Windows checksum tests in `tests/test_emfac.py`. On the real reviewed folder, `build` correctly refuses because test frames still have unreviewed boxes. Ultralytics' GPU precision check builds a model from config, so the job needs only `yolo11s.pt` downloaded beforehand.
- **Still open:** Carter's and Mert's test-frame exports. The training job has not been run on the real dataset.

### 7 November 2026, 17:06 America/New_York (22:06 UTC)

- **Who:** Carter
- **Done:** Added `worker/record_clips.py`, which saves each camera's original HLS segments into one clip per camera in the git-ignored `data/raw/clips/` folder, with a record of source, capture times, gaps, and a replay label. Started a 20-minute daylight recording of all four cameras. Training labels: pretrained truck boxes were classified from crops, signs and unclear boxes were dropped, and 25 Tesla boxes were confirmed by Carter. Provenance is in `data/raw/reviewed/provenance.json`.
- **Completed:** 7 recorder tests pass. A one-minute live check of camera 222 saved 78.5 seconds of video that decodes at 15 frames per second through OpenCV.
- **Still open:** Replay playback pacing is not built; reading a file runs faster than real time. Clips must be deleted after the event. Carter and Mert are reviewing the 60 test frames in Label Studio. Training has no tractor_trailer examples and few Tesla examples.

### 7 November 2026, 16:28 America/New_York (21:28 UTC)

- **Who:** Carter
- **Done:** Contract 1.1 adds `tesla`, `pickup`, `box_truck`, and `tractor_trailer`, and keeps `truck` as the pretrained fallback. Updated the type, the `traffic_minutes` check in `001_contract_v1.sql`, the backend sort order, the contracts README, and a `Plan.md` §7 note. Dataset build now matches classes by name, so a labeling tool that reorders classes cannot mislabel boxes. Collected 726 frames and drafted boxes on 400, split into labeling folders by camera (Carter 220 and 222, Mert 223 and 228). Mert's emissions mapping check now reads the contract class list instead of the old five classes. Checked Label Studio 1.23.2 offline: draft boxes import, export back to YOLO unchanged, and build correctly renumbers its alphabetical classes.
- **Completed:** 55 Python tests and Mert's 14 backend tests pass. A Python test keeps worker classes inside the contract list. The draft has 100 frames per camera and 8,114 boxes, including 860 trucks that need review.
- **Still open:** Mert should review the contract change. `001_contract_v1.sql` was edited in place because no hosted database exists; a database already built from 1.0 needs the check constraint replaced. Type-checking each package with `tsc -p` reports the same 20 errors before and after this change: 5 in contracts and 15 in backend, from imports ending in `.ts`. On Windows checkouts, `tests/test_emfac.py` fails its checksum test because Git converts the CARB files to CRLF; a `.gitattributes` rule for `emissions/data/` would fix it. Labeling has not started.

### 7 November 2026, 16:27 America/New_York (21:27 UTC)

- **Who:** Mert
- **Done:** Took the explicitly requested factor-data slice of `emissions/` while leaving Carter's training and labeling work untouched. Obtained CARB EMFAC2025 v2.1.1 project-analysis request 859 for Los Angeles (SC), 2026, Annual. Retained the original 15,186-row CSV and validated a 1,296-row RUNEX CO₂/NOₓ subset covering 12 EMFAC2007 categories, 18 speed bins, and 60/70/80 °F at 60% relative humidity. Added a reproducible acquisition/normalization path, request settings, source-line references, source/archive/normalized checksums, a backend calculation interface, provenance on the camera detail page, and a labeled synthetic arithmetic example. Updated the plan and package documentation. Fast-forwarded Carter's tracking commit `1968718` without changing his files before preparing this change for the shared branch.
- **Completed:** `npm run test:emissions` passes all 12 data-integrity checks; `npm test` passes all 29 backend tests; `npm run build` passes. Every normalized factor traces back to its original CSV line and unit conversion. The one-vehicle-mile example reproduces the original CARB CO₂ and NOₓ rates. Tests caught a speed-bin floating-point boundary issue; it was corrected and the full relevant checks passed. Camera 222 was checked in the browser: loaded catalog, source link and meteorology assumptions are visible, while live estimates remain unavailable. Missing factors, unknown classes, unsupported weather/year, incomplete traversal evidence and invalid calibration never become an invented zero. Ordinary-idle and EV double-counting are prevented by process selection and explicit assumptions. Contract 1.0 fields are unchanged. No known failing check remains; the changes are ready to commit and push as Mert.
- **Still open:** Valid camera calibration, documented visual-to-regulatory class mixtures, completed worker traversals and worker-to-dashboard persistence are required for live estimates. Broad visual labels are not regulatory weight classes. The retained table uses illustrative fixed meteorology and annual regional fleet assumptions; it is not current observed weather. No comprehensive uncertainty range, fuel-share replacement, live emissions result, accuracy or environmental-savings claim is established. Class-mapping candidates are proposals only; no production mapping is silently activated. Carter's tracking/training evaluation and GPU work remain separate.

### 7 November 2026, 16:14 America/New_York (21:14 UTC)

- **Who:** Carter
- **Done:** Added `worker/track.py` (per-camera ByteTrack tracking that resets on reconnect, plus one class per track with the Tesla rule) and `worker/live_view.py` (on-screen view with IDs, classes, and processing rate; nothing saved). Added an image-size option to the detector.
- **Completed:** 52 tests pass. On camera 222 the laptop CPU processed 6.2 frames per second at 640 pixels and 2.8 at 1280, with frame collection also running. A Tesla needs at least 3 frames averaging 85% confidence; otherwise it is a car.
- **Still open:** The laptop cannot track four cameras live, so live tracking depends on the GPU. When processing falls behind, dropped frames leave gaps that split tracks: in 30 seconds of video there were about 100 tracks, with a median of 6 frames each. Mert should rerun the GPU check inside `srun`, because `nvidia-smi` was not found.

### 7 November 2026, 15:55 America/New_York (20:55 UTC)

- **Who:** Mert
- **Done:** Reused an authenticated SSH connection for direct shell execution, cloned the repository into the Empire AI home directory, and installed the pinned worker packages into the existing compute-node Python 3.12 environment. Verified account `rpicourse`, QOS `normal`, and an H100 10 GB slice. Added `evaluation/gpu_smoke.py` and a diagnostic record, updated the master plan and README, and documented the reproducible allocation and inference commands. Pulled Carter’s frame-collector commit before testing, then integrated his detector/dataset commit and preserved both worklog entries when the initial push encountered newer remote work. No raw frames, weights, or credentials are committed.
- **Completed:** Job `175330` processed 50 advancing live camera-222 frames with pretrained YOLO11n on CUDA. Median prediction wall time was 4.38 ms excluding warmup; 27 reader-buffer drops were observed, so no sustained-throughput claim is made. `python -m pip check` passed, all 24 initial Python tests passed on the compute node, all 39 tests passed there after integrating Carter’s latest commit, and all 14 backend tests passed locally. The smoke script checks the actual CUDA inference backend; its first attempt checked the CPU wrapper and was corrected before the passing run. The recorded script hash matches the tested file. The scheduler confirmed the job completed with exit `0:0`, and the GPU slice was released.
- **Still open:** Labeled images and held-out splits are needed before fine-tuning. Proposed custom classes and the Tesla threshold need contract agreement and validation. Tracking, calibration, sustained four-camera inference, reconnect evaluation with detection, worker-to-dashboard delivery, and CARB factors remain open. The live dashboard still reads empty fixtures. No accuracy or emissions-savings claim was established.

### 7 November 2026, 15:46 America/New_York (20:46 UTC)

- **Who:** Carter
- **Done:** Added `worker/detect.py`, a pretrained YOLO wrapper, and `worker/dataset.py`, which drafts boxes for labeling and builds the checked, time-split training zip.
- **Completed:** 39 tests pass. Draft boxes ran on 16 real frames at about 0.29 s per frame on the laptop CPU at 1280 pixels, with frame collection running. Ultralytics accepted the generated `data.yaml`.
- **Still open:** That speed is about 3.4 frames per second in total, below the 20 needed for four cameras at 5 each, so live detection needs a GPU or lighter settings. Pretrained boxes miss vehicles and mark some SUVs as trucks, so every frame needs human review. No labeled dataset exists yet. Tracking and the live view are next.

### 7 November 2026, 15:24 America/New_York (20:24 UTC)

- **Who:** Carter
- **Done:** Added `worker/collect_frames.py` to save spaced-out labeling frames into the git-ignored `data/raw/frames/` folder. Fixed the reader buffer size at slow sampling rates. Moved fine-tuning forward with Mert: Mert trains on Empire AI and updates the contract.
- **Completed:** 24 tests pass. A one-minute live run saved frames from all four cameras. Agreed classes: car, pickup, box_truck, tractor_trailer, bus, motorcycle, and tesla. A Tesla below 85% confidence is reported as car.
- **Still open:** Contract classes need updating by Mert. The 85% threshold needs checking on held-out frames. Pretrained YOLO stays the fallback unless the tuned model wins on held-out frames. CARB factors are still missing.

### 7 November 2026, 15:20 America/New_York (20:20 UTC)

- **Who:** Mert
- **Done:** Redesigned the dashboard as a dark map console. The overview now has a camera list, a map with signal-head markers, the selected camera's evidence, and a system-check log built from stored records. The camera detail, review, and brief pages use the same design system. A single mode strip labels live, replay, and synthetic data on every page. The map switches between vehicle activity and modeled emissions. The brief can be saved as a local text file and is never sent. A stopped-time reduction outside 0 to 100 in the URL no longer crashes the camera or brief page. Twelve untracked frontend files ending in " 2" were moved to `../emission-lens-duplicate-backup/`. Each was byte-identical to a committed file, and two of them broke the type check.
- **Completed:** The frontend build passes and the 14 backend tests pass. Overview, camera detail, review, and brief were checked in a browser at 1440, 1187, and 390 px wide. Live, replay, and synthetic modes were all checked. Unavailable values never display as zero.
- **Still open:** The video panel still has no frame source, and road regions and gates are not drawn because they are not configured. The console does not read Carter's worker status yet. The other " 2" duplicates in `backend/`, `contracts/`, and the root are untouched, and some of them differ from the committed files. `next dev` generates an untracked `frontend/AGENTS.md`, which was left uncommitted.

### 7 November 2026, 15:08 America/New_York (20:08 UTC)

- **Who:** Carter
- **Done:** Added `worker/stream.py`, a threaded HLS reader with media-time sampling, a bounded frame buffer, reconnect backoff, stall detection, and live, degraded, and offline status. Added tests, including one that keeps the camera YAML files matched to `contracts/src/cameras.ts`.
- **Completed:** 21 tests pass. In one 75-second laptop run, all four cameras held 5 frames per second of video with no dropped frames and no reconnects. A dead URL stayed offline.
- **Still open:** A real mid-stream drop has not been observed; reconnect is tested with scripted failures only. The stream has no capture timestamp, so end-to-end delay is not measured. Detection and tracking are next.

### 7 November 2026, 14:58 America/New_York (19:58 UTC)

- **Who:** Mert
- **Done:** Required every commit and push to use the `mertkanibir` or `CarterWhite8232` GitHub account, with the author email that account already accepts.
- **Completed:** The account rule is in `Agents.md`.
- **Still open:** Carter’s explicit handoff, the Empire AI GPU test, is still not run. The removed commit that names a tool account may still appear in GitHub’s contributor list until that list refreshes.

### 7 November 2026, 14:55 America/New_York (19:55 UTC)

- **Who:** Mert
- **Done:** Rewrote Mert’s commits so the author email is the mertkanibir GitHub address. Left Carter’s gitignore commit authored by Carter. Recorded that email in `Agents.md` so later commits do not use `ascendoteam@gmail.com`.
- **Completed:** Current history no longer uses the ascendoteam email, and current commit messages have no tool co-author trailer.
- **Still open:** GitHub can keep a removed commit available by its old id, so an extra contributor avatar may linger until GitHub refreshes that list. Carter should reset local `main` onto this rewritten history before pushing again.

### 7 November 2026, 14:40 America/New_York (19:40 UTC)

- **Who:** Mert
- **Done:** Started Mert’s packages: contract 1.0 types and fixtures, a Postgres draft, the read API, the dashboard, and the investigation brief. Named Mert and Carter on the work-package table. Left Carter’s vision and emissions paths untouched.
- **Completed:** Live, replay, and synthetic modes stay separate. Empty emissions stay unavailable rather than zero. The dashboard shows four cameras, stale versus offline status, a shorter-stop scenario without invented grams, an empty review queue, and a draft brief that is not sent. Backend checks pass, and the dashboard build passes.
- **Still open:** No worker heartbeat, no valid calibration, no CARB factor table, no hosted database, and no GPU run. Queue length in metres and speed stay suppressed. The synthetic minute is only a labeled sample.

### 7 November 2026, 14:44 America/New_York (19:44 UTC)

- **Who:** Carter
- **Done:** Added pinned worker dependencies, config files for cameras 220, 222, 223, and 228, and a validating config loader with tests. Checked coordinates and stream URLs against the Caltrans D7 metadata.
- **Completed:** 10 config tests pass on Python 3.12. All four configured streams opened and decoded a 1280 x 720 frame through OpenCV on Carter's laptop, with nothing saved. Carter now has push access.
- **Still open:** Dependencies are unverified on the Empire AI node, and the GPU test is with Mert. Road regions and gates are not configured yet. Continuous ingestion is the next slice.

---

### 7 November 2026, 14:34 America/New_York (19:34 UTC)

- **Who:** Carter
- **Done:** Removed the global `*.ts` rule from `.gitignore`, which was hiding TypeScript source. Added ignores for evaluation frames, Ultralytics `runs/` output, and TensorRT and OpenVINO model exports.
- **Completed:** TypeScript files can be committed. Sampled frames and exported models stay out of the public repo.
- **Still open:** Carter needs push access. Empire AI GPU test is with Mert. The rest of `Plan.md` §21 is unchanged.

### 7 November 2026, 14:28 America/New_York (19:28 UTC)

- **Who:** Mert
- **Done:** Updated `Agents.md` and `Plan.md` §15 so every turn must timestamp completed work, speak only as Mert and Carter, and push when nothing looks broken. Added this worklog.
- **Completed:** The every-turn logging, attribution, and push rules are written into the agent instructions and the master plan.
- **Still open:** The rest of the immediate unresolved items in `Plan.md` §21. No application or GPU work in this turn.

### 7 November 2026, 16:35 America/New_York (21:35 UTC)

- **Who:** Mert
- **Done:** Redesigned `frontend/` as a spatial intelligence workspace with a tilted basemap, floating camera and evidence panels, cyan selection rings, new typography, a prominent crossings readout, progressive disclosure for diagnostics, camera-focus transitions, Fit network, and a persistent ambient-motion control. All motion respects the operating-system reduced-motion setting. Camera health and live/replay/synthetic provenance remain explicit. Updated `frontend/README.md`.
- **Completed:** Production build and all 29 backend tests pass. Browser checks at 390, 992, and 1440 px covered layout, camera selection, all data modes, both map layers, motion on/off, feed diagnostics, and camera-detail navigation. Generated duplicate route/validator types caused the initial build failure; those local duplicate artifacts were removed and the build passed. Removed an unavailable basemap texture reference. Integrated Carter's concurrent contract and dataset commits before pushing; production build and all 29 backend tests also pass on the combined tree. No contract, calculation, or work-package scope change from the redesign.
- **Still open:** Worker-to-dashboard delivery, synchronized video, valid calibration and road regions/gates, and Vercel deployment. This remains a fixture-backed UI; no measured accuracy or emissions claim was added.

### 7 November 2026, 17:09 America/New_York (22:09 UTC)

- **Who:** Mert
- **Done:** Rebuilt all of `frontend/` around the selected rounded dashboard references, using charcoal panels, green accents, a light geographic map, self-hosted fonts, Phosphor icons, and clearly illustrative environmental imagery. Added a searchable/filterable/sortable camera table, selected-camera metrics with recorded-minute context, vehicle mix from actual records, accessible menus, contextual camera/history/calibration/scenario views, an honest review state, and a readable brief with copy and real local text-attachment export. Added `design-qa.md` and refreshed `frontend/README.md`.
- **Completed:** Production build and all 29 backend tests pass. Browser checks covered all four cameras, all data modes on every route, every new menu/filter/sort/search control, map layers/fit, disclosures, scenario boundaries and invalid/blank inputs, slider synchronization, all brief camera options, clipboard, and an actual downloaded attachment. Downloaded content matches the preview. Phone overflow, map stylesheet ordering, early native-menu hydration, class aggregation across minutes, and copy-feedback reset were resolved. Desktop/phone visual comparison passed. No shared-contract or scientific-calculation changes.
- **Still open:** Worker delivery, synchronized video, valid calibration, road regions/gates, contextual integrations, and Vercel deployment. The app remains fixture-backed. No accuracy, health-risk, or environmental-impact claim was added.

### 7 November 2026, 17:26 America/New_York (22:26 UTC)

- **Who:** Mert
- **Done:** Applied the supplied tan `#FAF3EA` and green `#058247` palette across `frontend/`, including all menus, forms, tables, map styling, and detail pages. Made interface text bold throughout, added labeled blue/amber/green/violet/teal metric categories, tabular numeric readouts, staggered panels, selection and menu transitions, vehicle-bar reveals, and accessible bounded numeric easing. Fixed the camera-route menu opening over the heading. Updated `frontend/README.md` and `design-qa.md`.
- **Completed:** Desktop and 390 px phone checks cover the overview, camera detail, review, brief, light menus, live null states, synthetic values, motion toggle, reduced motion, and horizontal containment. Exact palette and typography were checked in the browser; the source/render comparison passes. Production build and all 29 backend tests pass. No shared-contract, calculation, or work-package changes.
- **Still open:** Worker delivery, synchronized video, valid calibration, road regions/gates, contextual integrations, and Vercel deployment. This remains a fixture-backed UI; unavailable data is never silently replaced with zero. No measured environmental-impact claim was added.

### 7 November 2026, 18:22 America/New_York (23:22 UTC)

- **Who:** Mert
- **Done:** Fixed the reported MapLibre worker-loading overlay in `frontend/src/components/CameraMap.tsx`. An explicit bundled worker URL now emits a matching same-origin hashed asset instead of relying on an inferred sibling URL. Recorded the regression and evidence in `design-qa.md`.
- **Completed:** Production build passes. The emitted worker has matching SHA-256 bytes, HTTP 200, and JavaScript MIME. Fresh development and production browser checks render streets and four markers without warnings/errors; zoom, fit, camera selection, detail navigation, and remounts work. The original localhost tab is reloaded and usable. No shared-contract, calculation, or design changes.
- **Still open:** External tile availability and worker/live-data integration remain separate concerns. Concurrent changes in the shared worktree are preserved and excluded from this focused fix.

### 7 November 2026, 18:58 America/New_York (23:58 UTC)

- **Who:** Mert
- **Done:** Polished `frontend/` while preserving tan/green, bold typography and the overall layout. Added a joined metric readout, geographic station index, consistent camera identifiers, coordinates, more specific headings and compact panel geometry. Separated green map selection from amber/neutral camera health. Replaced count-up and page-entry choreography with exact-value, short selection/menu/update feedback; improved reduced-motion and Escape focus handling. Updated `frontend/README.md` and `design-qa.md`.
- **Completed:** Production build and all 51 backend tests pass. Browser checks cover every workspace menu, four camera destinations, outside/Escape/exclusive dismissal, all modes on all routes, station/map controls, search/filter/sort/reset, detail disclosures/anchors, scenario boundaries/blank validation, brief options, copy feedback and an actual download. Wide, compact and phone layouts, horizontal containment, exact values and reduced motion pass. Before/after comparison passes with no new browser warnings/errors. The browser connection closed during final handoff after verification; localhost remains HTTP 200. No contract or calculation changes.
- **Still open:** Reviewed geometry, independent physical calibration, class mappings, extended reliability and shared hosted persistence/deployment remain separate work. No new data, environmental-impact claim, or cross-camera tracking was introduced.

### 7 November 2026, 19:46 America/New_York (8 November 2026, 00:46 UTC)

- **Who:** Mert
- **Done:** Added camera measurement-readiness facts in `frontend/` using existing geometry, calibration, aggregate, mapping-catalog and emissions fields. Distinguished presence from review and independent calibration, corrected calibration-only estimate wording and stale live-banner copy, and made unavailable scenario grams explicit. Added five frontend semantic tests and a bounded demo path/acceptance record in `design-qa.md`; updated the package README.
- **Completed:** Five readiness tests and the production build pass. Isolated port-3100 desktop/phone checks cover menus, map controls, mode separation, readiness/disclosures, exact brief export, and reduced motion with no browser warnings/errors. The downloaded 1,290-character synthetic brief exactly matches backend output; copy feedback passed but clipboard adapter readback was empty. Scenario 0/20/100 arithmetic retains null grams. The latest tested shared-tree build includes engineering's offline precedence fix; this stream did not edit backend semantics. Original localhost PID 46237 remains running and HTTP 200; the temporary test server/tab were removed.
- **Still open:** Shared geometry review approval, per-camera mapping/provenance and individual calibrated-traversal evidence are not exposed. Public scenario grams, review/context feeds and field validation remain unavailable. Engineering/coordinator must publish and verify combined backend/scientific changes. No geometry, calibration, model, contract, stored metrics or source footage was changed by this checkpoint.


## 7 November 2026, 19:58 America/New_York / 8 November 2026, 00:58 UTC — Mert

- **Done:** Removed the complete overview nature/photo card, sidebar marketing note and team footer. Enlarged and strengthened shared typography, darkened the cream palette, refreshed overview prompts/actions and aligned responsive navigation/context cards. Removed the unused editorial font preload. Updated `frontend/README.md` and `design-qa.md`.
- **Completed:** Production build, five frontend readiness guards, desktop/compact/tablet/phone visual checks, all workspace menus with dismissal/exclusivity, all four camera destinations, register search/filter/sort, brief selections/copy feedback/local download, overview modes and motion/reduced-motion checks. No new production browser warnings/errors were captured. Original localhost PID 46237 remains running; owned port-3100 test servers were stopped intentionally.
- **Open:** Scientific calibration/evidence and hosting/persistence dependencies remain assigned to their existing streams. This UI patch changes no contract, worker, emissions calculation or deployment.


## 7 November 2026, 20:27 America/New_York / 8 November 2026, 01:27 UTC — Mert

- **Done:** Inventoried frontend measurement consumers in `frontend/INTEGRATION.md` and prepared per-pollutant scenario presentation, signed/null/zero guards and exact local brief-export tests, preserving the finished design.
- **Completed:** Fourteen focused frontend semantic/render/export tests and frontend TypeScript checks pass. This is a consumer-preparation checkpoint, not end-to-end measurement acceptance.
- **Open:** Await the documented backend ingestion/registry/read interface before binding route adapters and camera/scenario/brief views. Combined build, isolated accepted-fixture route/read/render/export checks and missing-evidence live checks remain in progress. No transport fields or scientific approval were invented.
