# Emission Lens demo and replay runbook

**Owner:** Mert; presentation by Mert and Carter
**Updated:** 8 November 2026, 00:19 America/New_York / 05:19 UTC
**Status:** Reviewable three-minute script and operator checklist. Final rehearsal, public demo recording and submission are still open.

This demonstration shows camera observations, conditional **estimated emissions**, explicit missing evidence and a locally exported investigation brief. It does not establish measured air quality, pollutant concentration, health effects or environmental savings. [Plan.md](../Plan.md) remains the authority; the current operational handoff is [backend/222-HANDOFF.md](../backend/222-HANDOFF.md).

## Evidence checkpoint

- Camera 222's completed [job-175979 replay/live check](../evaluation/222-integration-175979.md) is the numerical reference: paced replay produced 30 crossing outputs and 8 completed candidates; bounded live produced 17 and 4. These are pipeline outputs from separate runs, not new manual accuracy scores.
- Its supported replay minute estimates **35.741459 g CO₂ / 0.006533736 g NOₓ**; supported live minute estimates **17.345262 g CO₂ / 0.003161844 g NOₓ**. Each broader window includes a minute with insufficient evidence, so complete-window totals remain null. Do not use these historical values as the expected result of a different run.
- The approved camera-222 profile uses a fixed **20 m** movement, documented fleet mapping, **70 °F / 60% relative humidity**, pretrained YOLO11n at 640 pixels and 15 requested FPS. These inputs support conditional calculations. Independent scale, movement-path and manual traversal validation remain open; weather inputs are assumptions, not current observations.
- The [production handoff](../backend/222-HANDOFF.md) records one application at **http://127.0.0.1:3138**, sharing worker ingestion, measurement ingestion, preview memory and dashboard reads. Mert's public read of `/api/cameras?mode=live` at **05:18:30 UTC** returned camera 222 reported/displayed **live**, with recent processing heartbeat **05:18:26.557043 UTC** and null source-capture timestamp. This is a bounded status observation, not scheduler completion, capture latency or a sustained preview test. Coordination reports job **176075** running; obtain its scalar receipt and genuine matching-frame acceptance before claiming either.
- Camera 223/count-1 is owner-enabled on an explicitly assisted reference; its configured delivery and independent human-reference result remain pending at this checkpoint. Camera 228's revised gates/recount need a fresh reference and remain unapproved. Carter owns camera 220's pending review. Do not present four calibrated/accepted cameras.
- The [heat-map check](../frontend/HEATMAP.md) documents supported-minute camera points, separate live/replay values and offline labels. Heat color/radius is a display treatment, not a plume, exposure area or health-risk category. Previous completed workers are stopped; current live state must be checked afresh.

## Prepare the presentation

Mert checks this list with Carter before the 09:00 America/New_York feature-freeze target, rehearses before the 10:00 materials-ready target and completes submission before **11:00 America/New_York / 16:00 UTC on 8 November**. These are targets from [Plan.md §18–20](../Plan.md), not completed steps.

- [ ] Confirm the one application on port 3138 is the intended reviewed build and reads the authoritative store. Use the existing private ready handoff; do not rebuild, restart or reconfigure an active service during the pitch.
- [ ] Have Mert confirm the current job/run, model/settings, run mode, active relay, recent advancing processing heartbeats, genuine matching frame/overlay previews and persisted rows. A visible old frame or selected Live mode alone is insufficient. If no fresh worker exists, start the presentation in the clearly labeled fallback below.
- [ ] Confirm a supported camera-222 minute is inside the rolling reporting hour, and note its actual timestamp, CO₂, NOₓ and disclosed assumptions. Observe a later refresh and confirm mode separation. Keep actual values on screen rather than reciting a historical sample.
- [ ] Open the tabs below and confirm each renders. Camera/site timestamps use **America/Los_Angeles**; the event schedule uses **America/New_York**, and stored timestamps are UTC. Say which time basis is visible.
- [ ] Confirm both speakers can explain crossing outputs versus completed traversals, approved assumptions versus independent validation, and a snapshot versus a complete reporting-window total.
- [ ] Confirm the brief preview and an actual downloaded text attachment match for the selected mode/camera. Preserve unavailable values and limitations. Save locally; no external message is sent.
- [ ] Prepare a reviewed screenshot or recording, a replay evidence tab and the local backup clip. Remove incidental identifying detail from public media; keep raw footage, credentials, private registries and per-vehicle IDs out of the public repository and presentation.
- [ ] Close private terminals, account menus, notification banners and credential/evidence files before screen recording. Show only public aggregate pages and selected reviewed diagnostic evidence.
- [ ] Rehearse the timed sequence once with the fallback, verify local downloads and record the final build/commit and artifact paths in the submission checklist. These actions are still pending until actually performed.

