# Implementation coordination

**Owner:** Mert

**Updated:** 7 November 2026, 19:38 America/New_York / 8 November 2026, 00:38 UTC

Mert authorized centralized project coordination on 7 November 2026. `Plan.md` remains the master plan. This record allocates the next implementation checkpoints; it does not certify unfinished measurements or alter contract 1.1.

## Next acceptance milestone

One selected camera must demonstrate reviewed line crossings, independently supported physical calibration, completed entry-to-exit traversals, explicit visual-to-CARB assumptions, persisted estimated CO₂/NOₓ, and a baseline/scenario comparison with traceable evidence. Missing scientific inputs must remain unavailable. Extend the verified path to the other cameras only after this checkpoint.

## Current work allocation

| Work stream | Direction | Owned implementation paths | First checkpoint |
|---|---|---|---|
| Engineering integration | Mert | `backend/`, `contracts/`, `emissions/`, `infra/`; `worker/main.py`, `worker/aggregate.py`, `worker/publish.py`, `worker/timing.py`; their focused tests; `evaluation/integration-readiness.md` | Fix stale-offline display semantics, establish an agreed measurement handoff, and implement/test the remaining traffic-to-emissions and scenario integration without inventing calibration or class weights. |
| Scientific evidence and calibration | Mert coordinates, Carter retains labeling/training ownership | `config/cameras/`; `worker/metrics.py`, `worker/draw_geometry.py`, new calibration modules; matching focused tests; `evaluation/measurement-readiness.md` and new calibration evidence | Inventory actual geometry and reference evidence, preserve Carter's work, and provide a concrete reviewable per-camera measurement/calibration proposal with supported inputs and explicit blockers. No geometry is enabled merely by saving a drawing. |
| Dashboard acceptance | Mert | `frontend/`, `design-qa.md`; no backend or worker edits | Preserve the tan/green design; make readiness, stopped/live/degraded state, missing measurements, scenario assumptions, brief export and mode separation clear, then verify desktop/phone interactions. |
| Project direction and integration review | Mert | `Plan.md`, `Agents.md`, root `README.md`, this file; cross-stream decisions and final acceptance | Resolve handoff conflicts, prioritize blockers, inspect evidence and test results, and maintain the final demo/submission checklist. |

Each stream owns its package documentation and must add its own narrow timestamped `Worklog.md` entry under the repository rules. Shared root documentation is maintained by Mert's coordination stream. Existing scientific factor source bytes and evaluation records must be preserved.

## Dependencies and boundaries

1. The scientific stream publishes its measurement-readiness proposal before incompatible engineering interfaces are implemented. Existing contract 1.1 fields are preferred. Changing a producer/consumer contract requires an explicit proposal and coordination decision first.
2. The engineering stream implements and verifies supported data paths even when a physical camera input is unavailable. Synthetic arithmetic remains labeled and never enters live totals. It must distinguish ready code from field-validated outputs.
3. The dashboard stream reads the existing backend types and coordinates any new field requirements before changing their meaning. It does not activate measurement configurations or create emissions values for display.
4. Carter's dataset, labels, detector/tracker configuration and training results remain untouched. No new training, model promotion or rare-class accuracy claim is needed for this milestone. Any scientific mapping is documented as an assumption/proposal until evidence supports its use.
5. All work uses the existing shared checkout. Never discard, stash, reset or commit another stream's edits. Commit only explicitly owned paths and the stream's own worklog entry. Reread shared files before narrow edits; do not reformat the whole worklog. Coordinate before competing Git-index operations or production builds.
6. Preserve local servers and private runtime configuration. Reliability checks must use their own bounded ports/outboxes, protect active jobs and release allocations. No secret, footage, model weight or private download capability enters Git or coordination messages.

## Following checkpoints

- Test longer operation and forced outages; verify reconnect/overlap handling and the actual runtime model/settings on held-out traffic footage.
- Decide and implement a deployable persistence/preview topology. The current file store and in-memory previews support one persistent application host, not independent serverless instances.
- Implement defensible scenario sensitivity ranges and evidence-backed brief content. Current scenario grams and comprehensive uncertainty remain unfinished.
- Add weather and nearby schools only after the core measurement path; keep community layers and further model tuning optional.
- Rehearse the complete live and labeled-replay demonstration, verify source/licence attribution and submission status, and ensure Mert and Carter can explain the system before 8 November 2026, 11:00 America/New_York.

## Reporting checkpoint

Every stream reports in its own conversation: completed paths and commit, commands/results, demonstrated behavior, remaining evidence gaps, and the next dependency. Mert reads those reports and progress snapshots centrally. No automatic external communication, fabricated measurements or promise of unattended monitoring is implied.

**Dispatch checkpoint (7 November 2026, 19:31 America/New_York / 8 November 2026, 00:31 UTC):** Mert sent the scoped engineering, scientific-evidence and dashboard assignments to the three existing work streams. All three acknowledged ownership and began work. Their checkpoints are in progress; no implementation result or scientific approval is implied by dispatch.

## Finish-line decisions — 7 November 2026, 19:38 America/New_York / 8 November 2026, 00:38 UTC

Mert directed the fastest complete, evidence-backed demonstration while continuing independent useful work in parallel. The existing persistent single-host architecture is the first operational target. Shared multi-instance/serverless hosting, additional context layers, further training and cosmetic redesign do not block that local acceptance checkpoint; they remain later work rather than silently certified features.

1. **Software checkpoint:** finish and publish the independent backend/scenario, calibration-arithmetic and dashboard-readiness work, then run combined checks on a stable revision. Synthetic inputs are explicitly labeled; passing arithmetic does not prove camera calibration.
2. **Scientific checkpoint:** obtain a camera-222 source clip and reviewed selected-gate events, independently scaled road references with held-out validation, documented class mappings and accepted calibrated completed traversals. If any input is absent, state the precise dependency and keep affected quantities unavailable. This remains required for the live-emissions milestone; its finish time is not inferred from code readiness.
3. **Operational checkpoint:** run the actual runtime settings through the demonstrated single-host delivery/replay path, perform bounded forced-outage and restart checks, verify evidence retention and mode separation, and rehearse the three-minute demonstration plus submission checklist. Expand accepted measurements to the other cameras after the first validated camera.

### Traversal/scenario handoff decision

Mert accepts the internal per-completed-traversal scenario input described in `evaluation/measurement-readiness.md` and the engineering `ScenarioTraversal` proposal: each completed traversal has its own `stopped_time_s`, or null when unavailable. It is distinct from `traffic_minute.stopped_vehicle_seconds`, which retains its general observation-minute meaning. Never subtract road-wide minute stopped seconds from a completed-traversal cohort's duration.

Keep original completion timestamps/cohort fixed for baseline/scenario comparison, compute speed and RUNEX factors per traversal before summing, retain signed changes, and withhold a positive-reduction scenario if linked stopped evidence is missing. Real outputs still require accepted calibration, class mapping and explicit meteorology. Hypothetical rows never enter observed live totals. Internal calculation inputs/evidence may be implemented and tested now. This approval does not change contract 1.1, authorize new public batch fields, or approve camera geometry/class mixtures; any persistence/transport extension needs a concrete schema and validation proposal first.

Engineering owns the integration/consumer side; the scientific stream owns the documented producer evidence and calibration primitives. The current scene-wide stopped total is not a substitute for traversal-linked evidence. These decisions remove the internal calculation handoff blocker while preserving the scientific acceptance gate.
