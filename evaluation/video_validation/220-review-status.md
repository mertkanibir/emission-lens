# Camera 220 blind review status

**Owner:** Mert. **Updated:** 8 November 2026, 00:56 America/New_York / 8 November 2026, 05:56 UTC.
**Status:** Practice ledger frozen; held-out candidate/boundary reconciliation in progress. All model/manual references remain unopened.

## Practice `[60,180)`

| Evidence | Frozen result |
|---|---|
|Assisted candidates|111:48positive,63negative|
|Excluding18endpoint/boundary ambiguous crossings|93|
|Other timing uncertainty|2ambiguous-time events retained|
|Selected sequence actually inspected|592frames/50ordered sheets|
|Supplementary native-cadence candidate frames inspected|21 (may overlap selected source frames)|
|Native source frames in window|1749|
|Coverage/method|Partial/sampled; assisted_visual_sequence_review; human_confirmed=false|
|Freeze time|8November2026,00:55:52America/New_York /05:55:52UTC|

- Ledger semantic SHA`1cf5964cbea731919d416f8403e2de804cd8f2b890801933ef18a0b4ccf578d4`.
- Original frozen-file SHA`2339ea6a1cd375a53871b2d687fdc478f47a5663adbc9f5bb24bcb5abc4e4445`.
- Private merge/coverage notes SHA`b83eb6f5b882335a5a04f944fcffef74533df2fe09de140711c3c2593f314864`.

Disjoint `[60,120)` and `[120,180)` reviewers completed every ordered selected frame. Root reconciled the120s boundary on the original ordered source: the next away vehicle crosses after120, with no duplicated split event. Local half IDs were explicitly remapped into one chronological ledger; event times/evidence were otherwise retained, with no sorting or deduplication. Chronology, repeated-block, evidence-range and strict half-open checks pass. The initial finite-left-endpoint/first-frame candidate remains ambiguous rather than silently counted as certain. The final second-half passage has native pre180 inclusion evidence; its exact crossing time remains approximate.

The existing220-image-v2 count-1 geometry/policy was frozen using practice footage before any held-out viewing and is unchanged. Raw geometry SHA`5058158807ad085f79f6f660c945c3b36f1c263ffdb4a951c9987df3f4615e2b`; selected semantic SHA`6c6bdcf9ab0cfdcd3f83b94a686d6e8d0681a63e89494fe4ecfd3d520d8a78ae`. See [source/gate readiness](./220-source-readiness.md) for clip, metadata and native-PTS provenance.

An initial shared context crop used the wrong coordinate scale; original960×540 frames and gate overlays were unaffected. Correct wider crops were supplied before freeze. The first reviewer had used its own correctly positioned crops/full frames throughout and checked corrected context; the second enlarged all24 brackets and inspected native bursts. Original inputs, coverage and the correction are retained privately.

The93–111 sensitivity is an ambiguity bound, not a confidence interval. This is assisted partial practice evidence, not human accuracy, a model score or camera acceptance. No model/manual reference has been used to correct or compare this freeze.

## Held-out `[360,480)` and next step

The fixed-policy sequence has594selected frames/50sheets. Independent halves `[360,420)` and `[420,480)` have completed their ordered pass and are checking corrected context, lane pairs, endpoint candidates and boundary slivers. A held-out count is not final or frozen in this checkpoint. Record actual native revisits/uncertainty, reconcile420/480 and freeze the assisted ledger before any reference release. All220model/manual answers remain withheld, including practice results, while that held-out blind boundary is open.

This review covers only the two declared windows; source timing inventory and a separately executed full-recording baseline do not establish full-recording visual completion. Offline model execution/custody is coordinated outside this stream. Production220 geometry/enablement and physical calibration/accuracy are unchanged; Carter owns distance calibration. Healthy222/app3138 and reserved228 `[720,840)` remain untouched. No contract change.
