# Frontend acceptance and demo usability

**Owner:** Mert  
**Updated:** 8 November 2026, 00:38 America/New_York / 8 November 2026, 05:38 UTC

## Focused checklist and ownership

This stream owns responsive/accessibility checks, replay/demo navigation and exact brief exports. The scope resolver/component/tests and primary dashboard remain separately owned. `CameraPreview.tsx`, `BriefActions.tsx` and `WorkspaceMenus.tsx` are agreed non-overlapping paths; only `BriefActions.tsx` changes in this checkpoint. No shared CSS, backend, worker, calculation, registry or contract change.

1. Overview and heat map: retain separate modes, supported-minute labels and unavailable whole-window estimates; require fresh processing evidence before a live claim.
2. Replay and cameras: keep recorded provenance visible, camera sessions separate, expired frames unavailable and true status visible.
3. Responsive and keyboard controls: check phone layout, camera-menu activation, link focus and Escape focus restoration without changing the cream/forest design.
4. Brief and export: compare the actual local download with rendered evidence text; ensure copy feedback refers to the current draft.
5. Demonstration handoff: distinguish browser acceptance from populated replay availability, scientific acceptance and production installation.

## Evidence reviewed and isolated checks

Existing evidence: [integration](INTEGRATION.md), [actual 222 consumer acceptance](222-CONSUMER-ACCEPTANCE.md), [heat map](HEATMAP.md) and [design checks](../design-qa.md). Earlier tests are historical evidence, not a new complete regression run.

Current checks use a new source/dependency copy from `0951a2132cf6504357ff092f4b752246af4ce8d7`, with the current tracked source copied over, plus only this checkpoint's brief-action patch. Private store and registry bytes were copied from one production generation before any test. The owned listener uses port 3142, no worker credential, and a separate temporary browser tab. Production 3138, GPU job 176075 and shared generated `.next` are untouched. Private artifact pointer: `/tmp/emission-lens-fe2-path.json`.

| Step | Current result | Evidence / limit |
|---|---|---|
| 1. Overview, live → replay | Pass for visible mode separation and unavailable states | Desktop 1280 × 720 overview; replay has no records within its current rolling hour. Original timestamps are unchanged. A populated replay rehearsal remains blocked on fresh replay delivery. |
| 2. Phone replay and camera menu | Pass for inspected controls | 354 × 790 screenshot; Enter opens the camera menu, Tab focuses camera 222, Escape closes it and restores focus to Camera network. Menu panel fits. Wide register columns remain in their independent table scroll area. |
| 3. Replay brief and local download | Pass for exact rendered body | Actual 1,356-character text download has 14 lines; its 13 body lines exactly match the visible rendered paragraphs, including null estimates, replay mode, offline state and reporting window. Download moved into the private acceptance directory. Phone brief document width is 354 px at a 354 px viewport. |
| 4. Copy then automatic refresh | Demonstrated defect fixed | Before: window/text change but “Draft copied” persists. After: “Draft updated. Copy again or download the current text.” appears as soon as refreshed text differs from the copied text. Copy success remains scoped to the exact text captured by that attempt, including an asynchronous result for an older draft. |

Accepted screenshots, in order, are retained privately as `01-overview.png`, `02-phone-replay.png`, `03-phone-camera-menu.png`, `04-phone-brief.png` and `05-updated-copy-feedback.png`. They were captured and visually inspected in this check; no footage or private records are committed. The temporary browser error during an owned server rebuild was recovered with a new owned tab; it was not a production failure.

## Verification and remaining work

- `TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import tsx --test frontend/test/*.test.ts`: all **44 tests pass** in the private source copy.
- `npx tsc -p frontend/tsconfig.json --incremental false` and `npm run build`: pass in that private copy. The first root-level test command omitted the frontend path configuration and failed alias resolution in three files; the documented corrected invocation passes all files. Initial dependency-copy symlink problems were repaired in the temporary copy before the passing build.
- Browser checks reproduce both old feedback persistence and the corrected updated-draft feedback after an actual scheduled server refresh. Copy success feedback passes; browser-adapter clipboard readback is not claimed.
- The brief/ranking says calibration is invalid when the approved 222 profile has no measurement minutes in the rolling window. Exact query, build/store identity and screenshot/download evidence were handed to the backend wording owner; this frontend patch does not change that text or any availability semantics.
- Full four-camera flows, newly delivered 223 replay/heat-map evidence, broad responsive/motion regression and final rehearsal remain open. No complete accessibility conformance, physical accuracy, measured air quality, positive scenario savings, shared hosting or production installation is established by these checks. No scope or contract change is proposed.
