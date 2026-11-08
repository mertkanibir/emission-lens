# Camera 223 — actual replay frontend acceptance

**Owner:** Mert
**Updated:** 8 November 2026, 00:53 America/New_York / 8 November 2026, 05:53 UTC
**Result:** Bounded actual-record preview, heat-map, mode, unavailable-value, brief/export and shutdown checks pass on the unchanged isolated application. This is frontend delivery acceptance, not count, physical-calibration or traversal accuracy.

## Frozen target and coverage boundary

The target is the independently owned application on **127.0.0.1:3139**, PID **14481**, frozen web source **`b1081f19883e1950ab3c6cf28af22be41e7ec30e`**, including profile UI `87b7dd6`. The expected two-camera registry remains `222-223-2026-11-08T04:03:40Z`; the checked ready-file SHA-256 is `57ab8a89c9ac4ba57975d5365e13a73df4f8d83f492ee7bb86f4a040d299ac24`. Mert retained the actual final-safe-readiness receipt before checking delivery. See [the integration handoff](../backend/223-HANDOFF.md).

The actual worker is **job 176174**, using the original TS input through the separately verified `[60,180)` file adapter and a **100-second configured wall interval**. The earlier derivative was rejected. This frontend check does not claim all 120 source seconds or a full recording were processed. The execution owner records actual source extent, selected-frame coverage, drops and final scheduler/delivery status; the integration owner verifies private arithmetic and retained 222 invariance. Counts shown here are processed line-crossing records, not a human reference or field accuracy score.

Browser/API checks ran from **00:45:37–00:52 America/New_York / 05:45:37–05:52 UTC**, with transient preview captures during the worker. Stored reporting minutes use estimated media UTC; the UI separately displays Torrance/Pacific time and UTC. Source capture UTC is unavailable. No source clock or missing-data rule was changed.

## Actual same-application checks

| Step | Result | Observed evidence |
|---|---|---|
| 1. Before delivery | Pass | Both 223 live/replay profiles are approved but have no measurement minutes or supported numerical values. Replay preview is 404 and the page says no synchronized frame. No approval-derived observations are invented. |
| 2. Advancing actual preview | Pass | API sequence **1 → 373**, changing image bytes and processing timestamps **05:48:35 → 05:48:53.846848 UTC**. Two inspected browser captures at approximately **05:48:41 / 05:48:57 UTC** show different actual traffic frames/overlays, camera 223 and explicit **REPLAY** burn-in. Browser frame received times advance from **05:48:25.507796 → 05:48:56.886513 UTC**. Capture UTC remains unavailable. |
| 3. Actual supported heat minute | Pass | A ready heat layer has one camera-223 replay point at **05:49 UTC / 7 November, 21:49 PST**: **71.49666919969158 g estimated CO₂**, **0.014042455333372915 g estimated NOₓ**, rendered **71.5 g / 0.014042 g** from the same minute. The worker is visibly **Offline** after shutdown. Colors remain a camera-point estimate, not exposure or pollution dispersion. |
| 4. Missing minute and scope | Pass | The **05:48 UTC** minute retains four crossings, no completed cohort and insufficient-evidence/null grams. The **05:49** minute retains 89 crossings and 26 completed measurement candidates. The page shows 93 crossings across these two observed minutes; a full-hour coverage value is unavailable. Whole-window estimated CO₂/NOₓ stay null. The general mixed-class completed headline stays unavailable; the separate completed-cohort disclosure reports 26. |
| 5. Assumptions and scenarios | Pass | The **15 m southbound segment** and completed southbound movement scope are explicit. Fixed distance/fleet-mixture assumptions, potentially longer curved paths and **70 °F / 60% RH** model inputs are visible. Traversal-linked stopped time remains unavailable; the 20% positive-reduction scenario and signed gram/percent changes stay null. No savings, extra idle process or measured-air-quality claim is added. |
| 6. Actual brief and export | Pass | Camera/scenario → brief preserves camera 223, replay and 20%. The actual **2,474-character text download** matches every rendered body line exactly: 93 crossings, offline/replay provenance, current UTC reporting window, both calculation references, retained assumptions and unavailable CO₂/NOₓ. No supported-minute partial sum becomes a whole-window brief total. Nothing is sent. |
| 7. Mode/view separation | Pass | Traffic returns the NOₓ **reporting-window** label and unavailable value. Emissions view restores the supported snapshot. Live has **no supported 223 snapshot**; its one existing heat point belongs to retained **222 live** data, not 223 replay. Synthetic has no heat points. Returning to Replay restores only the actual 223 replay point. |
| 8. Ended worker and preview expiry | Pass | After explicit offline delivery, the retained preview is labeled delayed; by **05:51:07 UTC**, more than 60 seconds after the last frame, the browser has **zero preview images** and shows Frame unavailable. The heartbeat remains timestamped **05:50:04 UTC** and the camera stays Offline. No old frame creates a live claim. |

These are dated same-app observations. Later retention/window expiry can change what the rolling-hour view contains; timestamps were not rewritten to prolong the demonstration.

## Evidence, cleanup and limitations

The private index is `/tmp/emission-lens-fe2-223-path.json`. Its directory retains a scalar `acceptance-result.json`, initial/during/post-run public reads, exact downloaded draft, export comparison, checked source/readiness receipt, and inspected screenshots:

- `01-before-delivery.png`
- `02-actual-replay-preview.png` and `03-advancing-replay-preview.png`
- `04-replay-no-supported-heat-yet.png` and `05-supported-replay-heat-map.png`
- `06-supported-and-unavailable-minute-evidence.png` and `09-ready-minute-precision.png`
- `07-exact-replay-brief-export.png` and `08-post-run-expired-preview.png`

Raw frame responses/screenshots and operational paths remain private; no footage, credential, per-traversal identity or private registry is committed. The browser tab is closed; no viewport override or native GUI was used. No browser warnings/errors were captured in the final check. The same-app screenshots/results were handed to Mert's operational coordinator, integration and provenance streams while the relevant evidence was available.

**No code, build, registry, store, worker, service or scientific input was changed by this acceptance stream.** Production 3138 and live 176075 were preserved. This frozen build intentionally lacks the later brief-copy/source-link checkpoints and backend empty-window wording fix; its pre-record empty state still has the already-known generic invalid-calibration sentence. No rebuild was performed to backport those separate changes during this bounded integration.

Open acceptance remains independent physical/path/traversal and count validation, actual execution coverage/drops/reliability, full-recording review, future live 223/production cutover, shared hosting and final rehearsal. The approved fleet/weather/path model and assisted count reference do not establish those properties. No frontend defect requiring a runtime change was demonstrated in this actual-record check.
