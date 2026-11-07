# Worklog — Emission Lens

Running record of repository work. Newest entries first.

Times are shown in America/New_York and UTC. Authors are Mert and Carter only.

---

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
