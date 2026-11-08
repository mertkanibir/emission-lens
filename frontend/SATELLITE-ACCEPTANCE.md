# Satellite mapping and page alignment

**Owner:** Mert
**Updated:** 8 November 2026, 08:49 America/New_York / 8 November 2026, 13:49 UTC
**Running source:** 252aee34cc34130512d34d21df795d84fb1d2ca3
**Application:** http://127.0.0.1:3152/?camera=222&view=emissions

The camera network uses attributed Esri World Imagery. Camera-point emissions now have brighter halos, visible gram-scaled centers and separate dated value cards. Close222/223 labels sit above/below their geographic pins. The legend identifies varying supported-minute times, the center color cap and screen-space glyph scope. Supported zero has no positive halo; unavailable cameras never supply heat points. The native map tabs reliably select traffic/emissions and return to the network section.

Camera evidence uses observation/estimate and traffic/history rows. The stopped-time counterfactual spans the page with controls beside comparison results on wide screens. Scientific evidence uses a full-width two-column register. Narrow layouts stack naturally; marker cards have explicit widths, the redundant overlays disappear and the fit icon clears imagery attribution.

## Verification

- Final immutable production build succeeds; frontend TypeScript passes. All70 frontend checks pass with `npx tsx --tsconfig frontend/tsconfig.json --test frontend/test/*.test.ts`. The path-alias-free initial invocation failed and was rerun correctly.
- Actual browser checks verify satellite imagery, two supported live estimate points, separated labels, legend/attribution, both native traffic/emissions transitions, and full-width comparison controls/results. A selected completed minute returns the matching cohort and supported baseline/scenario grams; incomplete hours remain unavailable.
- Actual desktop viewport1440px has document width1428px; phone viewport344px has document width332px. Phone labels, zoom/fit controls and imagery attribution were visually inspected. Wide tables retain their internal scroll. This is scoped visual/reflow acceptance, not full accessibility certification.
- Running3152 reports source252aee3 and fresh222/223 heartbeats. The consumer retains exactly the same authoritative store, registry and private environment/review paths; protected3151 and GPU job176773 remain running. No worker restart, camera eligibility, formula, scientific input, contract or retained record was changed.
- Rejected loading-state screenshots were replaced with initialized captures. The isolated preview briefly failed to bind during graceful old-process shutdown; the launcher now waits for its owned port to clear, and the candidate plus3152 are healthy.

## Operating limits

Camera220/228 exclusions and prior failed-run pending envelopes remain unchanged. Heat shows camera estimates, without establishing unobserved-road emissions, dispersion or exposure. Satellite imagery requires network tile delivery; a tile failure retains camera records and point overlays. Long operation, independent scientific validation and hosted persistence remain separate acceptance items.

Private build/launch receipts and accepted screenshots are under ignored `runs/map-layout-qa/` and the dated immutable workspace. No footage or credentials are published.
