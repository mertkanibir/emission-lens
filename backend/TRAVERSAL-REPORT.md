# Completed-traversal calculation report

**Owner:** Mert
**Updated:** 7 November 2026, 19:39 America/New_York / 8 November 2026, 00:39 UTC

`build_completed_traversal_report` is a pure server-side calculation adapter in `src/traversal-report.ts`. It combines a supplied completed-traversal cohort, existing contract-1.1 traffic/emissions records, the retained CARB RUNEX estimator, and an optional per-traversal shorter-stop scenario. Its result is explicitly `stage: calculation_only`.

It does not create observations, approve calibration or class mappings, alter the camera registry, write a worker batch, or publish live totals. The live measurement-to-storage path still requires producer, approved-registry, evidence-persistence and transactional-publication code as well as physical evidence. It is not only configuration work.

## Supplied context

`CompletedTraversalReportInput` contains the existing `EstimateInput` fields, a `WorkerRun`, and optional `stopped_time_reduction_pct`. Traversals may additionally contain `stopped_time_s`, which belongs to that individual completed traversal. An omitted or null stopped component remains unavailable.

The caller must supply the camera, UTC minute, mode, calibration record, explicit visual-to-CARB mapping, meteorology and completed cohort. The adapter validates known cameras, matching calibration camera/run mode, run chronology, unique session/traversal identities, UTC-minute membership, valid class values, positive finite dimensions/times, and stopped-time bounds. It validates traversal data before the estimator's unavailable-calibration early return, so malformed values are not accepted merely because a result would be null. UTC `+00:00` inputs are normalized to `Z` for the existing estimator; input objects are preserved.

Calibration support here means the caller supplied a `valid` record with a version, gates, reference measurements and transform. It does not independently establish that those references are measured, geometry is accurate, or the record is registered/approved. Numeric synthetic tests use explicitly fake calibration and an explicit LDA assumption. No live mapping or physical calibration is selected by default.

## Output meanings

| Output | Meaning |
|---|---|
| `traffic[].count` | Always null: completed traversals cannot reconstruct independent selected-gate crossing counts. |
| `traffic[].completed_traversals` | Number of validated unique members of this supplied cohort, grouped by class. |
| `traffic[].traversal_time_s` | Sum of those members' total elapsed traversal seconds, including their stops. |
| `traffic[].distance_m` | Sum of completed distances only when the supplied calibration metadata supports it; otherwise null. |
| `stopped_vehicle_seconds`, queues, coverage | Null: the broader observed traffic cannot be reconstructed from a completed subset. |
| `emissions` / `calculation` | Existing per-traversal RUNEX results and their evidence/provenance; missing inputs withhold estimates. |
| `scenario` | Optional hypothetical per-traversal recalculation, kept separate from observed emissions rows. |
| `provenance` | Run/model/device, calibration/mapping/factor/method versions, explicit meteorology, and the limitation that supplied UTC is not verified capture UTC. |

Empty cohorts produce no fabricated traffic rows. With supported calibration they produce `insufficient_evidence` emissions, not zero grams. Unknown/unmapped classes withhold the entire emissions total rather than silently omitting those vehicles. Ordinary-stop emissions are already included in RUNEX; no second idle process or extra fleet-average EV discount is added. See [factor methodology](../emissions/README.md).

Only declared record fields are copied into run/traversal evidence. Incidental producer data is not forwarded. Scenario rows remain inside the hypothetical result and must not be inserted as observed live emissions.

## Verification and next dependency

From the repository root:

```bash
node --import tsx --test backend/test/traversal-report.test.ts
npx tsc -p backend/tsconfig.json
```

Eleven focused tests pass, including explicit synthetic estimates, unsupported calibration/mappings, empty/unknown cohorts, per-traversal scenario timing, UTC normalization, mode/camera mismatches, identity duplication, malformed values even without calibration, input immutability, and incidental-field exclusion. No camera, GPU, label, model weight or server build is needed for these checks.

The next integration decision is an approved shared measurement/calibration/mapping handoff and the transactional writer that persists the resulting evidence and aggregates. Existing statically missing camera calibration must not be bypassed to make a live total appear. Crossing accuracy, physical calibration, source capture UTC, observed coverage and environmental impact remain unverified by this adapter.
