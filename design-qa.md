# Interface verification

**Who:** Mert  
**Updated:** 7 November 2026, 17:09 America/New_York / 22:09 UTC

**Visual target:** the two user-provided logistics-fleet and travel dashboard screenshots. The request is an original mix of their composition, rounded surfaces, light map, imagery, and approachable hierarchy, with green environmental accents; it is not a literal content clone.

## Evidence

- Source visual truth: `/tmp/emission-lens-ui/ref-logistics.png` (1795 × 1275 crop) and `/tmp/emission-lens-ui/ref-travel.png` (1735 × 1236 crop), cropped from the supplied 3792 × 2452 screenshots to remove browser/gallery framing.
- Rendered implementation: `/tmp/emission-lens-ui/green-desktop-full.jpg` (1440 × 1669), `/tmp/emission-lens-ui/green-desktop.jpg` (1440 × 1040), `/tmp/emission-lens-ui/green-mobile.jpg` (390 × 844), and `/tmp/emission-lens-ui/green-current.jpg` (normal in-app browser viewport).
- Full-view comparison: `/tmp/emission-lens-ui/design-comparison.jpg`; focused cards/map/imagery comparison: `/tmp/emission-lens-ui/design-focus.jpg`. Both boards place the two cropped source designs and the rendered implementation in the same image.
- Viewports: 390 × 844 phone, normal 992/1180-wide browser, and 1440 × 1040 desktop. Captures use CSS-pixel dimensions at 1×; comparison crops are uniformly scaled to equal widths with no distortion.
- State: synthetic sample, camera 222. Real product copy, unavailable estimates, and additional context intentionally differ from the references. Live and replay empty states were also tested.

## Findings and fixes

1. **P2 — Phone evidence panels exceeded the page.** Intrinsic grid tracks let wide tables enlarge their parent sections. Explicit zero-minimum tracks and independent table scroll containers corrected the layout. The camera and overview pages were rechecked at 390 px; viewport and document widths now both equal 390.
2. **P1 — Map surface collapsed after a stylesheet reload.** The map library's relative-position reset could override the canvas positioning. The more-specific map-pane child rule now fixes width and height to the actual map slot. Post-fix evidence shows the real map, all four selectable markers, and working fit controls at desktop and phone widths.
3. **P2 — Native menu interaction before hydration.** A user-opened help menu could differ from its initial server attribute. Native details menus acknowledge that native open-state difference without suppressing text/content checks. Menus were rechecked for outside/Escape dismissal and a final fresh load reported no new browser warnings or errors.
4. **P2 — Data-link download not observed in the in-app browser.** Export now returns a standard text attachment. The browser saved the file successfully, and its content was compared with the displayed synthetic brief. Invalid filenames are rejected.
5. **P2 — Empty scenario and stale draft feedback.** Blank number inputs are required, slider and number stay synchronized, and copy feedback resets with a changed draft. Boundary scenarios and invalid URL values were verified.

## Required visual surfaces

- **Typography:** self-hosted Manrope gives the references' clean sans-serif hierarchy; italic Lora is confined to the editorial environmental card. Labels, units, long titles, and unavailable values wrap without collisions.
- **Spacing/layout:** consistent rounded panels, 16–24 px gaps, compact sidebar, light map, and table hierarchy carry the references into a responsive evidence-focused product. The longer scrollable page is intentional: explanatory provenance is retained rather than replaced by decorative charts.
- **Color/tokens:** warm charcoal replaces the earlier blue HUD; pale green marks selection/actions, amber marks degraded evidence, and text repeats health states. The map remains geographically neutral, with no inferred pollution field.
- **Image quality/assets:** one sharp generated park image, clearly illustrative, replaces the travel imagery with relevant environmental art direction. Phosphor supplies the icon set. The map is actual geographic data; no faux video or invented graph is used.
- **Copy/context:** observations, estimated emissions, calibration, reporting coverage, scenarios, drafts, and disconnected sources are explained in plain language. No unsupported environmental or health claim is added.

## Interaction verification

All navigation routes, all data modes on each route, four map selections, table search/filter/sort/reset, map layers/fit, native menus and disclosures, scenario slider/number/form/validation, all four brief camera choices, clipboard feedback, downloaded attachment, mobile containment, visible keyboard focus, motion toggle, and reduced-motion emulation were checked. The actual downloaded draft matches the preview content (normalizing platform line endings). All 29 backend tests and the production build pass.

## Remaining limitations

No live worker, synchronized video, valid camera calibration, loaded contextual layer, or hosted deployment is implied. A map-network outage was not forced during browser testing; an inline fallback keeps the table available. Browser captures are local verification artifacts, not public repository media.

No actionable P0/P1/P2 visual or interaction findings remain in the requested scope.

final result: passed
