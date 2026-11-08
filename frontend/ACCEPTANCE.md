# Frontend acceptance and demo usability

**Owner:** Mert  
**Updated:** 8 November 2026, 00:44 America/New_York / 8 November 2026, 05:44 UTC

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
- The initial brief/ranking incorrectly said calibration was invalid when the approved 222 profile had no measurement minutes in the rolling window. Exact evidence was handed to the backend owner; the separately published fix and independent consumer recheck are recorded below. This stream changed no backend availability semantics.
- Full four-camera flows, newly delivered 223 replay/heat-map evidence, broad responsive/motion regression and final rehearsal remain open. No complete accessibility conformance, physical accuracy, measured air quality, positive scenario savings, shared hosting or production installation is established by these checks. No scope or contract change is proposed.

## Licence/source checkpoint — 8 November 2026, 00:40 America/New_York / 8 November 2026, 05:40 UTC

Mert agreed a narrow additional assignment for `AppShell.tsx` footer/help link markup. The footer now exposes the published AGPL-3.0 licence and clearly labeled source repository; help supplies the project-code/no-warranty/upstream-terms note and project/source guidance. The optional exact-web-source setting and its trust boundary are documented in [SOURCE.md](SOURCE.md). No running revision is inferred or configured in the acceptance build. All 47 frontend tests, TypeScript and the isolated build pass; desktop footer/focus and the 354 px phone help panel were visually checked, including Escape dismissal. Accepted private screenshots are `06-source-footer.png` and `07-phone-source-help.png`. The application owner retains the exact frozen-version launch/source obligation; production remains unchanged.

## Independent wording and mode recheck — 8 November 2026, 00:44 America/New_York / 8 November 2026, 05:44 UTC

Mert copied exactly `backend/src/queries.ts`, `backend/src/brief.ts` and the focused availability test from backend checkpoint `03ad2daa327e5f266f2ac0006d2716b25a656d5c` into the private source copy, retaining the published frontend `acee09c` changes. The rebuilt application passes all **57 combined checks**: 47 frontend tests plus 10 focused backend availability tests. Its production build passes.

| Step | Independent consumer result |
|---|---|
| 5. Approved 222 / empty replay window | Brief, ranking and camera emissions text identify no estimated-emissions records while retaining mode/time approval. The old false invalid-calibration sentence is absent. The ranking asks for current-window traversals/mapping; numerical estimates remain unavailable. |
| 6. Corrected brief export | Actual 1,422-character download exactly matches all rendered body lines, with replay/offline provenance, null pollutant estimates and no automatic sending. Private screenshot `08-corrected-empty-window-brief.png` and `replay-brief-corrected.txt` preserve the evidence. |
| 7. Camera mode/status navigation | Brief → camera retains replay and 20% scenario. Replay is offline with no synchronized frame; switching to the frozen live copy reports no fresh heartbeat/degraded, rather than live from an old frame. Synthetic remains labeled with no camera footage; evidence-review navigation preserves synthetic mode. |
| 8. Supported heat snapshot / mode transitions | The map reports a ready heat layer with one supported 222 point: 7.9 g estimated CO₂ and 0.001485 g estimated NOₓ from the same 9:33 PM PST minute, visibly Degraded with a nine-minute-old heartbeat. Reporting-window totals remain unavailable. Traffic uses reporting-window labeling; live → replay → synthetic → live has point counts 1 → 0 → 0 → 1. Private screenshot `09-stale-supported-heat-map.png` was inspected. |

Public measurement reads preserve approved live/replay profiles and unavailable full-window/scenario values; synthetic is unapproved and supplies no measurement minutes. Private store SHA-256 remains `6f592b0d6858751039ac3edd3ddb469eabf430878ef760ac7fa1dd4640420db1`; registry remains `e244d2633ff6c59ff7446c991486fffcf01a2638cdfccd46fc4b27953bf273f9`. No source timestamp or private bytes changed. A private `acceptance-result.json` indexes copied source hashes, tests, download and mode/status results.

The owned 3142 listener is stopped, the acceptance tab is closed and viewport override reset. The original temporary tab reached a connection-error page during the first owned rebuild; browser policy prevented closing that tab through the available API. No native GUI or another owner's tab was used. Production 3138 retains its original listener PID 3943; no production source link, backend update or registry change was installed. Fresh 223 replay delivery, full four-camera responsive/motion/accessibility acceptance and final rehearsal remain open. No further UI defect was demonstrated in the agreed preview/menu paths, so they are unchanged.
