# Frontend

**Owner:** Mert  
**Updated:** 7 November 2026, 19:45 America/New_York / 8 November 2026, 00:45 UTC

The four-camera Torrance dashboard reads the shared backend contract. The server reads live/replay worker records from the configured local store. Without a worker, those modes remain empty. The synthetic sample is explicitly labeled and excluded from live totals.

## Environmental workspace

**Design note (7 November 2026, 17:26 America/New_York / 22:26 UTC):** Mert applied the latest supplied palette across the entire interface: warm tan `#FAF3EA` and green `#058247`, sampled after converting the reference image to sRGB. Cream and sage surfaces, bold typography, a light street map, and editorial environmental imagery retain the selected logistics/travel composition. This supersedes the charcoal theme. No scientific calculation or shared-contract change was made.

**Polish note (7 November 2026, 18:58 America/New_York / 23:58 UTC):** Mert retained the tan/green palette, bold typography, navigation, and overall composition. A joined metric readout, road-grouped station index, compact camera identifiers, coordinates, sharper panel geometry, and more specific headings make the existing workspace more distinctive. Station order is geographic within each road; it does not imply tracking between cameras. A green selection outline is independent of the marker's amber/neutral health face. Fit controls preserve room around every marker.

- **Overview:** selected-camera metrics, four-camera map, searchable/filterable/sortable intersection table, selected evidence, actual vehicle-class bars, and a plain-language explanation of the estimation steps.
- **Camera detail:** four-camera switcher, section links, observations and diagnostics, class totals across recorded minutes, actual minute history, factor provenance, calibration readiness, and shorter-stop scenarios.
- **Evidence review:** an explicit disconnected review feed and a useful explanation of corrections. An empty queue does not imply approved evidence.
- **Planning brief:** a readable draft, camera and scenario controls, evidence references, clipboard action, and a real text attachment. Export returns the exact draft text, normalizes native-form line endings, and neither stores nor sends it.
- **Menus:** camera network, help, data status, and reporting-window explanation. Menus dismiss with Escape or an outside click; only one opens at a time. Native disclosures remain keyboard accessible.
- **Metric colors:** blue crossings, amber queues, green estimated emissions, violet recorded coverage, and teal completed traversals. Labels identify every category; color does not imply severity or a valid estimate. Unavailable values remain neutral.
- **Motion:** exact values render immediately. Genuine visible numeric updates receive 160 ms presentation feedback, evidence selection 180 ms, and menus 140 ms; map orientation uses a nonblocking 320 ms transition. Page-load stagger/count-up sequences and looping decoration are removed. Numeric feedback stops offscreen, in a hidden document, or when motion is disabled. The system reduced-motion preference overrides saved local preferences. Native menu Escape handling restores focus only when focus was inside that menu.

## Data meanings

Unavailable is never substituted with zero. Camera health uses an advancing-frame processing heartbeat evaluated against the active data clock; source capture UTC is reported separately when available. Synthetic camera 223 is stale, not live. Mode labels and separate wall/data clocks remain visible on every route.

The sample for camera 222 contains **one recorded minute**, with 24 crossings, 16 completed traversals, and a queue count of 5. The overview says **1 / 60 recorded minutes**, not full-hour coverage. Detail coverage is explicitly recorded-minute coverage. Other cameras are not silently treated as zero. Stopped time does not establish whether an engine is running.

Estimated tailpipe CO₂ and NOₓ require calibrated completed traversals and documented mappings. Scenario ranges are not statistical confidence intervals. Weather, schools, road regions, and gates are not invented or drawn when unavailable.

## Assets and typography

Manrope and italic Lora are self-hosted in `src/app/fonts/`, with their open font licenses. Interface text uses weight 700 throughout; major headings and metric figures use 800. Tabular monospace readouts distinguish timestamps and numeric data. Icons come from Phosphor. Map geography is OpenFreeMap/OpenStreetMap; camera locations are actual configured coordinates. If map tiles fail, the table remains usable.

Environmental image: `public/images/greener-city.png`, 1536 × 1024. It is generated illustrative imagery, clearly labeled as such, and is not a Torrance site observation or camera frame.

Image prompt: “Premium editorial photograph of a sunlit coastal California urban park, lush trees framing a curved pale path, distant understated buildings, warm natural light, deep leafy greens and muted cream; no people, identifiable vehicles, text, logos, or CCTV appearance.” Generated with the built-in image-generation tool; no external image API credentials were used.

## Verification

Production build and all 51 backend tests pass with `npm run build` and `npm test`. Attachment checks cover a valid export and invalid filename; the actual browser-downloaded synthetic brief matches the displayed draft content.

Browser checks covered all four camera selections, search/no-results/reset, each status filter and sort option, traffic/emissions layers, live/replay/synthetic on overview/detail/review/brief, menus and disclosures, scenario 0/40/100 and invalid 101, blank-number validation, keyboard slider synchronization, all four brief camera options, copying, actual download, mobile layouts, and reduced motion. The latest palette pass rechecked overview, camera detail, review, and brief at desktop/phone widths, light menus, live null states, exact synthetic values, motion on/off, and reduced motion. The camera-network menu marks its active route without opening over the heading. Wide evidence tables remain in their own scroll areas and phone pages do not pan horizontally. Desktop and phone captures and comparison details are recorded in `../design-qa.md`.

