<h1 align="center">Emission Lens</h1>

<p align="center">Camera-based vehicle tracking, calibrated movement estimates, and traceable CO2 / NOx analysis.</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-000000?style=plastic&logo=nextdotjs&logoColor=white" alt="Next.js" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-149ECA?style=plastic&logo=react&logoColor=white" alt="React" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?style=plastic&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js%2024-339933?style=plastic&logo=nodedotjs&logoColor=white" alt="Node.js 24" /></a>
</p>

<p align="center">
  <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3776AB?style=plastic&logo=python&logoColor=white" alt="Python" /></a>
  <a href="https://docs.ultralytics.com/"><img src="https://img.shields.io/badge/YOLO-111F68?style=plastic&logo=yolo&logoColor=white" alt="YOLO" /></a>
  <a href="https://opencv.org/"><img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=plastic&logo=opencv&logoColor=white" alt="OpenCV" /></a>
  <a href="https://maplibre.org/"><img src="https://img.shields.io/badge/MapLibre-396CB2?style=plastic&logo=maplibre&logoColor=white" alt="MapLibre" /></a>
</p>

<p align="center">Built for <strong>NYCAIRR × HackBU 2026</strong> · <a href="https://devpost.com/software/emission-lens">Devpost</a></p>

## Project preview

<p align="center">
  <a href="https://devpost.com/software/emission-lens"><img src="https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/005/815/848/datas/original.png" alt="Static Emission Lens camera 223 dashboard capture with processed vehicle boxes and a dated supported-movement estimate" width="960" /></a>
</p>

*Static Devpost capture from 8 November 2026. The camera image, LIVE label, and estimates describe the captured session, not current service availability or independently validated field accuracy.*

<details>
<summary>View the synthetic network map and planning PDF</summary>

<p align="center">
  <a href="https://devpost.com/software/emission-lens"><img src="https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/005/815/849/datas/original.png" alt="Emission Lens network map and camera register displaying explicitly labeled synthetic sample data" width="960" /></a>
</p>

*The network view uses labeled synthetic examples. Its four illustrated stations do not expand live or replay camera eligibility.*

<p align="center">
  <a href="https://devpost.com/software/emission-lens"><img src="https://d112y698adiu2z.cloudfront.net/photos/production/software_photos/005/815/846/datas/original.png" alt="Dated Emission Lens planning PDF for camera 223 with estimated CO2, evidence coverage, and review notes" width="960" /></a>
</p>

