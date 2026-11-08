# CARB emissions factors

**Owner:** Mert, factor acquisition and calculation interface; Carter, vision and proposed emissions methodology ownership.

**Updated:** 7 November 2026, 16:25 America/New_York (21:25 UTC)

## Delivered

The public CARB EMFAC Web Project Analysis request completed successfully. The original CSV contains **15,186 rows**. The validated subset contains **1,296 RUNEX CO₂/NOₓ factors**: 12 regulatory categories × 18 speed bins × three temperature assumptions × two pollutants. The table has no missing requested cells, duplicate keys, negative rates, or non-finite rates.

- Model: **EMFAC2025 v2.1.1**.
- Geography: **Los Angeles (SC)**, the South Coast portion of Los Angeles County containing Torrance.
- Calendar year / season: **2026 / Annual**. These are annual fleet assumptions, not November-specific factors.
- Vehicle scheme: **EMFAC2007**; `LDA`, `LDT1`, `LDT2`, `MDV`, `MCY`, `LHDT1`, `LHDT2`, `MHDT`, `HHDT`, `SBUS`, `UBUS`, `OBUS`.
- Fuel and model year: **aggregated by CARB using the regional fleet/activity assumptions**, including its electric share. No extra EV discount is applied.
- Meteorology: **60, 70, and 80 °F, each at 60% relative humidity**. These are explicit illustrative assumptions, not current weather observations or weather forecasts.
- Source units: **g/vehicle-mile**. Normalized units: **g/vehicle-km**, dividing by exactly `1.609344`.
- Retrieval: **7 November 2026, 16:19 America/New_York (21:19 UTC)**. Exact UTC time, original archive URL and hashes are in `data/la-2026/receipt.json`.

`data/la-2026/carb-source.csv` is the untouched CARB CSV extracted from the archive. `factors.json` retains the source line and original rate for every normalized factor. `receipt.json` records the request, CSV/archive/normalized SHA-256 digests, and validation counts. The API's client IP, user-agent and request capability are not committed.

## Method and boundaries

For each completed calibrated traversal:

```text
average speed = distance / total traversal time, including stops
estimated grams = distance in kilometres × RUNEX g/vehicle-km
```

The implementation evaluates each traversal separately, then sums grams. It does not apply a nonlinear speed factor to a whole minute's mean speed. It uses the documented upper-edge bins `(0,5]`, `(5,10]`, etc. in mph, with a conservative maximum supported lookup speed of 90 mph. Floating-point noise at exact bin boundaries is handled. Interpolation between bin midpoint factors is not implemented.

Only **RUNEX** is used for estimates. The retained source also contains other pollutants/processes, but they do not enter calculations. Ordinary intersection stops are included in RUNEX; adding IDLEX would double-count ordinary idling. No engine-running claim is inferred from stopped time. Start emissions, extended heavy-duty idle, brake/tire wear, and unobserved roads are outside this calculation.

Each estimate requires a matching camera calibration marked valid with its gates, references and transform, positive finite completed-traversal distances and durations, a UTC completion time in the reporting minute, and unique per-session traversal IDs. Factors are restricted to the four configured Torrance cameras and the camera-local calendar year 2026. This interface trusts the calibration validation record; it does not independently validate geometry.

Invalid calibration suppresses estimates. No completed traversals yields `insufficient_evidence`, including a queue that has not cleared. Missing factors or any unmapped/unknown traversal withhold the total rather than silently excluding that vehicle. There is no arbitrary missing-footage multiplier. Live, replay and synthetic mode labels pass through unchanged.

## Visual-class mappings

No production mapping is silently enabled. A versioned `ClassMapping` must provide evidence or explicit scenario assumptions and VMT weights summing to one within each visual class. Vehicle population shares cannot automatically be used as VMT shares.

