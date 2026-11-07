# Frontend

**Owner:** Mert  
**Updated:** 7 November 2026, 17:26 America/New_York (22:26 UTC)

The four-camera Torrance dashboard reads the shared backend contract. The server reads live/replay worker records from the configured local store. Without a worker, those modes remain empty. The synthetic sample is explicitly labeled and excluded from live totals.

## Environmental workspace

**Design note (7 November 2026, 17:26 America/New_York / 22:26 UTC):** Mert applied the latest supplied palette across the entire interface: warm tan `#FAF3EA` and green `#058247`, sampled after converting the reference image to sRGB. Cream and sage surfaces, bold typography, a light street map, and editorial environmental imagery retain the selected logistics/travel composition. This supersedes the charcoal theme. No scientific calculation or shared-contract change was made.

- **Overview:** selected-camera metrics, four-camera map, searchable/filterable/sortable intersection table, selected evidence, actual vehicle-class bars, and a plain-language explanation of the estimation steps.
- **Camera detail:** four-camera switcher, section links, observations and diagnostics, class totals across recorded minutes, actual minute history, factor provenance, calibration readiness, and shorter-stop scenarios.
- **Evidence review:** an explicit disconnected review feed and a useful explanation of corrections. An empty queue does not imply approved evidence.
- **Planning brief:** a readable draft, camera and scenario controls, evidence references, clipboard action, and a real text attachment. Export returns the exact draft text, normalizes native-form line endings, and neither stores nor sends it.
- **Menus:** camera network, help, data status, and reporting-window explanation. Menus dismiss with Escape or an outside click; only one opens at a time. Native disclosures remain keyboard accessible.
- **Metric colors:** blue crossings, amber queues, green estimated emissions, violet recorded coverage, and teal completed traversals. Labels identify every category; color does not imply severity or a valid estimate. Unavailable values remain neutral.
- **Motion:** staggered card entrances, selection-panel transitions, vehicle-bar reveals, menu openings, hover feedback, and 650 ms numeric/camera easing. Numeric transitions are bounded by the real values; null stays unavailable and supported zero stays zero. Screen readers receive the exact record value. Both the local motion preference and operating-system reduced-motion setting cancel or skip animation. No simulated telemetry, fake history, or pollution plumes.

## Data meanings

Unavailable is never substituted with zero. Camera health uses an advancing-frame processing heartbeat evaluated against the active data clock; source capture UTC is reported separately when available. Synthetic camera 223 is stale, not live. Mode labels and separate wall/data clocks remain visible on every route.

The sample for camera 222 contains **one recorded minute**, with 24 crossings, 16 completed traversals, and a queue count of 5. The overview says **1 / 60 recorded minutes**, not full-hour coverage. Detail coverage is explicitly recorded-minute coverage. Other cameras are not silently treated as zero. Stopped time does not establish whether an engine is running.

Estimated tailpipe CO₂ and NOₓ require calibrated completed traversals and documented mappings. Scenario ranges are not statistical confidence intervals. Weather, schools, road regions, and gates are not invented or drawn when unavailable.

## Assets and typography

Manrope and italic Lora are self-hosted in `src/app/fonts/`, with their open font licenses. Interface text uses weight 700 throughout; major headings and metric figures use 800. Tabular monospace readouts distinguish timestamps and numeric data. Icons come from Phosphor. Map geography is OpenFreeMap/OpenStreetMap; camera locations are actual configured coordinates. If map tiles fail, the table remains usable.

Environmental image: `public/images/greener-city.png`, 1536 × 1024. It is generated illustrative imagery, clearly labeled as such, and is not a Torrance site observation or camera frame.

Image prompt: “Premium editorial photograph of a sunlit coastal California urban park, lush trees framing a curved pale path, distant understated buildings, warm natural light, deep leafy greens and muted cream; no people, identifiable vehicles, text, logos, or CCTV appearance.” Generated with the built-in image-generation tool; no external image API credentials were used.

## Verification

Production build passes. All 29 backend tests pass with `node --import tsx --test backend/test/*.test.ts` (the ordinary test wrapper's IPC socket is restricted in this environment). Attachment checks cover a valid export and invalid filename; the actual browser-downloaded synthetic brief matches the displayed draft content.

Browser checks covered all four camera selections, search/no-results/reset, each status filter and sort option, traffic/emissions layers, live/replay/synthetic on overview/detail/review/brief, menus and disclosures, scenario 0/40/100 and invalid 101, blank-number validation, keyboard slider synchronization, all four brief camera options, copying, actual download, mobile layouts, and reduced motion. The latest palette pass rechecked overview, camera detail, review, and brief at desktop/phone widths, light menus, live null states, exact synthetic values, motion on/off, and reduced motion. The camera-network menu marks its active route without opening over the heading. Wide evidence tables remain in their own scroll areas and phone pages do not pan horizontally. Desktop and phone captures and comparison details are recorded in `../design-qa.md`.

## Still open

Worker-to-dashboard delivery, synchronized video, valid road calibration, road regions/gates, contextual integrations, and Vercel deployment remain separate integration work. The UI does not claim a measured environmental improvement, model accuracy, or live deployment.

**Dependency note (7 November 2026, 18:12 America/New_York / 23:12 UTC):** Mert upgraded MapLibre GL JS to 6.17.0 to resolve [GHSA-jrc7-96c5-q579](https://github.com/maplibre/maplibre-gl-js/security/advisories/GHSA-jrc7-96c5-q579). The current map uses third-party style and attribution data, so the patched sanitizer is relevant. The dashboard behavior is preserved.

**Integration note (7 November 2026, 18:18 America/New_York / 23:18 UTC):** Mert connected server pages to validated local worker persistence and added ten-second refreshes for visible live/replay pages. Refresh pauses while a form has focus. Capture timestamps and capture-to-dashboard latency remain unavailable for feeds without machine-readable capture UTC. Local server settings belong in ignored `frontend/.env.local`. Synchronized preview and live GPU delivery are the next verification steps.

**GPU delivery verification (7 November 2026, 18:30 America/New_York / 23:30 UTC):** Mert verified actual four-camera CUDA processing reaching the local dashboard. Camera detail polls temporary annotated frames; boxes and pixels come from the same worker frame. The server keeps only the latest frame per camera/mode in process memory, expires it within 60 seconds, and never writes previews to the aggregate store. Desktop and 390 px phone checks decoded a real camera-222 preview with no page errors or horizontal overflow. Capture UTC stays unavailable and delayed frames are labeled. The completed worker run correctly changed all camera states to offline. The file store requires one persistent host; Vercel/shared database delivery is not established.
