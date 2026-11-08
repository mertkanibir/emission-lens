# PDF, analytics and preview acceptance

**Owner:** Mert
**Updated:** 8 November 2026, 09:05 America/New_York / 8 November 2026, 14:05 UTC
**Running web source:** 8322597f920625b832cc4c470690389c19171201
**Application:** http://127.0.0.1:3152/

## Delivered

- Download PDF brief posts the exact displayed draft to a Node-only PDF renderer. The cream/green report has section hierarchy, highlighted estimates, repeated brand headers, page numbers, source SHA-256 and the full reviewed UTF-8 text attached. No live re-query changes the export after review. Text download/copy remain available.
- Evidence analytics follows the selected camera/mode/UTC interval: missing-aware minute bars, class crossings, supported/recorded/requested anchor counts, same-supported-cohort weighted CO2 intensity, observed peak and inspectable rows. Clicking a minute preserves the scenario reduction and scopes its comparison. Unaccepted220/228 stay excluded; no missing value is imputed zero.
- Independent CAMS global atmospheric composition context adds PM2.5/NO2/ozone model values from Open-Meteo, source/valid/retrieval time and returned grid. Native global scale is about45km/3hours; API hourly values are regional context, separate from camera tailpipe mass and retained EMFAC inputs. Synthetic mode gets no real model values; stale/missing context stays explicit.
- Visible preview checks run every750ms with one in-flight request, timeout, duplicate/order guards, mode/camera checks and the original60-second expiry. Worker rate, observed snapshot spacing and received-frame age are separate. Full-page data refresh is30seconds with pending-transition gating.

## Verification

Final immutable production build, frontend TypeScript and all86 frontend checks pass. Tests include exact PDF attachment/source/hash and pagination, malformed/oversized exports, selected interval/null/zero/duplicate analytics and regional source unit/time/mode boundaries.

The real browser Download PDF brief action saved a three-page camera223/live13:25-13:26UTC report. Its embedded UTF-8 attachment is byte-identical to the visible reviewed draft (SHA-256855904a9fdc14f21b6a1e211240d55aa6a528b75f95469cf172b4a19bcfafefd). Actual downloaded pages were rendered and inspected; values, provenance, headers and footer/page numbers are retained. A separate HTTP export also passed. The first hidden-input inspection was unavailable; source comparison used the visible draft text.

Actual desktop and phone analytics/export reflow pass (phone382px viewport/document369px); a minute link changed the comparison to13:25-13:26UTC and its supported1-vehicle cohort. Live installed source, independent model values and fresh synchronized processed snapshots were verified on3152. No document overflow was found in the inspected views. This is scoped interaction/reflow acceptance, not full accessibility certification.

A 57.612629-second operational sample processed 687 frames for camera 222 (11.9245 FPS) and 912 frames for camera 223 (15.8299 FPS), with zero new reader drops; prior lifetime drops 532/409 remain. One pre-change parallel endpoint sample saw producer~10ms and consumer~6.64s. One post-install pair returned the identical preview sequence at25.4ms/28.3ms. These bounded samples identify consumer contention and successful delivery; they do not establish sustained latency, loss-free operation or an inference speedup. Caltrans HLS arrives in bursts and the unchanged producer targets3-second preview publication.

## Preserved boundaries

3152 uses the same authoritative store, registry, private reviews/context and3151 producer. Active GPU job176773, pretrained model, source sampling, camera policies, calibrations, factors and core1.1/measurement1.0 are unchanged. Prior failed-run pending envelopes remain preserved. Carter's concurrent submission-attribution update was merged without discarding it. Long operation, independent scientific validation and hosted persistence remain open.

Private receipts/screenshots live under ignored runs/pdf-analytics-acceptance and runs/frame-performance-20261108. The example generated PDF is local under ignored output/pdf. No footage or credentials are committed. At the final check99% account allowance was consumed; no reset was used.