| Visual class | Mapping decision still needed |
|---|---|
| car | Distinguish or document a mixture of passenger cars and light-duty categories (`LDA`, `LDT1`, `LDT2`, `MDV`). |
| truck | Document a mixture of `LHDT1`, `LHDT2`, `MHDT`, and `HHDT`; appearance alone does not establish weight class. |
| bus | Document the relevant `SBUS`, `UBUS`, and `OBUS` mixture. |
| motorcycle | `MCY` is the candidate category, subject to classification validation. |
| unknown | Remains unknown; no implicit fleet-average substitution. |

Carter's custom labels and training are untouched. These are mapping proposals, not new contract classes or approved live assumptions. The example's single `LDA` assumption is labeled synthetic and is never loaded into live totals.

## Use and reproduce

From the repository root, using Python 3.9+ and the existing Node dependencies:

```bash
python3 -m emissions.fetch_emfac
npm run test:emissions
npm test
npm run emissions:example
npm run build
```

The acquisition command posts only the public regional request settings, polls CARB every 15 seconds, and resumes a pending request from the ignored `emissions/.local/` folder. It fails without replacing shared artifacts if the response format, scope, grid or numeric values are invalid. CARB may expire generated download URLs; the retained CSV and receipt permit offline reproduction of normalization without depending on URL retention.

The backend exports `get_factor_catalog_status`, `lookup_runex_factor`, and `estimate_completed_traversals`. The estimator returns contract-1.0 `EmissionsMinute` rows plus calculation evidence, calibration/mapping versions, mapping evidence and explicit meteorology. Persist that evidence alongside the rows when the worker write path is implemented. This package does not create that write path.

`npm run emissions:example` uses real factors with a **synthetic one-mile, ten-mph traversal**, synthetic calibration, and an explicitly hypothetical LDA mapping. The saved result is `evaluation/emfac-calculation.json`; it is an arithmetic check, not a live environmental result.

## Remaining limits

The factor-data dependency is resolved for the documented scope. Camera calibration, approved visual-to-regulatory class mixtures, completed worker traversals and worker-to-dashboard persistence remain necessary for live estimates. Weather-specific factor refreshes require another explicit request. Temperature sensitivity is not a complete uncertainty model: estimate ranges stay null until a documented scenario method is implemented, and must not be called confidence intervals.

## Sources

- [CARB EMFAC Web](https://emfac.arb.ca.gov/), public project-analysis export; source archive link is recorded in the receipt.
- [Project-level methodology and process units](https://emfac.arb.ca.gov/emfac2025-usersguide/uchap/ch6.pl_mode.html), including speed-bin definitions, ordinary-idle treatment and aggregation assumptions.
- [CSV output documentation](https://emfac.arb.ca.gov/emfac2025-usersguide/uchap/ch7.output.html).

CARB publishes the source data. The normalized subset is a reproducible transformation by Mert, not a CARB endorsement or regulatory determination. No source licence grant beyond the public source's terms is asserted.

**Calculation checkpoint (7 November 2026, 19:41 America/New_York / 8 November 2026, 00:41 UTC):** Added the pure [per-completed-traversal stopped-time scenario engine](./SCENARIOS.md) and the backend's [calculation-only report](../backend/TRAVERSAL-REPORT.md). Explicit synthetic tests verify real-factor arithmetic and nonlinear speed-bin selection per vehicle, fixed cohort/assumptions, signed increases and unavailable evidence. No live geometry, regulatory mixture, EV discount or uncertainty interval is enabled. The current worker still emits no emissions; measurement producer, approved shared registries, evidence persistence and authoritative publication remain required code/evidence work.


**Server binding (7 November 2026, 20:49 America/New_York / 8 November 2026, 01:49 UTC):** Exported the existing class-mixture validator as `validate_class_mapping` for strict registry loading. The backend now persists approved-source estimates and private contributions atomically, binds per-traversal scenarios and briefs, and withholds revoked/stale derivations; see [measurement integration](../backend/MEASUREMENT-INGESTION.md). These are software-path tests with controlled synthetic approval records, not real camera/mapping approval. The pure estimator still trusts its explicit calculation inputs; only the server registry establishes authority for persisted numeric output. RUNEX-only arithmetic, supported factor scope, missing-evidence semantics and null ranges are unchanged.
