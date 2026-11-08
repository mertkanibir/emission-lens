# Relocated camera-228 count-1 practice reconciliation

**Owner:** Mert. **Updated:** 8 November 2026, 00:33 America/New_York / 8 November 2026, 05:33 UTC.
**Disposition:** Both assisted count-screen bounds fail. Camera228 remains unapproved; no tuning, model execution or new video viewing was performed for this reconciliation.

## Frozen reference and geometry

A separate blind reviewer froze the new `[60,180)` practice ledger before access to model/reference results. It has138 assisted candidates (69 positive,69 negative), with137 after excluding one endpoint-ambiguous positive passage. Four other events retain ambiguous-time labels. All46 selected sheets/547 retained frames were inspected; coverage remains explicitly sampled/partial rather than inspection of every1477 native frame. The ledger records `human_confirmed=false` and no supplied human reference.

| Identity | SHA256 |
|---|---|
|Source clip|`568e224559d391995eb9339c467bc9bf8cc592e4245b6959eda65f0834648d8a`|
|New ledger semantic payload|`7f2b5b404a8fff33921d4111d90f35752adf5fe03dbc8a0191f97ee430892ba0`|
|Original frozen file|`ea3451d5b43ed7157af2b3f0c6a8ab3e24d9ddd94cdeaf582d0b8f9e9df21850`|
|Review v3 full-config raw bytes|`9aa6372157f873088dbf9bd94098d7be071a31d44a987ad37bc8aad4de6a1ffa`|
|Executed v2 full-config raw bytes|`238c036de60a315aca0f03f5c0c2172fa5bd4d1d0bb31caadde627a7fd59138a`|
|Shared selected count-1 semantics|`6c815e5b45d0ca2b0b2d7e42143c94a61d5f07ccbf8ab2db1161212f1e50b8ce`|

Job176055 executed saved `228-image-v2`; the reviewer used `228-image-v3`. Their count-1 object, road/exclusion geometry and pinned counting/metric/matching semantics are exactly equal. Their complete raw/canonical configuration identities remain separate; full-config equivalence is not asserted. Review v3 canonical SHA is `dc9b19f774a8cbd9352b03068969106c760e29a39b7b6c9b215862ac69bc36a9`; execution v2 canonical SHA is `ae074130eb9c8b082b9457eff10dc648a5d320835dba8f91341a1ab52f3a3251`.

The existing harness adapted the actual v2 report using its exact saved v2 geometry and bound the new v3 ledger through their verified selected semantics. The original frozen file was registered byte-for-byte, preserving its pre-access timestamp/hash. Original v1 ledgers/results remain preserved under their separate geometry identity; their timestamps were not reused or rescored here. Count-2/count-3 and held-out/reserved windows are outside this comparison.

## Actual job and comparison

Completed job176055 used the original pretrained n/640, requested15FPS, original ByteTrack/YAML settings and persistence oncuda:0. Its retained source archive, all pinned source hashes, clip/weight/geometry provenance, actual post-CLI configuration and sampler receipt verify. It processed1392 samples from60.060 through179.981s, within the declared half-open window. This is execution/coverage evidence, not measured vehicle accuracy or first-frame tracing.

Count file SHA`08697fa6864851d3408aedce6d300370eafe1e15e7f3f44e42a3ae7906283d94`; recipe file SHA`7df1a7b675bba3db45d1d93679e0eae4cf99b6e3bdb7007fb4f70af64b75ea86`; execution receipt SHA`cd293dcdcec9074ecb19077bde2ee9694a13114d39eed53655bfb3abebeef7a7`.

The actual count-1 result is80 passages:34 positive,46 negative. Matching uses the existing same-direction1.5s maximum-cardinality/minimum-total-gap policy.

| Assisted reference | Model | TP / FP / FN | Agreement recall | Precision | Relative total error | Positive / negative count difference |
|---|---:|---:|---:|---:|---:|---:|
|All138 candidates|80|79 /1 /59|57.25%|98.75%|−42.03%|−35 /−23|
|Excluding one endpoint candidate:137|80|78 /2 /59|56.93%|97.50%|−41.61%|−34 /−23|

An independent exact-microsecond dynamic program reproduced both optimal match counts and minimum summed gaps (10.948s/10.600s). The legacy closest-first sensitivity also gives79/78 matches. Both bounds fail the provisional85% recall/15% absolute relative count-error screen. The137–138 interval is an ambiguity bound, not a confidence interval. These scores describe agreement with a partial assisted ledger; human-reference accuracy remains unavailable. Timestamp matching does not establish same-vehicle identity, duplicate/miss substitution or pipeline root cause.

## Scoped next dependency

Three clear-labeled unmatched candidates, spanning separated positive and negative releases and more than1.5s from every same-direction model pulse, are selected privately for a **proposed, unexecuted spatial diagnosis**. Keep the original ledger and report unchanged. If Mert coordinates that next scope, first anchor each physical trajectory/contact proxy against the frozen finite gate/road/exclusions; only spatially paired detector/track/metric evidence can distinguish visual-candidate error, detection loss, late confirmation, eligibility rejection, identity loss or gate-state behavior. A nearest timestamp alone cannot establish a cause. Any later correction must remain explicitly post-reference.

Private reconciliation artifact SHA`cabf266c4e91e0d0d375dc7c38fe6a30e5a3e471097c8417c4bd5bb8dbcd52a2`; private proposal file SHA`239b13e8c79d40c048cbb303c83fb4aa2ae7fb8d2fba32a553fc48568795864d`. Detailed event IDs, evidence frames and model differences remain private.

No new model sweep, training, gate/ROI/threshold change, camera acceptance, calibration or estimated-emissions approval is proposed by this result. The reserved228 `[720,840)` remains unviewed.220 acquisition/review remains queued for Mert's next coordinated handoff; this reconciliation does not start it. No shared contract or runtime changes.

## Verification

Freeze/ledger/sequence/source hashes, method/geometry/policy identity, strict bounds, chronology, repeated-block audit, exact original preservation, runtime archive and actual sampler/settings receipts were checked. Independent provenance/matching review found no material mismatch. The public manifest adds only this228 review and its current geometry scalars, preserving other camera records and every old review. Package checks and scoped whitespace/privacy checks are recorded in the worklog.
