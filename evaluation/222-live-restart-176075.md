# Camera 222: live worker startup checkpoint

**Owner:** Mert
**Updated:** 8 November 2026, 00:19 America/New_York / 8 November 2026, 05:19 UTC
**Verified snapshot:** 8 November 2026, 00:16:47 America/New_York / 05:16:47 UTC
**Status:** Live GPU worker healthy at this snapshot and left running. The job has not completed; no final runtime or allocation-end cleanup acceptance is claimed.

Mert started authorized live job **176075** on `alphagpu01` and verified actual **`cuda:0`** processing, advancing public heartbeats, advancing processed-preview sequences and advancing private bridge media intervals. The existing consolidated production application handled authenticated ingestion, dashboard data and previews without being restarted for this startup. The [scalar checkpoint](./222-live-restart-176075.json) binds the frozen source/profile/recipe and private verification artifacts.

## Startup result

At the verified snapshot, the pipeline had **38 count crossings and 8 completed traversals**, with **zero pending legacy batches and zero pending measurement batches**. The latest checked processed-preview sequence was **3,896**. The API, bridge and authorized private evidence referred to the same live run and approved profile. These are startup software observations, not accepted count or physical-path accuracy.

Supported `ok` minute rows summed to **39.774198 g estimated CO₂** and **0.009009020 g estimated NOₓ**. These values exclude unavailable minutes and do not represent the whole window or all traffic. Full-window baseline/scenario values remain null/unavailable because some minute evidence is insufficient and linked stopped time is null. No savings or supported zero is substituted.

The worker uses unchanged pretrained **YOLO11n/640 at requested 15 FPS**, selected `count-1`, Carter's approved calibration `222-ground-esri-v1-7f52d53d8fc8` and mapping `pretrained-visual-to-emfac2007-v1`. The fixed **20 m** `222-eastbound-through` movement, fleet mixture and **70 °F / 60% relative humidity** remain conditional modeling assumptions. Independent scale, curved-turn eligibility and manually reviewed traversal completion remain unresolved. Source clocks are estimated HLS media UTC, not verified capture UTC.

## Duration and source

The worker requested **21,240 seconds (5h54m)** inside a **six-hour scheduler cap**, without automatic requeue. The allocation's scheduled end is **8 November 2026, 06:12:38 America/New_York / 11:12:38 UTC**; approximately **5h56m of allocation budget remained at the verified snapshot**. That budget is not a promise of continuous successful processing or the exact remaining worker duration. There is no final worker diagnostic yet.

Copied source is pinned to **`7b5818f923dab43815ffd7f74fb2ec9c9ee6c5d3`**; archive SHA-256 `e350faba679a6a57b26a4b06883a43e19cb8e1704044014dab239e2932eb359f`, executed `worker.main` SHA-256 `20ec7e4eaabf7972260ac5be2b5b0ec4953963138f27bdfaf795a729e9e71713`. Frozen recipe SHA-256: `e5c2d2d671a9ca105e52ddfd75bb33d357b7e00659d1236477e35705f6cc174c`. Worker/model source, geometry, registry and public contracts were not changed by this startup.

## Relay repair and shutdown plan

The initial local cleanup guard **incorrectly treated the allocation as ended**, closed its login forward during startup and removed the remote environment file. Mert restored the **same assigned login port without restarting the worker**. The worker retained its already inherited private environment; no credential-file restoration was needed. Original guard/recipe bytes are preserved, and a separate repair record binds the corrected v2 guard. The original guard is not certified by this record.

The running v2 guard now vetoes cleanup while the scheduler queue is active, requires two absent-queue plus terminal-accounting confirmations, and performs a final queue check before cancelling only its own fixed login forward. Private CPU dummy-child/stubbed-SSH checks exercised these guard and termination paths; they are not evidence that actual end-of-allocation cleanup has already happened.

The configured **120-second pretermination warning**, **90-second worker grace** and **100-second launcher grace** allow bounded signal forwarding and cleanup. Compute exit is configured to close its relay and remove any remaining remote credential copy; the local v2 guard closes its own login forward after confirmed job end. It preserves the user's SSH master. An idle-awake process is bound to the guard's lifetime so local idle sleep does not interrupt this scheduled run. No worker, SSH session, relay or cleanup process was stopped or changed by this publication.

An initial preview inspection used an incorrect response field; the corrected `image_data_url` check passed. That was an observation error, not a runtime failure, and required no inference rerun or restart.

## Remaining acceptance

Continuity still depends on the local production application, laptop/network/SSH connection and active allocation. Final worker diagnostics and actual terminal cleanup remain pending. No six-hour completion, sustained throughput, complete footage coverage, independent physical validation or full demo acceptance is claimed. Camera 228's newly positioned gates separately require new human reference events. Raw identifiers, per-vehicle times, evidence payloads, images, credentials and credential paths remain private.