### Open tabs

Use the existing local application; these are ordinary GET pages, not commands to launch workers.

| Tab | URL or file | Purpose |
|---|---|---|
| Live overview | `http://127.0.0.1:3138/?camera=222&view=emissions` | Supported-minute map snapshot, status, timestamp and assumptions |
| Live camera | `http://127.0.0.1:3138/cameras/222?mode=live&reduce=20` | Observation, recorded minute history, evidence and unavailable scenario |
| Replay overview | `http://127.0.0.1:3138/?camera=222&mode=replay&view=emissions` | Visibly distinct replay mode; never relabel it live |
| Replay camera | `http://127.0.0.1:3138/cameras/222?mode=replay&reduce=20` | Same pipeline/read path in replay mode |
| Brief | `http://127.0.0.1:3138/brief?camera=222&mode=live&reduce=20` | Reviewable investigation brief and local attachment export; use `mode=replay` during fallback |
| Historical evidence | [222 integration record](../evaluation/222-integration-175979.md), [scalar receipt](../evaluation/222-integration-175979.json) | Dated completed GPU evidence and limitations if current data is unavailable |

The camera page exposes `#observation`, `#traffic`, `#emissions`, `#scenario` and `#evidence`. The frontend currently has no arbitrary historical-window query control. Adding `from`/`to` to a page URL does not revive old rows.

## Three-minute script

The segments total **180 seconds**. Mert drives the browser; Carter explains the vision/modeling boundary. Select either live or replay at the beginning and preserve that mode through camera, scenario and brief views.

| Time | Speaker and action | Spoken script |
|---|---|---|
| 0:00–0:20 · 20 s | **Mert:** overview, camera 222 selected | “Existing intersection cameras show traffic. Emission Lens connects those observations to traceable estimates of tailpipe CO₂ and NOₓ. We are showing one camera path under approved assumptions, with the evidence and limits visible.” |
| 0:20–0:50 · 30 s | **Carter:** camera `#observation`; show processing state and a matching frame if fresh | **Live:** “This camera is being processed on an Empire AI GPU. The fresh processing timestamp and matching frame show current delivery.” **Replay:** “This is recorded camera footage replayed through the same processing pipeline. The application labels it Replay and keeps it separate from live totals.” Then: “Temporary tracking is local to this camera session; crossing a selected gate creates a count.” |
| 0:50–1:20 · 30 s | **Carter:** `#traffic`, recorded-minute history, then `#evidence` | “Crossing outputs and completed traversals are different. A completed traversal needs an entry, an exit and continuity within one camera session. For this demonstration we use an owner-approved 20-metre movement, fleet mapping and weather assumptions. Independent physical and traversal validation remain open.” |
| 1:20–1:50 · 30 s | **Mert:** overview emissions pin or `#evidence` supported-minute snapshot | “This timestamped minute has enough completed evidence for conditional estimated emissions. We can inspect its CO₂ and NOₓ separately. The warmer point is a visualization of estimated CO₂, not measured air quality. A different minute may lack evidence, so a whole-window total can remain unavailable even with this snapshot.” |
| 1:50–2:15 · 25 s | **Carter:** `#scenario`, show 20% assumption and unavailable pollutant change | “The comparison asks what would happen if stopped time were lower. This real profile does not yet supply linked stopped intervals, so a positive reduction returns unavailable. We do not manufacture a saving. Ordinary stops are already included in the running-exhaust factors; adding a second idle term would double-count them.” |
| 2:15–2:40 · 25 s | **Mert:** brief in the same mode; save the local attachment | “The brief brings the reporting period, available evidence and limitations together for a planner to review. It can be exported locally. It does not contact anyone or claim that a proposed intervention has already worked.” |
| 2:40–3:00 · 20 s | **Carter:** finish on evidence/overview | “We have demonstrated the GPU-to-dashboard path and reproducible conditional estimates. Next we need independent scale and traversal checks, stronger held-out tracking evidence and longer outage/recovery tests before broader use. The value is a transparent starting point for investigation.” |

