# Emission Lens Devpost draft

**Owner:** Mert
**Updated:** 8 November 2026, 00:36 America/New_York / 05:36 UTC
**Status:** Reviewable draft; not submitted. Mert and Carter confirm the final form, disclosure and attachments before submission.

The copy below describes the demonstrated camera-222 path. It does not extend that acceptance to all four cameras. Use the [readiness and claims record](./README.md) and [three-minute demonstration](./DEMO.md) when assembling the submission.

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

The demonstrated emissions path currently centers on camera 222 and an owner-approved fixed 20 m movement, fleet mixture and weather assumptions. Its camera-point heat layer visualizes estimated CO₂; it is not a concentration, exposure or health-risk map.

## How we built it

A Python worker ingests HLS video and runs pretrained YOLO11n with independent ByteTrack state per camera on an Empire AI GPU. The current camera-222 profile uses 640-pixel inference and requests 15 sampling frames per second. Requested sampling is not guaranteed processed coverage.

Authenticated ingestion validates records and resolves versioned movement and class-mapping approvals on the server. One durable local snapshot retains traffic, both estimated pollutants and private calculation evidence. The Next.js/TypeScript dashboard reads that same authority and displays matching temporary previews. MapLibre supplies the map. Supabase and shared serverless persistence remain future deployment work.

The retained CARB catalog contains 1,296 selected RUNEX factors with original source bytes, request settings and checksums. Total traversal time includes stops. We do not add an ordinary-idle term to RUNEX, which would double-count ordinary driving-cycle idling.

## Challenges

Detecting a vehicle in several frames is different from counting one crossing. A crossing is also different from a complete traversal of a supported physical movement. We kept these observations separate and withheld estimates when their dependencies were missing.

HLS backlog, dropped frames, occlusion and camera geometry complicate timing and coverage. Our media clock is an estimate; capture UTC and capture-to-dashboard latency remain unavailable. Fleet weights, weather and fixed movement distance remain explicit assumptions requiring further validation.

## Accomplishments

We demonstrated real GPU processing and authenticated delivery to the local dashboard, including separate replay and live records, durable reload, private contribution checks and brief exports. A completed bounded camera-222 run produced persisted supported-minute CO₂/NOₓ estimates under its approved assumptions. The dashboard preserves unavailable intervals instead of presenting partial evidence as a complete total.

We also evaluated a fine-tuned detector candidate and retained the pretrained model when the candidate underperformed. Camera-222 count evaluation, assisted reviews of other cameras and bounded processing benchmarks are documented separately, with their own settings and limits.

## What we learned

The most useful environmental output is one someone can question. Source timing, observation scope, movement distance, vehicle-class assumptions and factor versions all affect the meaning of a number. Making those dependencies inspectable is part of the product.

## What is next

Independently validate physical scale, movement eligibility and completed traversals; extend human crossing review and longer outage/restart tests; complete camera-223 delivery and resolve camera-228 gate/reference issues before expanding acceptance. Add shared hosting and contextual layers after the core evidence path is reliable.

Shorter-stop comparisons are implemented, but the demonstrated real profile lacks linked stopped-time evidence. Its positive-reduction scenario remains unavailable. We do not claim measured air quality, health benefits or demonstrated environmental savings.

## Built with

Python, OpenCV, FFmpeg, PyTorch/CUDA, Ultralytics YOLO11, ByteTrack, Empire AI, Next.js, React, TypeScript, MapLibre GL JS, Caltrans CWWP and CARB EMFAC2025.

## AI-use disclosure draft

Mert and Carter used AI assistance for implementation, interface/design exploration, tests, documentation, draft labels and assisted video review. Generated illustration was explored during design; any reused illustrative asset must be identified as generated and separate from camera observations. Mert and Carter made the project decisions and remain responsible for reviewing the code, labels, calculations and final claims.

Assisted review is identified as assisted and is not presented as independent human ground truth. Camera 222 has a separately recorded human crossing key with documented boundary and direction limitations. A fine-tuned detector was evaluated and not promoted. Vehicle detection outputs do not establish fuel type, engine operation or measured pollution.

Before pasting, Mert and Carter should confirm this describes their actual assistance and answer any more specific disclosure questions in the final form accurately. Do not replace required disclosure with an authorship credit.

## Attachments and evidence to bind before submission

- Use the [primary wordmark](../frontend/public/brand/wordmark.svg) or [512 px icon](../frontend/public/brand/icon-512.png), retaining the [identity-kit guidance](../branding/README.md).
- Capture the actual demonstrated revision: overview with timestamp/mode/status, camera-222 assumptions and precise pollutant values, unavailable whole-window/scenario state, and brief/export. Review incidental identifiers and retain map attribution. Screenshots and a completed demo recording are still pending.
- Link [camera-222 delivery evidence](../evaluation/222-integration-175979.md), [count audit](../evaluation/calibration/222-count-audit.md), [current assisted-review status](../evaluation/video_validation/report.md), [factor provenance](../emissions/data/la-2026/receipt.json) and [heat-map semantics](../frontend/HEATMAP.md).
- State only the runtime status observed at rehearsal. A running job is not a completed benchmark, and historical output is not a currently live scene.
- First-party covered code now uses [AGPL-3.0-only](../LICENSE), with Mert's approved decision recorded [here](./LICENSING-DECISION.md). Verify remaining exact-source, model/binary and third-party notice checks in the [release checklist](./README.md) before marking compliance complete. No public submission or deployment is performed by this draft update.
