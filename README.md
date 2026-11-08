# Emission Lens

Live intersection cameras → traffic metrics → modeled emissions estimates → evidence-backed planning tools.

**Team:** Mert and Carter  
**Event:** NYCAIRR × HackBU 2026 (Environment track)  
**Setting:** Four signalized intersections in Torrance, California (Caltrans CCTV 222, 223, 228, 220)

## Pitch

Existing cameras show us traffic. Emission Lens helps us understand its environmental footprint and explore what could improve it.

## What it does

Emission Lens observes public intersection camera feeds, runs GPU vehicle detection and tracking, estimates traffic-related tailpipe **CO₂** and **NOₓ** with documented regional factors, and lets users inspect the evidence behind each estimate. Planners can also explore explicit hypothetical changes (for example shorter queues or a different fleet mix).

Outputs are **modeled emissions estimates**, not measured air quality.

## Status

**Count/evaluation update: 7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC.** Carter enabled only camera 222's designated `count-1` image-space crossing path in `b1a5edf`; `count-2` is unaccepted, and the 220/223/228 image configurations stay disabled/unvalidated. The [222 audit](./evaluation/calibration/222-count-audit.md) reproduces the original human-reference result and preserves endpoint/directional limitations. Independent assisted practice/held-out review now covers selected windows for 222/223/228; these frozen ledgers have `human_confirmed=false`, and human adjudication of 223/228 is prioritized. The [current review report](./evaluation/video_validation/report.md) records 223's provisional aggregate agreement and 228's substantial deficit; it also tracks any superseded practice ledger. No additional camera is approved. Broader full-recording work is deferred, and 220 media remains unavailable in the local review inventory.

The [four camera-222 GPU comparisons](./evaluation/count-check-175806.md) completed at requested 15 FPS. Its two-minute four-camera YOLO11s/1280 benchmark processed **59.94 aggregate FPS**, **14.59–15.63 FPS per camera**, with **780 reader-buffer drops**. This is bounded execution evidence, not loss-free sustained operation. [Frozen 223/228 baseline execution](./evaluation/count-validation-223-228.md) and subsequent assisted comparisons remain separate from human acceptance. Physical calibration, calibrated speed and live estimated emissions remain unavailable. The public count-review-not-reported wording remains a conservative display gap; it does not revoke Carter's separately recorded 222 decision. Earlier paragraphs below retain their dated checkpoints.

**Integration update: 7 November 2026, 21:08 America/New_York / 8 November 2026, 02:08 UTC.** The separately versioned [measurement path](./backend/MEASUREMENT-INGESTION.md) adds authenticated ingestion, server-controlled calibration/mapping approvals, one atomic traffic/emissions/private-evidence snapshot, per-traversal CO₂/NOₓ scenarios and traceable brief export. The independent [HTTP acceptance command](./evaluation/check_measurement_path.py) checks the production routes, restart/reload, original CARB arithmetic, privacy, exact export, revocation and retraction using temporary synthetic-only inputs. Build the frontend first, then run `python3 evaluation/check_measurement_path.py`; the fixed synthetic demo clock must remain inside ingestion retention. These checks establish software behavior, not real calibration or model accuracy.

The cream/forest [identity kit](./branding/README.md) supplies the application mark, favicon and submission-ready wordmarks/icons. The single persistent host remains the operational target; a shared Supabase database and hosted deployment are not configured. Mert and Carter's count review, independent physical calibration, approved class assumptions and a real calibrated traversal still gate live estimated emissions. See [current assignments and acceptance](./Coordination.md).

**Updated: 7 November 2026, 18:55 America/New_York / 23:55 UTC.** Mert demonstrated four-camera CUDA tracking and delivery to the local dashboard on Empire AI job `175627`. A 90-second run delivered 18 persisted batches and 47 temporary annotated previews, with no pending uploads; shutdown correctly marked cameras offline. A separate 120-second benchmark processed 2,655 frames across four cameras and recorded 82 buffer drops across two cameras. This is bounded performance evidence, not evaluated accuracy or capture-to-dashboard latency.

Implemented at the 18:55 checkpoint: per-camera ingestion/tracking, authenticated delivery with restartable retries, validated contract 1.1 records, a durable local store, live/replay/synthetic isolation, synchronized expiring previews, dashboard/history/scenarios/briefs, and 1,296 traceable CARB running-exhaust factors. At that point no real camera geometry was enabled; the later count-only update above supersedes that state for 222/count-1. Calibrated physical traversals, speeds and live emissions remain unavailable until their required evidence exists.

Camera-minutes now use a session-local **estimated HLS media clock**, with rebucketing and explicit revisions when startup backlog improves the time alignment. Capture UTC remains unavailable. The [timing record](./evaluation/timing-alignment.md) documents the method, live check and remaining limitations.

The file store supports one persistent host. Hosted shared persistence and deployment remain open. Fine-tuning job `175644` completed, but its candidate underperformed pretrained YOLO11s in the [held-out comparison](./evaluation/empire-ai-175644-comparison.md) and was not promoted. The scoped 222/count-1 review does not establish four-camera count accuracy, measured air quality or environmental savings.

See [GPU evidence](./evaluation/README.md), [worker setup](./worker/README.md), [ingestion](./backend/INGESTION.md), [Plan.md](./Plan.md), [Agents.md](./Agents.md) and [Worklog.md](./Worklog.md).

## Proposed stack

| Layer | Default |
|---|---|
| Vision worker | Python, FFmpeg/OpenCV, Ultralytics YOLO, ByteTrack |
| GPU | Empire AI (PyTorch/CUDA) |
| Persistence | Supabase / PostgreSQL |
| Web app | Next.js + TypeScript, MapLibre |
| Hosting | Vercel (frontend / short API requests) |

## Repository layout

```text
Plan.md
Agents.md
Worklog.md
contracts/
config/cameras/
worker/
emissions/
backend/
frontend/
infra/
tests/
evaluation/
```

## Cameras

| ID | Location |
|---|---|
| 222 | SR-107 at Carson Boulevard |
| 223 | SR-107 at Torrance Boulevard |
| 228 | SR-107 at 182nd Street |
| 220 | SR-1 at Crenshaw Boulevard |

Use the stable Caltrans HLS master playlists documented in `Plan.md`. Do not hardcode temporary media segment URLs.

## Privacy

No plate recognition, facial identification, or person tracking. Prefer aggregates and provenance in persistent records. Do not commit raw footage to this public repository.

## Licence and attribution

Camera feeds and metadata are from Caltrans / CWWP public traveler-information sources. Emissions methodology targets CARB EMFAC factors with full provenance. Factor sources, model attribution, and licences will be recorded as they are integrated.

## Disclaimer

This repository defines the intended hackathon implementation. It does not certify that the application, models, GPU deployment, or environmental estimates have already been validated.
