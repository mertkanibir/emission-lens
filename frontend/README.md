# Frontend

**Owner:** Mert  
**Updated:** 7 November 2026, 15:20 America/New_York (20:20 UTC)

Next.js dashboard for the four Torrance cameras. Overview, camera detail, review, and the investigation brief read `@emission-lens/backend`.

Live mode shows offline cameras and unavailable estimates. Replay is empty and labeled. The synthetic sample is labeled and stays out of live totals. A stale heartbeat is shown as degraded, not live.

Map tiles come from OpenFreeMap. If they fail, the camera list remains the record. Road regions are not drawn because they are not configured.

## Console layout

**Note (7 November 2026, 15:20 America/New_York / 20:20 UTC):** the dashboard was redesigned as a dark map console.

- **Top bar.** Sections, the data mode switch, and a wall clock in Torrance time and UTC.
- **Mode strip.** Every page shows the active mode and that mode's camera counts. It also shows the data clock, which is separate from the wall clock. Replay pages carry a pink rule, and synthetic pages carry a hatched violet rule.
- **Overview.** A camera list and layer status sit on the left, the map in the middle, and the selected camera on the right. A system-check log runs along the bottom. Each log line restates a stored record or its absence.
- **Map markers.** Each marker is a three-lamp signal head. Green means live, amber means degraded, and unlit means offline, and the marker text repeats the state. The map switches between vehicle activity and modeled emissions.
- **Unavailable values.** These render as a dashed "Unavailable" outline, so a missing value is never read as zero.

The typefaces are Overpass and Overpass Mono, loaded through `next/font`. Selection uses lane-paint yellow. Design patterns were studied from public open-source dashboards: ShadowBroker, OSIRIS, and Flowsint. No code was copied from them.

A stopped-time reduction outside 0 to 100 in the URL now shows a message instead of an error page.
