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

**Status note (7 November 2026, 15:55 America/New_York / 20:55 UTC):** Mert verified pretrained vehicle detection on Empire AI using his account: YOLO11n processed 50 live frames from camera 222 on an H100 10 GB slice. The [evaluation record](./evaluation/README.md) includes the script, diagnostics, versions, and limitations. Carter’s ingestion, frame collector, detector wrapper, and labeling-dataset tools are implemented; all 39 Python tests passed on the compute node after integrating his latest commit. Mert’s dashboard still reads fixtures and is not connected to the worker. Tracking, calibration, CARB factors, and live emissions remain open. Fine-tuning needs reviewed labels and held-out evaluation; no reviewed dataset is available yet.

See **[Plan.md](./Plan.md)** for the full master plan, **[Agents.md](./Agents.md)** for coding-agent work packages and rules, and **[Worklog.md](./Worklog.md)** for timestamped notes of completed work.

**Docs note (7 November 2026, 14:28 America/New_York / 19:28 UTC):** agent instructions now require a timestamped worklog entry and a push on every turn that leaves the tree in a sound state. Teammate-facing text names Mert and Carter only.

## Proposed stack

| Layer | Default |
|---|---|
| Vision worker | Python, FFmpeg/OpenCV, Ultralytics YOLO, ByteTrack |
| GPU | Empire AI (PyTorch/CUDA) |
| Persistence | Supabase / PostgreSQL |
| Web app | Next.js + TypeScript, MapLibre |
| Hosting | Vercel (frontend / short API requests) |

## Repository layout (planned)

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
