# Responsible estimation and model selection

**Owner:** Mert and Carter
**Updated:** 8 November 2026, 03:29 America/New_York / 8 November 2026, 08:29 UTC

Emission Lens is an evidence-backed planning prototype. Public cameras observe traffic; regional factors and explicit physical/fleet assumptions produce estimated tailpipe CO₂ and NOₓ. Neither a polished map nor an approved software pipeline establishes measured air quality, field accuracy or an environmental benefit.

## Decisions demonstrated by the project

| Decision | Evidence | Product consequence |
|---|---|---|
| Retain the pretrained detector | [Held-out detector comparison](../evaluation/empire-ai-175644-comparison.md): the fine-tuned candidate underperformed. The deployed reviewed baseline is YOLO11n/640 at 15 requested sampling FPS; the image-level comparison used different settings. | No fine-tune promotion or transfer of an image-level score to crossing accuracy. |
| Include 222 at its accepted gate | [Human count audit](../evaluation/calibration/222-count-audit.md) retains the original key, direction differences and endpoint sensitivity. | Count-1 acceptance is narrow, not a four-camera accuracy claim. |
| Disclose 223's reference type | [Count acceptance](../evaluation/calibration/223-count-acceptance.json) uses assisted review, not human ground truth. | The UI can show an operationally accepted profile while exposing the reference limitation. |
| Exclude 220 | [Held-out review](../evaluation/video_validation/220-review-status.md): 74 matched, 1 false positive and 32 missed passages, 69.81% agreement recall. | No new quantitative producer or invented zero. |
| Exclude 228 | [Relocated-gate practice review](../evaluation/video_validation/228-relocated-practice.md): 80 model passages versus 137–138 assisted passages. | No promotion; the reserved fresh interval remains unviewed. This practice failure is not mislabeled a new held-out result. |
| Withhold unsupported results | [Contract](../contracts/README.md): null is unavailable; zero requires support. | A supported minute cannot repair missing hour totals. Unknown queues do not inherit older positives. |
| Keep physical and image observations distinct | [Final acceptance](../backend/LIVE-3151-176075-4.md): linked completed cohorts, provisional ≥N visible queues and independent crossing observations. | Image queues are visible lower bounds; no engine-running inference or full physical queue length. |
| Preserve signed hypothetical outcomes | [Scenario method](../emissions/SCENARIOS.md) and [actual replay](../backend/STOPPED-REPLAY-222-223-176075-2.md). | Zero bin changes and increases remain visible; no positive saving is manufactured. |

## Data roles

- **Caltrans video:** source observations, independent camera sessions and an estimated media clock. Capture UTC and capture-to-dashboard latency remain unavailable.
- **Aerial reference geometry:** documented fixed movement lengths and calibration residuals. Owner-approved assumptions remain distinct from independent surveyed validation.
- **CARB EMFAC2025 RUNEX:** retained factors with source bytes, units, region/year and hashes. Ordinary driving-cycle stops are already included; no extra ordinary-idle term is added.
- **Fleet and meteorology:** explicit mapping/weather assumptions retained with calculations. Appearance cannot establish regulatory class, age, fuel or engine state.
- **External weather context:** the new context interface adds timestamped model weather for interpretation. It does not silently replace the stored factor temperature/humidity, model dispersion or validate pollution. See [context interface](../backend/CONTEXT-REVIEW.md).
- **Review annotations:** local operator notes and state history preserve original evidence. A resolved flag neither grants calibration approval nor rewrites a measured or estimated quantity.

## Boundaries to explain during judging

No plate recognition, facial identification, person tracking or cross-camera identities. No raw footage, credentials or private traversal identities enter public source. Modes remain separate. Briefs are reviewable local exports; they do not contact agencies or send messages.

Independent physical/path/traversal/stopped-time validation, broader human review, sustained operation and public hosting remain open. Review interfaces and additional contextual data improve traceability; they do not erase those limits. Final candidate verification must identify the actual source build, current mode/window and dated evidence.