**Latest polish checks (7 November 2026, 18:58 America/New_York / 23:58 UTC):** All workspace menus and camera-menu destinations, outside/Escape/exclusive dismissal, all mode switches on each route, station links, filter/search/reset/sort, map layers/zoom/fit, detail disclosures/anchors, scenario boundaries and blank validation, four brief options, copy feedback, and a real text download passed browser checks. Wide/compact desktop and a 354 CSS-pixel phone viewport were inspected. Phone menus fit and horizontal gestures leave the page at `scrollX = 0`; evidence tables retain their own scroll areas. Exact sample values and reduced-motion behavior pass with no new browser warnings/errors. Before/after evidence is in `../design-qa.md`.

## Still open

Reviewed road regions/gates, physical calibration, validated traffic metrics, contextual integrations, and hosted shared persistence/deployment remain open. Single-host worker status and temporary synchronized previews are demonstrated. The UI does not claim a measured environmental improvement, model accuracy, or live deployment.

**Dependency note (7 November 2026, 18:12 America/New_York / 23:12 UTC):** Mert upgraded MapLibre GL JS to 6.17.0 to resolve [GHSA-jrc7-96c5-q579](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579). The current map uses third-party style and attribution data, so the patched sanitizer is relevant. The dashboard behavior is preserved.

**Integration note (7 November 2026, 18:18 America/New_York / 23:18 UTC):** Mert connected server pages to validated local worker persistence and added ten-second refreshes for visible live/replay pages. Refresh pauses while a form has focus. Capture timestamps and capture-to-dashboard latency remain unavailable for feeds without machine-readable capture UTC. Local server settings belong in ignored `frontend/.env.local`. Synchronized preview and live GPU delivery are the next verification steps.

**GPU delivery verification (7 November 2026, 18:30 America/New_York / 23:30 UTC):** Mert verified actual four-camera CUDA processing reaching the local dashboard. Camera detail polls temporary annotated frames; boxes and pixels come from the same worker frame. The server keeps only the latest frame per camera/mode in process memory, expires it within 60 seconds, and never writes previews to the aggregate store. Desktop and 390 px phone checks decoded a real camera-222 preview with no page errors or horizontal overflow. Capture UTC stays unavailable and delayed frames are labeled. The completed worker run correctly changed all camera states to offline. The file store requires one persistent host; Vercel/shared database delivery is not established.

**Timing documentation (7 November 2026, 18:55 America/New_York / 23:55 UTC):** Mert synchronized these data meanings with the implemented worker clock. New traffic rows use session-local estimated HLS media UTC, identified by `t:hls-min-anchor-v1` in run provenance. Camera evidence notes disclose estimated timing and warn when a reporting window mixes it with legacy or unspecified times. Heartbeats and preview receipt banners keep their original meaning; capture UTC remains unavailable. The labeled synthetic clock is unchanged. See [timing alignment](../evaluation/timing-alignment.md). The completed timing revision passed 51 backend tests, type checks, the production build and [CI](https://github.com/mertkanibir/emission-lens/actions/runs/42427132206); earlier UI-only test counts above are historical snapshots.

## Measurement-readiness acceptance checkpoint

**7 November 2026, 19:45 America/New_York / 8 November 2026, 00:45 UTC — Mert.** Camera evidence now lists image geometry/review, physical calibration, completed traversal aggregates, production mapping availability, the factor catalog, and recorded pollutant estimates together. The display uses existing typed records and has no overall readiness score. Geometry presence is not review approval; calibration flags are not independent validation; synthetic traversal counts are labeled; validated factors are not a claim that a camera estimate applied them. The overview caption uses the actual estimate, and the live-mode banner distinguishes selected mode from a fresh processing heartbeat. Scenario timing arithmetic explicitly does not imply an emissions change when grams are unavailable.

Verification: `node --import tsx --test frontend/test/readiness.test.ts` passes five semantic guards; `npm run build` passes. Isolated production browser checks on port 3100 cover desktop/phone menus, map selection/zoom/fit/layers, live/replay/synthetic states, evidence disclosures, review/brief navigation, and a real text export exactly matching `draft_brief`. Scenario checks at 0/20/100 retain null grams. Copy feedback passed; the browser clipboard adapter returned empty text, so clipboard readback was not independently verified. Viewport/reduced-motion overrides were restored, the temporary tab/server were removed, and the user's port-3000 process was preserved.

Dependencies: shared read models do not expose geometry review confirmation, per-camera mapping version/evidence, or individual calibrated-traversal evidence. Public scenario grams remain unavailable. Engineering owns offline precedence and any traversal/scenario interface; the latest tested shared-tree build includes its pending offline fix. The coordinator owns final combined acceptance. See `../design-qa.md` for the demo path and exact limits.
