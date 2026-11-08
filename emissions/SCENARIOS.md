# Completed-traversal stopped-time scenarios

**Owner:** Mert
**Updated:** 7 November 2026, 19:37 America/New_York / 8 November 2026, 00:37 UTC

`compare_completed_traversal_scenario` in `src/scenario.ts` is a pure calculation interface for a supplied, completed-traversal cohort. It does not configure a camera, approve a regulatory class mapping, collect traversal measurements, or enable live emissions. See the [factor package](./README.md) for the retained CARB factors and their region/year/process limitations.

## Inputs and calculation

`TraversalScenarioInput` uses the existing `EstimateInput` fields, with `stopped_time_reduction_pct` and a `stopped_time_s: number | null` on each individual completed traversal. The stopped component must belong to that traversal. Camera-wide stopped vehicle-seconds or an average queue stop cannot be substituted.

For each traversal:

```text
non-stopped time = total traversal time - stopped time
scenario stopped time = stopped time × (1 - reduction percentage / 100)
scenario traversal time = non-stopped time + scenario stopped time
scenario average speed = that traversal's distance / scenario traversal time
estimated grams = that traversal's distance × matching RUNEX factor
```

Both baseline and scenario call the retained-factor estimator separately for every traversal, then sum grams. They never apply a nonlinear factor to a whole-minute average speed. Ordinary driving-cycle stops are already included in RUNEX; no separate IDLEX term or extra EV discount is added.

Vehicle classes, completed-traversal cohort, segment distances, non-stopped travel time, calibration record, class/VMT mapping, meteorology and factor catalog stay fixed. Original completion timestamps select the same reporting minute on both sides. A hypothetical earlier finish does not move that vehicle into another minute; this comparison is not a network simulation or queue-clearance forecast.

## Result and unavailable states

`CompletedTraversalScenario` includes baseline and scenario `EstimateResult` objects, adjusted per-traversal timing evidence, explicit assumptions and mapping weights, and signed `change_g_by_pollutant` / `change_pct_by_pollutant`. Changes are scenario minus baseline, so positive values mean increases. The outer `shorter-stops-per-traversal-runex-v1.0` method identifies the hypothetical transform; rows retain the underlying completed-traversal RUNEX calculation method.

- A zero-percent reduction exactly reuses the baseline, including when stopped time is unavailable.
- A nonzero reduction with any missing stopped component withholds the entire scenario total. It does not exclude that vehicle or substitute a whole-minute average.
- Stopped time outside zero through the traversal duration, non-finite values, invalid reductions, and invalid distances/durations are rejected.
- A requested reduction that leaves zero total duration yields insufficient scenario evidence. No finite speed or zero-emissions result is invented.
- Speeds beyond the retained factor range, missing calibration/mapping/factors, and empty cohorts preserve unavailable/insufficient-evidence meanings.
- Percent change is null when a side is unavailable or its baseline is zero. A supported zero change remains numeric zero.
- Factor bins can make a faster scenario increase estimated emissions. The engine preserves that increase; it does not clamp results to savings.

The result is marked `hypothetical: true`. Its scenario rows belong with a scenario artifact, **never in observed live emissions totals**. Neither scenario ranges nor statistical confidence intervals are calculated.

## Verification and remaining handoff

The [synthetic calculation tests](../backend/test/traversal-scenario.test.ts) use actual retained CARB factors with explicitly synthetic calibration, traversal data and an illustrative LDA assumption. They activate no real geometry or mapping. Twelve tests cover direct arithmetic, nonlinear per-traversal factor selection, the fixed cohort/non-stopped component, missing values, zero and 100-percent reductions, unsupported speeds, signed increases, input immutability and inherited identity/window validation.

```bash
node --import tsx --test backend/test/traversal-scenario.test.ts
npx tsc -p backend/tsconfig.json
```

A live path still requires reviewed geometry, independently supported physical calibration and its provenance, completed entry/exit traversals with per-traversal stopped time, documented visual-to-CARB VMT assumptions, persistence and read/scenario integration. A valid calibration flag supplied to this pure function is trusted; the function does not independently establish road distances. Current aggregate minute totals are insufficient to reconstruct nonlinear per-traversal scenario emissions. This engine supplies the supported calculation component, not a completed live emissions pipeline.