If a real supported minute is absent at 1:20, Mert says: “The current reporting hour has insufficient evidence. This dated completed-run record shows what the pipeline previously delivered, under the same disclosed assumptions.” Show the historical record with its timestamp; do not describe it as current data. If the brief is empty, export its honest insufficient-evidence text.

## Replay and interruption fallback

1. If the live heartbeat stops, no matching preview appears or the feed stalls, say: **“Live processing is unavailable; we are switching to labeled replay.”** Keep the actual offline/degraded state visible. Do not call a stale image live.
2. Select Replay using the mode control or the prepared replay URL; keep the same camera, then follow the timed sequence. A replay selection is not itself proof that a replay worker is running.
3. A fresh replay must be arranged by Mert using the existing reviewed operator handoff, approvals and same ingestion/measurement/preview pipeline. This runbook grants no new allocation, training or job-start permission. Use separate replay outboxes; verify no live contamination and retain replay's actual playback clock.
4. The completed job-175979 reference clip is `222_20261108T003312Z.ts`, SHA-256 `e6db50f024cd61dc13140f24d60dbaa2070d962fda1bde6f2da52f10475401d3`. Its scalar provenance is [recorded here](../evaluation/calibration/222-recording-20261108T003312Z.json). Confirm the existing private local file with Mert; no clip is supplied in this public repository. The different earlier count-review clip does not inherit this run's provenance, or vice versa.
5. Old real/replay rows naturally leave the rolling reporting hour. Do not rewrite recording timestamps, alter the clock, copy historical rows into live mode or install a fabricated approval to keep a heat point visible. If no fresh replay is scheduled, show the dated historical evidence and previously reviewed recording/screenshot, visibly labeled **Recorded demonstration**. This is evidence playback, not a running replay pipeline.
6. Synthetic mode may demonstrate controlled software behavior only when explicitly announced as **Synthetic sample**. It is not the camera-footage fallback and must never be described as observed traffic or used to fill live totals.
7. If tiles or network access fail, use the camera/table/evidence pages or the reviewed local recording. If GPU access fails, show the completed dated GPU receipt. Do not imply continuous execution, capture latency or loss-free coverage from a historical bounded check.

## Final evidence and artifact checklist

| Item | State at preparation | Required final confirmation |
|---|---|---|
| Three-minute narrative and mode-specific URLs | Draft above | Rehearse with Mert and Carter; record elapsed time and any shortened steps |
| Current live process and job 176075 | Mert verified camera-222 Live status and a recent heartbeat at 05:18:30 UTC; scheduler job supplied by coordination | Capture reviewed scalar job/receipt, advancing processing/preview and accepted write evidence; distinguish running from completed |
| Current supported minute | Historical job-175979 example verified | Record the actual rehearsal minute/mode and values; retain missing-window limitations |
| Same-pipeline replay | Historical bounded check verified | Confirm retained private media and fresh scheduled replay, or explicitly use dated recorded-demo evidence |
| Screenshot/demo video | Not created by this document | Select final images/video, source/mode/date labels, privacy review and final file/URL |
| Actual local brief attachment | Earlier exact-export checks recorded | Download from final selected mode, compare with visible brief and retain local artifact |
| Model/data/map/fonts/branding notices | Release attribution review separate | Resolve the release attribution/licence checklist before external distribution |
| Team and track | Mert and Carter; Environment planned | Confirm both Devpost team entries and actual track selection |
| Publication | No submission or public release performed | Mert completes and verifies Devpost confirmation before the deadline |

Remaining scientific and operational limits: [measurement integration](../evaluation/integration-readiness.md), [current assisted review](../evaluation/video_validation/report.md), [222 count audit](../evaluation/calibration/222-count-audit.md), [timing basis](../evaluation/timing-alignment.md). Contributor/account/settings changes remain on hold and are outside this rehearsal.