*Dated planning PDF with scoped estimated emissions, not measured air quality. Images are from the [team Devpost gallery](https://devpost.com/software/emission-lens); existing Caltrans, mapping, and third-party attribution boundaries still apply.*

</details>

**Public intersection cameras → observed traffic → estimated emissions → evidence-backed planning.**

Built by **Mert and Carter** for the **NYCAIRR × HackBU 2026 Environment track**. The demonstration covers four Caltrans intersections in Torrance, California, with counting and completed-movement estimates enabled for cameras **222 and 223**.

Emission Lens tracks vehicles independently at each camera, counts line crossings and estimates tailpipe **CO₂ and NOₓ** from completed movements using documented CARB EMFAC factors. A single workspace brings together processed video, dated traffic evidence, camera-point emissions maps, hypothetical shorter-stop comparisons and downloadable investigation reports.

Outputs are **estimated emissions**. They do not measure air quality, pollutant concentrations or health effects.

## What you can inspect

- **Traffic evidence:** processed frames, line crossings, completed traversals and provisional visible-queue lower bounds, with freshness and coverage shown separately.
- **Traceable estimates:** supported-minute CO₂/NOₓ, calibration and fleet assumptions, factor provenance and unavailable values that remain unavailable.
- **Planning tools:** explicit same-cohort scenarios, durable evidence-review annotations and a two-page visual PDF bound to its reviewed source text and aggregate snapshot.
- **Separate context:** timestamped weather and regional CAMS model data, kept distinct from camera-derived emissions.

## Camera geometry and calibration

![Camera 222 annotated road region, excluded areas and entry/counting lines](./docs/media/carter-2026-11-08/camera-222.png)

*Static camera-222 reference supplied by Carter: green road region, red excluded areas, yellow count-1 and blue count-3 entry line. The grey count-2 line is unused. The image's baked-in LIVE label describes the source illustration; this README is not a live camera view.*

<details>
<summary>View the camera-to-ground calibration reference</summary>

![Camera 222 calibration correspondences, projected ground grid and aerial comparison](./docs/media/carter-2026-11-08/homography-222.png)

*Carter's reference shows fit/check correspondences, a projected 5 m grid and a configured 20 m separation between the movement lines. These are documented calibration inputs, not independent surveyed validation. See the [image provenance and limitations](./docs/media/carter-2026-11-08/README.md).*

</details>

## Verified checkpoint and limits

The [8 November 2026, 10:30 America/New_York / 15:30 UTC refinement acceptance](./frontend/REFINEMENT.md) records the installed map/report polish, readable units, labeled rich synthetic demonstration and actual PDF/browser checks. The [earlier 10:08 New York / 15:08 UTC acceptance](./frontend/HOME-STRETCH-ACCEPTANCE.md) retains the detailed pipeline and performance evidence. The tested application topology uses a consumer on **3152**, a preview gateway on **3151** and one authoritative writer on **3155**, sharing protected single-host persistence. These are local services, not a public hosted deployment; their availability depends on the running processes and bounded GPU allocation.

| Camera | Location | Counting and estimate scope |
|---|---|---|
| 222 | SR-107 at Carson Boulevard | Owner-enabled count-1; configured 20 m completed movement. [Human-reference count audit](./evaluation/calibration/222-count-audit.md). |
| 223 | SR-107 at Torrance Boulevard | Owner-enabled count-1 based on assisted review; configured 15 m completed movement. Human-reference accuracy remains unavailable. |
| 228 | SR-107 at 182nd Street | Excluded from counting/estimates after failed assisted count screens. Reserved fresh footage remains protected. |
| 220 | SR-1 at Crenshaw Boulevard | Excluded from counting/estimates after failed assisted count screens. |

The deployed baseline remains pretrained YOLO11n/640; the fine-tuned candidate was not promoted. Independent physical/traversal validation, broader human-reference evaluation, sustained outage recovery and shared hosting remain open. Processing FPS and delivered-video FPS are different measurements. The map is a camera-point visualization, not a dispersion model, and scenario changes are hypothetical rather than demonstrated savings.

## Run a local preview

Use **Node.js 24** (matching CI), npm and the checked-in lockfile. From the repository root:

```bash
npm ci
npm run dev -w @emission-lens/frontend -- --port 3000
```

Open [the labeled synthetic workspace](http://localhost:3000/?mode=synthetic&camera=222). Synthetic records are demonstration data and never enter live or replay totals. An unconfigured local preview does not start a GPU worker or supply live observations.

For the optional richer synthetic example, set `EMISSION_LENS_SYNTHETIC_DEMO=rich` in the web consumer environment before starting it. See [demo scope and isolation](./backend/SYNTHETIC-DEMO.md); its fictional movement assumptions never approve real cameras.

For real ingestion, use the private server settings described in [.env.example](./.env.example), [backend setup](./backend/INGESTION.md) and [worker setup](./worker/README.md). Keep tokens, approval registries, stores, outboxes, model weights and raw recordings outside Git. The current file-store architecture needs a persistent host; local setup does not provision hosted persistence.

Useful checks:

```bash
npm test
npm run typecheck
npm run test:emissions
```

A production frontend build uses `npm run build`; Python dependencies and worker checks are documented in the [worker package](./worker/README.md).

## Project guide

| Start here | Purpose |
|---|---|
| [Master plan](./Plan.md) · [coordination](./Coordination.md) · [repository rules](./Agents.md) | Scope, ownership and publication rules. |
| [Frontend](./frontend/README.md) · [backend](./backend/README.md) · [contracts](./contracts/README.md) | Workspace, ingestion, persistence and data meanings. |
| [Worker](./worker/README.md) · [emissions](./emissions/README.md) | Independent tracking, calibrated movements and reproducible RUNEX calculations. |
| [Evaluation index](./evaluation/README.md) · [latest application acceptance](./frontend/HOME-STRETCH-ACCEPTANCE.md) | Run receipts, validation boundaries and measured test scope. |
| [Release package](./release/README.md) · [identity assets](./branding/README.md) | Submission preparation, source availability and attribution. |
| [Worklog](./Worklog.md) · [previous README checkpoints](./docs/README-HISTORY.md) | Dated project history. |

## Scientific and privacy boundaries

`null` means unavailable; zero requires supporting evidence. Live, replay and synthetic modes remain separate, and retained frames do not establish current live processing. Video reports **stopped time**, not whether an engine is running. EMFAC running-exhaust factors already include ordinary driving-cycle idling, so no extra ordinary-idle process is added. Missing completed traversals never silently become zero emissions.

Vehicle identities are temporary and camera-session scoped. There is no plate recognition, facial identification or person tracking. Raw footage is excluded from the public repository. External briefs are drafts and exports; the application does not send messages or contact agencies automatically.

## Licence and sources

Covered project code is **AGPL-3.0-only**: see [LICENSE](./LICENSE), [NOTICE](./NOTICE), [source availability](./release/SOURCE-AVAILABILITY.md) and [third-party notices](./release/THIRD-PARTY-NOTICES.md). Camera imagery/metadata comes from Caltrans/CWWP; factors come from CARB EMFAC. The [release inventory](./release/README.md) records remaining model, media and dependency obligations separately.

**Documentation update: 8 November 2026, 10:32 America/New_York / 8 November 2026, 15:32 UTC: Mert:** Reorganized the project entry points, reconciled dated status summaries and added Carter's two annotated camera-222 references. Earlier README checkpoints are preserved in the linked archive. No contract, camera approval or runtime configuration changed.

**Presentation update: 9 November 2026, 19:47 America/New_York / 10 November 2026, 00:47 UTC, Mert:** Added verified stack badges and static Devpost gallery previews. Screenshot captions distinguish dated camera output, synthetic examples, and scoped estimated emissions. Existing scientific limits, camera eligibility, contracts, runtime settings, and attribution boundaries remain unchanged.
