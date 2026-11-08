# Supported-minute emissions heat map

**Owner:** Mert

**Updated:** 7 November 2026, 23:31 America/New_York / 8 November 2026, 04:31 UTC

**Status:** Mounted and browser-verified against actual camera-222 records; the bounded GPU worker has stopped.

The overview's **Emissions heat map** uses the latest supported measurement minute for each camera. The server reads `read_measurement_window`, selects an approved camera/mode/calibration/mapping snapshot, and sends only its timestamp and pollutant values to the map. `CameraMap` supplies a GeoJSON source and a MapLibre heat layer. Existing page refreshes re-read the source every ten seconds in live/replay mode.

This is a **camera-point visualization of estimated CO₂**, not a pollution concentration, plume, exposure surface or whole-intersection total. Display weighting is monotonic and capped at 100 g for legibility; glow radius is in screen pixels. It carries no physical coverage meaning. The selected pin and legend retain the supported minute's timestamp and current processing status. Cameras can therefore show an older supported snapshot while clearly marked Offline. The warmer color is not a health-risk category.

## Evidence and unavailable data

- Live and replay use their own approved records. Synthetic inputs cannot contribute heat points.
- A newer insufficient-evidence minute does not erase the separately labeled last supported snapshot or become zero. The full reporting-window estimate remains unchanged and may be null.
- Unsupported, unapproved, mismatched, out-of-window, nonfinite or ambiguous duplicate records contribute no point. Supported zero remains a labeled zero with zero heat weight.
- No public contract, calculation, calibration approval, frame/model setting, private evidence or worker state is changed by the display.

The initial visual check used a byte-identical full snapshot clone. The mounted read-only consumer was then connected to the **actual authoritative local store and private registry used by the isolated ingestion service**. Both modes' public measurement records and approvals match that service exactly, and the source snapshot hash remains unchanged by consumer reads. The consumer has no worker token. This is one-host file persistence, not shared hosted storage or a Supabase deployment. Future accepted writes to that store are visible through the existing refresh/read-cache invalidation path; no continuous worker is claimed.

Camera 222's supported live minute renders **17.3 g CO₂** at **7 November, 20:00 PST**; replay renders **35.7 g** at **19:58 PST**. Each full window also has an insufficient-evidence minute and retains a null whole-window total. These values retain the owner-approved fixed 20 m, fleet and meteorology assumptions; independent scale/path/traversal accuracy remains open. Other cameras have no supported records in this mounted store, including the separately owner-enabled camera 223.

## Verification

- All **41 frontend tests**, TypeScript and the isolated production build pass. Seven selector tests cover approval/version/mode/row matching, half-open bounds, duplicate rejection, source immutability, small NOₓ and null/zero behavior.
- An independent lifecycle review caught and fixed waiting on MapLibre's one-time `load` event after later source/tile loads. Initial load now establishes readiness; subsequent data/view changes update immediately.
- Browser verification confirms the rendered layer is ready with one live heat point, the timestamped 17.3 g pin and Offline state, Traffic hides the glow, Replay switches to its own 35.7 g snapshot, Synthetic clears all points, and returning to Live restores only its record. No browser errors were reported.
- Scope/assumption disclosure, unavailable window totals and the existing per-minute evidence remain visible. Original localhost is unchanged.

The review page is **http://127.0.0.1:3138/?camera=222&view=emissions**. Its private process/source pointer is retained outside Git at `/tmp/emission-lens-heatmap-path.json`; records age out of the rolling reporting hour normally. The screenshot is retained outside the public repository. No source timestamps are rewritten to keep a demonstration visible.

Map behavior follows the [MapLibre heatmap example](https://maplibre.org/maplibre-gl-js/docs/examples/create-a-heatmap-layer/) and [style specification](https://maplibre.org/maplibre-style-spec/layers/).

## NOₓ snapshot display — 7 November 2026, 23:44 America/New_York / 8 November 2026, 04:44 UTC

The selected map pin now includes NOₓ from the same supported minute as its CO₂ value. In emissions view, the side card explicitly reads **Estimated NOₓ · snapshot** and shows the matching local timestamp. Its earlier generic NOₓ label read the strict whole-window total, so it remained unavailable despite an available supported-minute record. Traffic view retains that strict result under **Estimated NOₓ · reporting window**. No partial snapshot is substituted into a whole-window total.

Browser checks verify live **0.003162 g** (source 0.003161844094161299 g) at 20:00 PST and replay **0.006534 g** (source 0.0065337364924251285 g) at 19:58 PST. Traffic's incomplete window remains unavailable. Small values retain precision, null stays unavailable, and no pollutant is borrowed from another minute or mode. Heat colors remain weighted by CO₂; NOₓ is a separately labeled estimate. All 41 frontend tests, TypeScript and the production build pass, with no browser errors. The underlying store, registry, calculations and worker state are unchanged.

**Satellite and visibility update (8 November 2026, 08:35 America/New_York / 8 November 2026, 13:35 UTC) — Mert:** The network now uses attributed Esri World Imagery raster tiles. Style readiness initializes point overlays without waiting for all imagery. Brighter screen-space heat/ring/core glyphs and dated badges expose each supported camera estimate; zero stays labeled without a positive halo, and unavailable cameras remain absent from heat data. The legend discloses the 100 g color cap and differing minute times. The camera detail uses aligned observation/estimate and traffic/history rows, then a full-width counterfactual with adjacent controls/results and a full-width evidence grid. Contract, scientific inputs, worker and private records are unchanged. Seventy frontend checks and TypeScript pass; immutable production/browser acceptance is pending before publication.

**Browser refinement (8 November 2026, 08:37 America/New_York / 8 November 2026, 13:37 UTC) — Mert:** The immutable initial build passes and actual satellite imagery, two supported glyphs, live inputs and full-width comparison are visible. Nearby 222/223 badges overlapped; separated them north/above and south/below while preserving geographic pin coordinates, and exposed the scaled center around each pin. The legend distinguishes gram-scaled centers from density-dependent halo colors. Final rebuild/reflow acceptance follows; nothing has replaced3152 yet.

**Navigation and phone correction (8 November 2026, 08:40 America/New_York / 8 November 2026, 13:40 UTC) — Mert:** Actual live-refresh navigation left the map toggle unchanged during repeated client transitions. Map tabs now use native canonical links back to the network section. On the narrow map, the redundant support overlay covered the lower badge; hide it below600px while retaining the support count in the legend, and compact the dated badges. Final rebuild/acceptance remains required.

**Narrow label sizing (8 November 2026, 08:42 America/New_York / 8 November 2026, 13:42 UTC) — Mert:** The final phone inspection exposed absolute-label shrink-to-fit wrapping into tall columns. Set an explicit116px card width and hide the redundant location pill below600px. Use a compact fit icon above the attribution so the imagery credits remain unobscured. Native emissions navigation reached the correct mode, point readiness passed and document width remained within the344px viewport. Rebuild and final visual acceptance follow.

**Completed acceptance (8 November 2026, 08:49 America/New_York / 8 November 2026, 13:49 UTC) — Mert:** Final source252aee3 is built, published and running on3152 with the same private persistence and3151 producer. Satellite imagery, two supported point glyphs, native map transitions, desktop/phone labels and full-width comparisons pass; all70 frontend checks pass. See [the scoped acceptance record](./SATELLITE-ACCEPTANCE.md). Scientific limitations and220/228 exclusions remain intact.
