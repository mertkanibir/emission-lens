# Exact stop-v1 policy: controlled CPU end-to-end check

**Owner:** Mert

**Updated:** 8 November 2026, 01:03 America/New_York / 8 November 2026, 06:03 UTC

**Status:** Four controlled software cases pass using Carter's exact new camera-222 configuration through the existing producer, authenticated HTTP ingestion, calculation/scenario and process reload. Actual video/detector acceptance remains separate.

## Source and scope

Carter's 8 November 2026, 00:45:01 New York / 05:45:01 UTC attachment and 00:45:44 / 05:45:44 follow-up enable stopped-time classification for new 222/223 contexts/outboxes while retaining the registry. This check copies the actual 222 attachment unchanged: SHA-256 `6ffbac2983c8f2d465b2495a3d2238aaa7fd7c679776277b69f71ac607234b36`, context `222-context-v1-7f52d53d+stop-v1`, method `222-image-stop-v1-0.0225`, literal threshold **0.0225**. It does not substitute the fitter's full-precision threshold. The existing approved geometry and scoped two-camera registry are copied to independent private stores; accepted applications, outboxes and snapshots stay unchanged.

`check.py` calls the actual `TraversalBridge`, `MinuteAggregator`, durable outboxes and production measurement HTTP/scenario handlers. Controlled positions exercise a supported stop, a stop that changes the factor bin, supported zero stopped time, and an explicitly injected missing previous image point. These are software controls, not footage or field accuracy evidence. The [safe scalar receipt](./controlled-result.json) preserves hashes and checks without wire identities, tokens or source frames.

## Verified results

- Stopped time stays between zero and total traversal time. Known zero stays zero; partially unknown observation stays null, with its nonzero-reduction scenario withheld while the supported baseline remains available.
- The 20% hypothetical scenario holds distance/cohort/mixture/weather constant and uses `new_duration = total_duration - 0.2 × stopped_time`. Same-bin zero change and a different-bin recalculation are checked; neither is a measured intervention benefit.
- A separate Python oracle reads original RUNEX g/vehicle-mile factors and the approved VMT mixture, then scales by the 20 m distance. It reproduces both pollutants' baseline and scenario, with no extra ordinary-idle process or fuel discount.
- Exact observation linkage is checked. An intentionally broken reference withholds estimates; a corrected higher revision restores the same cohort. Exact retries return duplicate receipts without increasing traffic or grams. Negative/excessive stopped totals receive HTTP 400 without changing committed bytes.
- Revoking replay calibration scope in the private registry copy withholds estimates; original registry bytes are restored. Private evidence requires authentication, replay produces no live rows, and a fresh backend process reloads identical minutes, registry/scenario/evidence and snapshot bytes.
- All four cases pass; the existing 43 traversal tests and Python compilation also pass. An initial harness field-name mismatch was corrected to the existing typed `stopped_time_s` field and the full check reran successfully; no runtime fix was needed.

Run with supplied private policy/geometry/registry paths and a **new** ignored output directory:

```sh
python3 evaluation/reliability/stopped-policy/check.py --policy <exact-222-stop-v1.json> --geometry <approved-222-geometry.json> --registry <scoped-approved-registry.json> --out runs/reliability/<new-check-directory>
```

## Scientific and acceptance limits

The threshold fit is in-sample `[180,300)`, based on calibration-derived speed labels, not independent stopped-time ground truth. Camera 222 has only 12 stopped-reference intervals among 3,714 in-movement intervals, with reported in-movement stopped recall one third; camera 223 has zero stopped-reference intervals among 3,435 in-movement intervals. Broad-region fit agreement does not establish movement stop accuracy. Real positive completed-stop cohorts or a positive 20% change are not promised; null and supported zero are valid outcomes. Reusing the fit window must be labeled in-sample.

The registry enforces calibration/mapping by mode, version and source time. Stop-method authority here is Carter's exact attachment and run configuration hash; the current measurement envelope has no separate server registry field for stop-policy approval. No approval rule, contract, factor, worker/backend source, status timeout, engine-running inference or production service was changed by this check. Camera 220/228 count/physical metrics remain unavailable. Real-video acceptance and conservative interpretation of legacy null-stop cohorts remain with the separately coordinated candidate run.
