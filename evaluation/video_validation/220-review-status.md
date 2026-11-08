# Camera 220 blind review status

**Owner:** Mert. **Updated:** 8 November 2026, 01:02 America/New_York / 8 November 2026, 06:02 UTC.
**Status:** Both declared blind ledgers frozen before any reference access; scoped reference handoff/comparison pending.

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

## Held-out `[360,480)`

| Evidence | Frozen result |
|---|---|
|Assisted passages|106:63positive,43negative|
|Ambiguity-excluded sensitivity|106 (no ambiguous_crossing labels retained after checks)|
|Selected sequence actually inspected|594frames/50ordered sheets|
|Supplementary native-cadence candidate frames inspected|148 (63firsthalf+85secondhalf; may overlap selected source frames)|
|Native source frames in window|1762|
|Coverage/method|Partial/sampled; assisted_visual_sequence_review; human_confirmed=false|
|Freeze time|8November2026,01:01:30America/New_York /06:01:30UTC|

- Ledger semantic SHA`a455b1df0707335b88395f5b1e475e41ad230bce8f9e6b46c70454198a3c55e6`.
- Original frozen-file SHA`ea4e6d373672a77daf37cb02ce088ec42b7801691c36a560b4ac9887ddd12541`.
- Private merge/coverage notes SHA`63491a0ea93b842bb0581587f3a38dfa69bfb1b6a330823730d71b1cd13d0008`.

Both independent halves completed all ordered source frames and corrected-context sheets, with candidate native revisits. The original tighter shared crop had clipped upstream context; the wider rescan explicitly adds one gray approaching sedan inside the finite left endpoint before freeze. The following white SUV stops above the gate and is excluded. Event-order refinements from native evidence are recorded privately; root concatenation only remaps local IDs, with no sorting, deduplication or event changes.

The420s boundary is reconciled: the silver right-turn vehicle remains below/positive gate at420.025 and crosses later in the second half, distinct from the last first-half away car. The final pre480 away crossing is supported by native evidence; the next approaching vehicles remain above the line through the last native frame479.952. First selected360.031/last479.886 and unobserved boundary slivers remain explicit. All side changes are reviewer-labeled clear, but timestamps are approximate/framebounded and this does not establish measured certainty. One van remains unknown visual class; appearance does not establish regulatory weight/fuel.

All220model/manual results remained unopened through both freezes. The operational coordinator received exact immutable hashes/times/coverage and may now release only the two matching window reports, actual configurations and recipes. Remaining full-recording events/counts stay withheld. Verify exact initialization60/360, source/gate/geometry, sampling and runtime provenance before fixed-policy comparison. Missing human references remain pending/null; assisted agreement is not human accuracy or camera acceptance.

This review covers only the two declared windows. Source timing inventory and separately executed full-recording inference do not establish full-recording visual completion. Production220 geometry/enablement and physical approval are unchanged; Carter owns distance calibration. Healthy222/app3138 and reserved228 `[720,840)` remain untouched. No contract/runtime/model change by this stream.

**Held-out freeze (8 November 2026, 01:02 America/New_York / 8 November 2026, 06:02 UTC):** The actual combined ledger is frozen before reference access with106assisted passages. Boundaries, native evidence, uncertainty/coverage and source/gate policy are preserved. Both declared windows are ready for a separately coordinated scoped comparison.
