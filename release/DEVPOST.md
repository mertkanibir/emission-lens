# Emission Lens Devpost draft

**Owner:** Mert
**Updated:** 8 November 2026, 02:27 America/New_York / 07:27 UTC
**Status:** Reviewable draft; not submitted. Mert and Carter confirm the final form, disclosure and attachments before submission.

**Scope note (8 November 2026, 01:10 America/New_York / 06:10 UTC, Carter):** Cameras 222 and 223 are accepted for counting and calibrated for emissions. Cameras 220 and 228 are excluded: both failed the held-out count screen (−29% and −42%). Ground calibration, movement distances and fitted stopped-time thresholds are added below, each linked to its evidence.

**Evidence refresh (8 November 2026, 01:53 America/New_York / 06:53 UTC, Mert):** Original configured223replay 176174 and current-generation 222 stopped-policy audit 176255 now pass their scoped integration checks. New complete-minute scenario and queue software is in isolated acceptance; no new live deployment or field accuracy is implied. Preserve signed hypothetical changes, including supported 0 g, rather than claiming demonstrated savings.

**Accepted local deployment (8 November 2026, 02:27 America/New_York / 07:27 UTC, Mert):** Both camera 222/223 LIVE paths are verified on the final 685dc72 local application, with supported-minute pollutants/linked stopped evidence, provisional visible queue lower bounds, mode separation and current authenticated evidence/fresh-process/original-factor acceptance. The user browser is on 3151. This is bounded local integration acceptance; no public hosted destination, field accuracy, real-world savings or Devpost submission is inferred.

The copy below describes the demonstrated camera-222 path and the accepted camera-223 configuration. It does not extend acceptance to 220 or 228. Use the [readiness and claims record](./README.md) and [three-minute demonstration](./DEMO.md) when assembling the submission.

## Submission identity

| Field | Draft value |
|---|---|
| Project | Emission Lens |
| Team | Mert and Carter |
| Event | NYCAIRR × HackBU 2026 |
| Track | Environment |
| Source | https://github.com/mertkanibir/emission-lens |
| Short description | Turn public traffic cameras into traceable estimated emissions, with visible assumptions and evidence gaps. |
| Demo destination | In-person single-host demonstration. A public hosted URL is not established. |

