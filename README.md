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

**Updated: 7 November 2026, 18:30 America/New_York / 23:30 UTC.** Mert demonstrated four-camera CUDA tracking and delivery to the local dashboard on Empire AI job `175627`. A 90-second run delivered 18 persisted batches and 47 temporary annotated previews, with no pending uploads; shutdown correctly marked cameras offline. A separate 120-second benchmark processed 2,655 frames across four cameras and recorded 82 buffer drops across two cameras. This is bounded performance evidence, not evaluated accuracy or capture-to-dashboard latency.

Implemented: per-camera ingestion/tracking, authenticated delivery with restartable retries, validated contract 1.1 records, a durable local store, live/replay/synthetic isolation, synchronized expiring previews, dashboard/history/scenarios/briefs, and 1,296 traceable CARB running-exhaust factors. An optional image-gate metrics engine is available but **no real camera geometry is enabled**. Crossing counts, calibrated traversals, speeds and live emissions remain unavailable until their required evidence exists.

The file store supports one persistent host. Hosted shared persistence and deployment remain open. Reviewed labels and held-out comparison gate model promotion; the pretrained model remains the fallback. No accuracy, measured air quality or environmental-savings claim is established.

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
