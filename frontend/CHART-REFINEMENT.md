# Evidence chart refinement

**Owner:** Mert
**Updated:** 8 November 2026, 10:37 America/New_York / 8 November 2026, 15:37 UTC

The supplied one-minute screenshot exposed a column stretching across the full plot width, repeated endpoint labels and no numeric y-axis. Mert replaced that presentation with a compact one-minute spotlight: one28px column beside its exact count, dated supported CO₂ value and scoped comparison link. A single observation never implies a temporal trend.

Longer intervals retain every displayed minute with narrow capped columns, readable integer zero-based y ticks, quiet grid lines, local-time interval boundaries and a separate per-minute CO₂ support band. Hover and keyboard focus reveal exact dated values and the original minute comparison action. Missing values use hatching; supported zero uses an outlined baseline mark. Neither state is filled, interpolated or promoted into a trend. Minute links retain camera, mode, reduction and paired UTC boundaries. Existing scientific approval, duplicate suppression, strict sums and live/replay/synthetic separation remain unchanged.

Validation: all103 frontend tests and frontend TypeScript pass. Two focused chart tests check integer zero-based scale containment and exact sparse/120-minute endpoint selection. The visualization guidance was applied to scale, missingness, labeling and accessible alternate values; no new dependency, client subscription or data request was added. Production desktop/phone visual acceptance follows in the integrated build; the original screenshot is the recorded pre-change visual evidence.