The headings below are a preparation format, not a verified inventory of the live Devpost form. The [official hacker guide](https://docs.google.com/document/d/1A_yN6PBLpxP6pi_jx6evy6E3juQ5Wx8r_EVnKHujdqU/edit) establishes the requirements in the readiness checklist. Exact form fields and any video-upload requirement still need direct verification.

## Inspiration

Existing traffic cameras show what a junction looks like. We wanted to make the next question easier to investigate: what could the observed traffic mean for tailpipe emissions, and what evidence supports that estimate?

Emission Lens connects traffic observations to a reproducible calculation while making missing evidence visible. Its purpose is to support investigation, rather than turn a camera image into an unsupported air-quality claim.

## What it does

Emission Lens processes public Caltrans intersection feeds, detects and tracks vehicles within each camera, and counts crossings of reviewed image gates. For an approved movement, completed vehicle traversals feed a server-side calculation of estimated tailpipe CO₂ and NOₓ using CARB EMFAC running-exhaust factors.

The dashboard combines a geographic camera map, processing status, traffic history, timestamped supported-minute estimates and a reviewable investigation brief. Live, replay and synthetic modes remain separate. An unavailable estimate stays unavailable. A supported minute can appear on the map even when incomplete evidence prevents a whole-window total.

Two cameras are in scope. Camera 222 (SR-107 at Carson Boulevard) uses an approved 20 m eastbound movement; camera 223 (SR-107 at Torrance Boulevard) uses a 15 m southbound movement. Both share the documented fleet mixture and weather assumptions. Cameras 220 and 228 were tested and excluded because their counts failed held-out screening; we chose not to show numbers we know undercount. The camera-point heat layer visualizes estimated CO₂; it is not a concentration, exposure or health-risk map.

## How we built it

A Python worker ingests HLS video and runs pretrained YOLO11n with independent ByteTrack state per camera on an Empire AI GPU. The current camera-222 profile uses 640-pixel inference and requests 15 sampling frames per second. Requested sampling is not guaranteed processed coverage.

Authenticated ingestion validates records and resolves versioned movement and class-mapping approvals on the server. One durable local snapshot retains traffic, both estimated pollutants and private calculation evidence. The Next.js/TypeScript dashboard reads that same authority and displays matching temporary previews. MapLibre supplies the map. Supabase and shared serverless persistence remain future deployment work.

The retained CARB catalog contains 1,296 selected RUNEX factors with original source bytes, request settings and checksums. Total traversal time includes stops. We do not add an ordinary-idle term to RUNEX, which would double-count ordinary driving-cycle idling.

Physical distances come from a camera-to-ground calibration. For each camera we matched road-level points (crosswalk corners, stripe ends, lane-line ends) between the camera frame and current aerial imagery, fitted a pixel-to-metre homography, held some points back for validation, and rejected points that were not on an identifiable road feature, with the reason recorded. Movement lines were then constructed at a measured ground distance from the accepted counting gate. Stopped time uses a per-camera image-motion threshold fitted against calibrated ground speed (below 0.5 m/s stopped, above 1.5 m/s moving).

Sampling rate mattered more than model size. HLS delivers about 10 seconds of video per burst; at 5 frames per second, dense platoons broke tracks and camera 222 undercounted by 21–59%. At 15 frames per second the same gate matched the hand count.

## Challenges

Detecting a vehicle in several frames is different from counting one crossing. A crossing is also different from a complete traversal of a supported physical movement. We kept these observations separate and withheld estimates when their dependencies were missing.

Two of four cameras failed their count screens. Camera220's aligned held-out comparison has 74 matched passages and 32 misses against its partial assisted reference. Camera228's revised-gate practice run remains about 42% below its assisted reference; further detector/resolution comparisons did not establish acceptance. The exact historical miss causes remain unproven. Some camera views also offer few matchable road features, which limits calibration coverage.

HLS backlog, dropped frames, occlusion and camera geometry complicate timing and coverage. Our media clock is an estimate; capture UTC and capture-to-dashboard latency remain unavailable. Fleet weights, weather and fixed movement distance remain explicit assumptions requiring further validation.

## Accomplishments

We demonstrated real GPU processing and authenticated delivery to the local dashboard, including separate replay and live records, durable reload, private contribution checks and brief exports. A completed bounded camera-222 run produced persisted supported-minute CO₂/NOₓ estimates under its approved assumptions. The dashboard preserves unavailable intervals instead of presenting partial evidence as a complete total.

We also evaluated a fine-tuned detector candidate and retained the pretrained model when the candidate underperformed: on 60 human-reviewed held-out frames, any-vehicle F1 was 90% pretrained versus 83% fine-tuned. Camera-222 count evaluation, assisted reviews of other cameras and bounded processing benchmarks are documented separately, with their own settings and limits.

Scoped evaluation results; reference type and validation scope differ by row:

| Check | Result | Reference | Evidence |
|---|---|---|---|
| Camera 222 counts (count-1, clip 6:00–8:00) | Recall 92.4%, precision 91.0%, total +1.5% | Human crossing-by-crossing key | [count audit](../evaluation/calibration/222-count-audit.md) |
| Camera 223 counts (count-1, clip 6:00–8:00) | Recall 91.9%, precision 96.9%, total −5.2% | Assisted review, not human | [acceptance](../evaluation/calibration/223-count-acceptance.json) |
| Camera 220 / 228 counts | −29% / −42% totals; excluded | Assisted review | [review status](../evaluation/video_validation/report.md) |
| Camera 222 ground calibration | Validation RMS 1.41 m; movement 20.0 m (19.3–20.5 m leave-one-out) | Held-back aerial points | [movement](../evaluation/calibration/222-movement-eastbound.json) |
| Camera 223 ground calibration | Validation RMS 1.08 m; movement 15.0 m (14.5–15.4 m) | Held-back aerial points | [movement](../evaluation/calibration/223-movement-southbound.json) |
| Stopped-time thresholds | Balanced accuracy 95.4% (222), 95.9% (223) | Calibration-derived ground speed, not human | [222](../evaluation/calibration/222-stop-threshold.json), [223](../evaluation/calibration/223-stop-threshold.json) |
| Stopped time on recorded video (222 + 223) | 79 completed traversals, all 0 s linked stopped time; 20% shorter-stop scenario correctly 0% change; zero reader drops | Independent original-CARB arithmetic check | [replay check](../backend/STOPPED-REPLAY-222-223-176075-2.md) |

## What we learned

The most useful environmental output is one someone can question. Source timing, observation scope, movement distance, vehicle-class assumptions and factor versions all affect the meaning of a number. Making those dependencies inspectable is part of the product.

## What is next

Independently validate physical scale, movement eligibility and completed traversals; extend human crossing review and longer outage/restart tests. Bring cameras 220 and 228 back through a fresh practice-and-held-out cycle with relocated gates; their calibrations, movements and stopped-time thresholds are already prepared. Replace the assumed sedan/SUV split with regional VMT shares. Add shared hosting and contextual layers after the core evidence path is reliable.

Shorter-stop comparisons are implemented and fitted stopped-time thresholds are configured for both cameras; the new two-camera recorded-video integration check passed on step 176075.2. Its 79 completed traversals had supported zero linked stopped time, preserving valid zero scenario changes and unavailable empty minutes. Vehicles rarely stop inside the measured 15–20 m segments, so expected scenario changes there are small. We do not claim measured air quality, health benefits or demonstrated environmental savings.

## Built with

Python, OpenCV, FFmpeg, PyTorch/CUDA, Ultralytics YOLO11, ByteTrack, Empire AI, Next.js, React, TypeScript, MapLibre GL JS, Label Studio, Caltrans CWWP, CARB EMFAC2025, and Esri World Imagery (calibration reference only; not redistributed).

## AI-use disclosure draft

Mert and Carter used AI assistance for implementation, interface/design exploration, tests, documentation, draft labels and assisted video review. Generated illustration was explored during design; any reused illustrative asset must be identified as generated and separate from camera observations. Mert and Carter made the project decisions and remain responsible for reviewing the code, labels, calculations and final claims.

Specifically: AI assistance pre-classified pretrained "truck" boxes in the training frames and proposed Tesla candidates, which Carter confirmed or rejected; all 60 test frames were reviewed by Mert and Carter in Label Studio. AI assistance reviewed calibration point pairs and flagged unanchored ones for rejection. Training-label provenance is retained in `data/raw/reviewed/provenance.json` (private).

Assisted review is identified as assisted and is not presented as independent human ground truth. Camera 222 has a separately recorded human crossing key with documented boundary and direction limitations. A fine-tuned detector was evaluated and not promoted. Vehicle detection outputs do not establish fuel type, engine operation or measured pollution.

Before pasting, Mert and Carter should confirm this describes their actual assistance and answer any more specific disclosure questions in the final form accurately. Do not replace required disclosure with an authorship credit.

## Attachments and evidence to bind before submission

- Use the [primary wordmark](../frontend/public/brand/wordmark.svg) or [512 px icon](../frontend/public/brand/icon-512.png), retaining the [identity-kit guidance](../branding/README.md).
- Capture the actual demonstrated revision: overview with timestamp/mode/status, camera-222 assumptions and precise pollutant values, unavailable whole-window totals and explicitly scoped complete-minute scenarios, and brief/export. Review incidental identifiers and retain map attribution. Screenshots and a completed demo recording are still pending.
- Link [camera-222 delivery evidence](../evaluation/222-integration-175979.md), [count audit](../evaluation/calibration/222-count-audit.md), [current assisted-review status](../evaluation/video_validation/report.md), [factor provenance](../emissions/data/la-2026/receipt.json) and [heat-map semantics](../frontend/HEATMAP.md).
- State only the runtime status observed at rehearsal. A running job is not a completed benchmark, and historical output is not a currently live scene.
- First-party covered code now uses [AGPL-3.0-only](../LICENSE), with Mert's approved decision recorded [here](./LICENSING-DECISION.md). Verify remaining exact-source, model/binary and third-party notice checks in the [release checklist](./README.md) before marking compliance complete. No public submission or deployment is performed by this draft update.
