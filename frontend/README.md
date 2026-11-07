# Frontend

**Owner:** Mert  
**Updated:** 7 November 2026, 16:35 America/New_York (21:35 UTC)

Next.js dashboard for the four Torrance cameras. Overview, camera detail, review, and the investigation brief read `@emission-lens/backend`.

Live mode shows offline cameras and unavailable estimates. Replay is empty and labeled. The synthetic sample is labeled and stays out of live totals. A stale heartbeat is shown as degraded, not live.

Map tiles come from OpenFreeMap. If they fail, the camera list remains the record. Road regions are not drawn because they are not configured.

## Spatial workspace

**Design note (7 November 2026, 16:35 America/New_York / 21:35 UTC):** Mert replaced the flat console with a map-led intelligence workspace. This is a presentation change; the existing contract, calculations, and source records are unchanged by this redesign.

- A tilted geographic basemap sits behind floating camera, evidence, and log panels. The selected camera uses cyan rings; these indicate selection, not a pollution radius or measured coverage.
- The selected camera has a prominent line-crossing count. Missing readings still say Unavailable. Feed diagnostics, calibration, and map configuration expand on demand.
- Camera changes ease the map to the selection and reveal its evidence panel. Fit network restores the four-camera view. The basemap refits when the viewport changes.
- Ambient motion can be switched off in the header. The preference persists locally when storage is available, and the operating-system reduced-motion setting disables animation. Offline camera markers do not pulse.
- Every page retains an explicit live, replay, or synthetic label and separate wall/data clocks. Synthetic samples never enter live totals.
- At phone widths, the map, camera network, selected evidence, and evidence log stack without horizontal page scrolling.

Space Grotesk and IBM Plex Mono are loaded through `next/font`. Cyan indicates selection; green, amber, and unlit markers retain camera-health meanings, repeated in text. There are no invented activity graphs, emissions plumes, or live-video placeholders pretending to be footage.

Verification: production build, all 29 backend tests, and browser checks at 390, 992, and 1440 px. Camera selection, activity/emissions layers, live/replay/synthetic states, diagnostics, motion controls, and camera-detail navigation were checked. The missing basemap wood-pattern warning was resolved by using solid fills.

Open: the dashboard remains fixture-backed. No synchronized video source, valid road calibration, configured road regions/gates, or worker delivery is connected. Vercel deployment remains a later step.
