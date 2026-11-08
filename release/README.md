# Release and submission readiness

**Owner:** Mert
**Updated:** 8 November 2026, 00:29 America/New_York / 05:29 UTC
**Status:** Draft package prepared for review. Final rehearsal, submission artifacts, licence decision and submission confirmation remain open.

This package owns release preparation only. [Plan.md](../Plan.md) remains authoritative. [DEVPOST.md](./DEVPOST.md) supplies reviewable copy; [DEMO.md](./DEMO.md) supplies the three-minute script and replay fallback. No public release, Devpost submission, external message or contributor/branch/settings change is authorized by these documents. Contributor settings remain on hold.

## Dates and verified event requirements

The [official hacker guide](https://docs.google.com/document/d/1A_yN6PBLpxP6pi_jx6evy6E3juQ5Wx8r_EVnKHujdqU/edit), reread on 8 November, requires a complete Devpost submission, public source, formal track selection, honest AI-use disclosure and an in-person judging demonstration. It expects project development within hacking hours and recommends frequent commits. Judging considers originality, design, utility/impact, execution and technical complexity.

| Checkpoint | America/New_York, 8 November 2026 | UTC, 8 November 2026 | Authority |
|---|---|---|---|
| Feature freeze target | 09:00 | 14:00 | Internal Plan milestone |
| Submission/materials ready target | 10:00 | 15:00 | Internal Plan milestone |
| Complete Devpost submission | 11:00 | 16:00 | Official hacker guide |
| Required judging expo | 11:30–14:30 | 16:30–19:30 | Official hacker guide |

Hacking hours began 7 November at 13:00 New York / 18:00 UTC. The guide does not impose a three-minute pitch or mandatory video duration. Three minutes is the team's rehearsal format. Exact Devpost fields, upload specifications, team registration and existing submission state are **unverified**; the public event page could not be retrieved during this review. Check the actual [event form](https://nycairrhackbu2026.devpost.com/) before finalizing uploads.

## Evidence and permitted claims

| Item | Supported wording and exact evidence | Boundary |
|---|---|---|
| Camera-222 real delivery | Completed job 175979: 90 s paced replay produced 30 count-1 crossings / 8 persisted completed traversals; separate 60 s live produced 17 / 4. [Record](../evaluation/222-integration-175979.md) | These are pipeline outputs under approved assumptions, not manually validated counts on that replay clip. Job ended; no continued operation is inferred. |
| Conditional estimated pollutants | Historical supported replay minute: 35.741459 g CO₂ / 0.006533736 g NOₓ. Historical supported live minute: 17.345262 g / 0.003161844 g. [Scalar receipt](../evaluation/222-integration-175979.json) | Supported `ok` minute rows only. Another minute in each mode is insufficient; whole-window baseline remains null. Never call these all-traffic totals. |
| Physical assumptions | Camera 222 uses owner-approved fixed 20 m movement, documented visual-class mixtures, 70 °F / 60% relative humidity. [Profile scope](../backend/222-HANDOFF.md), [mapping basis](../evaluation/calibration/class-mapping-v1.json) | Independent scale/path/manual-traversal checks remain open. Truck labels are frame-box occurrences, not deduplicated observed VMT; car/regulatory-category weights are assumptions. Weather is not a current observation. |
| Processing continuity | Job 175979 live processed 1,094 frames and recorded 265 buffer drops plus one excessive-source-gap issue. [Run limits](../evaluation/222-integration-175979.md) | Does not establish complete capture coverage, sustained reliability or validated capture latency. |
| Current local observation | Read-only `GET /api/cameras?mode=live` on port 3138 at 8 November 05:18:30 UTC / 00:18:30 New York returned camera-222 heartbeat 05:18:26.557043 UTC and reported/displayed `live`; source capture timestamp remained null. | One dated public API observation. The coordination handoff identifies job 176075 as running; no completed-job receipt is established by this observation. Recheck during rehearsal. |
| Current application topology | One production application on loopback port 3138 owns dashboard, ingest and process-local preview memory. [Restoration evidence](../backend/222-HANDOFF.md) | Local process supervision and durable file storage, not a shared hosted deployment. Private runtime configuration stays private. |
| Camera-222 count study | Original n/640 result: 66 human events, 67 predictions, 61 matched; recall 92.42%, precision 91.04%, total count error +1.52%. [Audit](../evaluation/calibration/222-count-audit.md) | One two-minute daytime interval, one annotator and gate. Literal half-open boundary sensitivity changes recall/precision/error to 93.75% / 89.55% / +4.69%; directional errors differ. Do not advertise a general accuracy percentage. |
| Camera 223 | Owner-enabled count-1 on assisted review; separate 15 m movement/registry preparation. [Acceptance](../evaluation/calibration/223-count-acceptance.json), [handoff](../backend/223-HANDOFF.md) | Human-reference metrics and configured delivery acceptance are not established by enablement. Pending handoff may be superseded by later evidence. |
| Cameras 228 / 220 | 228 relocated gates have a new practice execution receipt; 220 has a review plan. [228 record](../evaluation/228-redraw-practice.md), [220 plan](../evaluation/video_validation/220-review-plan.md) | New 228 gates need their own visual reference; older-gate accuracy scores do not transfer. 220 review remains queued. No four-camera measurement acceptance. |
| Four-camera GPU benchmark | Job 175806: 120 s, YOLO11s/1280, 59.94 aggregate FPS, 780 reader-buffer drops. [Benchmark](../evaluation/count-check-175806.md) | Different model/settings from current n/640 profile. Bounded execution only; no loss-free or accuracy claim. |
| Factor catalog | 1,296 selected EMFAC2025 v2.1.1 RUNEX CO₂/NOₓ factors with source bytes, units and hashes. [Receipt](../emissions/data/la-2026/receipt.json) | Catalog validation does not validate a camera or class mixture. No separate ordinary-idle addition; no extra EV discount. |
| Heat layer and brief | Supported-minute camera-point CO₂ visualization, precise NOₓ readouts, mode isolation, evidence disclosure and actual-record exports. [UI evidence](../frontend/HEATMAP.md), [delivery checks](../backend/222-HANDOFF.md) | Screen-pixel glow is not physical dispersion, exposure or health risk. Retained snapshots carry their own timestamps and current processing status. |
| Scenarios | Per-traversal calculation and signed per-pollutant output are implemented. [Method](../emissions/SCENARIOS.md) | Demonstrated real stopped-time evidence is null; positive shorter-stop scenario/change remains unavailable. Synthetic tests do not establish real savings. |
| Detector selection | Tuned candidate underperformed the held-out pretrained comparator and was not promoted. [Comparison](../evaluation/empire-ai-175644-comparison.md) | That YOLO11s/1280 image-level study is not n/640 crossing or traversal accuracy. No validated Tesla/EV claim. |

Never claim measured AQI, pollutant concentration, engine operation, health improvement, demonstrated emissions savings, independent full physical validation or deployment to a public agency. Refer to observed **stopped time**; scenario ranges are not statistical confidence intervals. Avoid equating a fresh processing heartbeat with known source capture time.

## Source and licence inventory

This is an attribution inventory and decision checklist, not a project-wide licence grant or complete transitive dependency audit. Mert and Carter remain the authors. Factual library/model credits are separate from development-assistance disclosure.

**Decision note added 8 November, 00:29 America/New_York / 05:29 UTC:** [Concrete licence choices](./LICENSING-DECISION.md) compare the current-stack AGPL route, appropriate Enterprise rights and a separately authorized future replacement. Mert and Carter have not selected a path; no licence is applied by these release documents.

| Component | Attribution and retained evidence | Release action |
|---|---|---|
| Project code | Public source and Mert/Carter development history; no root project licence declared at this checkpoint. | Mert/Carter must choose and document the intended licence/compliance path. Do not silently apply a permissive licence to the whole tree. |
| Ultralytics detector and ByteTrack implementation | Pinned worker package and pretrained YOLO11 weights; [official AGPL-3.0 / Enterprise terms](https://www.ultralytics.com/license). | Resolve applicable obligations for the code/model/distribution. Public visibility and a credit alone do not settle compliance. No purchase or licence acceptance is authorized here. |
| Next.js, React/React DOM, Phosphor | Direct lockfile entries identify MIT licensing. | Preserve applicable copyright/licence notices in distributed components; inspect transitive dependencies before calling the inventory complete. |
| MapLibre GL JS | Direct lockfile entry identifies BSD-3-Clause. | Preserve its required notices. |
| TypeScript and Python/runtime dependencies | TypeScript lock entry identifies Apache-2.0; Python packages pinned in [worker requirements](../worker/requirements.txt). | Retain bundled upstream notices and audit the actual exported dependency set, including PyTorch, OpenCV and FFmpeg distribution choices. |
| Map tiles/data | [OpenFreeMap](https://openfreemap.org/quick_start/), OpenMapTiles, [OpenStreetMap contributors / ODbL](https://www.openstreetmap.org/copyright). | Keep visible map attribution in the app, screenshots and video. Attribution control is enabled; final exported media still needs review. |
| Fonts and wordmark | [Manrope OFL](../frontend/src/app/fonts/Manrope-OFL.txt), [Lora OFL](../frontend/src/app/fonts/Lora-OFL.txt); outlined Manrope wordmark in [identity kit](../branding/README.md). | Notices are present; retain them with supplied fonts/derived assets as applicable. Lora is retained but not currently loaded. |
| Camera feeds/metadata | Caltrans/CWWP; [portal](https://dot.ca.gov/programs/traffic-operations/traveler-information/cwwp), [conditions](https://dot.ca.gov/conditions-of-use); stable source URLs in Plan. | Credit the source; review public media and third-party exceptions. Keep raw footage out of Git, minimize incidental identifiers and remove private replay clips after their authorized purpose. |
| Emissions factors | CARB EMFAC2025 v2.1.1, Los Angeles (SC), 2026 Annual; [provenance](../emissions/data/la-2026/receipt.json) and [method](../emissions/README.md). | Preserve source terms, hashes and transformation attribution. No CARB endorsement or broader source licence is asserted. |
| Compute | Empire AI; per-job device/configuration/limitations in [evaluation](../evaluation/README.md). | Credit actual GPU use and identify current versus completed runs correctly. |
| Generated illustration | Retained historical illustrative image documented in [frontend package notes](../frontend/README.md), not currently rendered. | If reused in submission media, label it generated illustration, not CCTV or a Torrance observation. |

## Final submission checklist

Completed preparation is distinct from submission. Empty boxes below require an actual check; none is inferred from this draft.

- [x] Public source repository and development history exist.
- [x] Reviewable Devpost copy, evidence ledger and three-minute script prepared in this package.
- [x] Official guide requirements identified; Environment track is available.
- [x] Completed GPU execution, factor provenance, bounded real delivery and scoped count evidence are recorded.
- [x] Brand icon/wordmarks exist in [the identity kit](../branding/README.md).
- [ ] Mert/Carter confirm team registration, track selection, actual AI use and all live Devpost fields/upload specifications.
- [ ] Mert/Carter record a choice and covered scope in the [licence decision note](./LICENSING-DECISION.md), complete its corresponding-source/notices/distribution checks and retain required source/data/asset notices.
- [ ] Rehearse the actual displayed revision, live heartbeat/preview, supported-minute values, unavailable windows, scenario limits and brief/export together.
- [ ] Prepare a current, authorized, visibly labeled replay through the same pipeline. Verify its media provenance, expiry/retention, actual mode isolation and availability at judging time; do not relabel old receipts as current.
- [ ] Capture reviewed screenshots and any required video. Retain map credits and review incidental identifiers. No raw media enters this public repository.
- [ ] Confirm actual accessible demo destination; do not supply loopback as a public URL or claim a hosted deployment.
- [ ] Bind final source commit and its matching passing CI run; record remaining scientific/operational limits. No redundant build competes with active streams.
- [ ] Both Mert and Carter can explain observations versus assumptions, RUNEX/no ordinary-idle addition, null versus zero, mode separation, model choice, private evidence and current failure handling.
- [ ] Submit the complete Devpost entry before 11:00 New York / 16:00 UTC; verify the event submission confirmation and saved entry.
- [ ] Confirm assigned judging table and attend the required expo. Submission does not substitute for the demo.

## Remaining blockers and update discipline

For submission readiness: exact form/registration status, licence/compliance decision, reviewed media, fresh replay availability, combined timed rehearsal and actual submission confirmation remain open. A video requirement is unknown, rather than assumed mandatory. Contributor-sidebar cosmetics remain on their separate hold and do not justify branch/settings changes during preparation.

For scientific/operational acceptance: independent scale/path/traversal checks, broader human count review, camera-223 configured delivery, camera-228 new-gate reference/acceptance, camera-220 review, linked stopped evidence, longer forced-outage/restart tests and shared hosting remain separate. They need not all be solved to submit an honestly scoped prototype, but unfinished items must not be described as completed features or validated outcomes.

Before submission, reread the latest dated evidence and update these scoped claims if another camera or run completes. Never overwrite old study results, transfer a score to a different gate/model/clip, expose private registries or change timestamps to keep historical output inside a rolling window.
