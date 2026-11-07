# Worklog — Emission Lens

Running record of repository work. Newest entries first.

Times are shown in America/New_York and UTC. Authors are Mert and Carter only.

---

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
