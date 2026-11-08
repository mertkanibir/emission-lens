# Camera 228: original-fusion native-resolution practice trial

**Owner:** Mert
**Updated:** 7 November 2026, 22:56 America/New_York / 8 November 2026, 03:56 UTC
**Status:** Authorized practice experiment complete. Count agreement remains insufficient; candidate is not promoted. Bounded physical review also found a supported duplicate; exhaustive review was stopped.

Mert tested **pretrained YOLO11n at 1280 pixels**, retaining original ByteTrack `fuse_score=True` and every original threshold. The only experimental input change from the verified n/640 control is image size. Same clip, count-1, road/exclusions, min hits 3, hysteresis 0.01, gap 1 second, confidence 0.1, classes, requested 15 FPS and tracker/sampler initialization at **60 seconds** remain fixed. Model processing covers the full practice **[60,180)** and detailed tracing **[83,110)**. The reserved **[720,840)** segment remains untouched.

[Scalar provenance](./228-native-practice.json) records recipes, actual configuration, source/weight/media hashes, control reuse and directional comparisons. The [verified evaluation helper](./practice_fuse_trial.py) now has only two explicitly guarded recipes: the historical n/640 fusion experiment, or n/1280 with byte-identical default tracker YAML. [Tests](../tests/test_practice_fuse_trial.py) reject unsupported resolutions or a changed native-trial YAML. Historical fusion-run helper bytes remain at `590bd73:evaluation/practice_fuse_trial.py` and match the recorded execution hash; old artifacts are unchanged.

## Actual execution and reused control

Frozen job recipe SHA-256: `becdc31711410d82688b427412591381c46e3d8dbda1c0c83756eecff46971c6`.
Candidate pipeline recipe SHA-256: `7294476cc814470428bd8cff82a721dfaf659ae9e3226e93460db79dd30f8cd3`.
Original and candidate-clone YAML SHA-256: `395701d947a749179dee3e327b1181b730c4ca98e7cac5a2ab05280aae573b8b`.

Job **175965** completed **0:0 in 45 seconds**, below a three-minute cap on one H100 MIG `1g.10gb` slice; allocation released. All **44 tests plus 20 subtests passed** on compute. Actual first-frame predictor `imgsz=1280`, tracker `fuse_score=True`, thresholds 0.25/0.1/0.25, buffer 30, first-stage match 0.8, registered callback `persist=True` and inference backend `cuda:0` were read and validated. The resolved installed YAML hash matches the original package file. No package, model weight, production tracker/default, metric or camera configuration changed.

The original n/640/default-fusion control from completed job **175957** was reused. Its count/report, frozen pipeline recipe, actual args/device proof, source hashes, clip/geometry/weight inputs and exact sampler stream were verified against the immutable execution record. No new control inference was needed. Both studies processed **1,392 identical samples**, with the same maximum sampled media time 179.981 seconds. The resolution change intentionally permits different detector outputs; the unchanged sampler/source/geometry remain independently checked.

## Assisted agreement

This is a time/direction comparison against the same current frozen assisted practice ledger, **not human-confirmed accuracy**. Matching maximizes one-to-one cardinality, then minimizes summed time gap, same direction, 1.5-second tolerance, strict half-open bounds; legacy greedy counts are retained separately.

| Reference treatment | Run | Model total | Matched | Unmatched model | Unmatched reference | Agreement precision | Agreement recall | Total error |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Include ambiguous, 138 | n/640 control | 66 | 66 | 0 | 72 | 100.0% | 47.8% | -52.2% |
| Include ambiguous, 138 | n/1280 candidate | 76 | 75 | 1 | 63 | 98.7% | 54.3% | -44.9% |
| Exclude ambiguous, 108 | n/640 control | 66 | 63 | 3 | 45 | 95.5% | 58.3% | -38.9% |
| Exclude ambiguous, 108 | n/1280 candidate | 76 | 64 | 12 | 44 | 84.2% | 59.3% | -29.6% |

Candidate positive/negative totals are **37/39**, versus control **23/43** and inclusive assisted references **69/69**. The higher resolution alone does not close the count deficit. This candidate is separate from the preserved fuse-off experiment, whose apparent numerical improvement included confirmed duplicate association and remains unapproved.

Private count reports, actual args, normalized comparisons, track-admission/event indexes and detail cost/trajectory traces were handed off immediately for the six-anchor and changed-event identity audit. Matching alone cannot establish whether a restored or extra event is the same physical vehicle. Review owners retain that audit and any decision about future fresh validation. No new hypothesis, threshold work, further allocation, full-clip run, training, promotion or camera enablement follows from these results. Raw tracker IDs, per-vehicle event ledgers, footage, YAMLs and capabilities stay out of public source.

**Bounded review follow-up:** The independent review retained or recovered all six predeclared positive physical anchors once, but also supported a separate duplicate physical passage. It stopped changed-event screening at 12 of 43 rows; the remaining sheets are explicitly unreviewed. These local recoveries do not close the aggregate deficit or justify promotion. The [review report](./video_validation/report.md) retains the audit provenance. A separately authorized final [s/1280 baseline comparator](./228-s1280-practice.md) also fails the count screen and ends model experiments; it does not reopen this trial or the reserved fresh interval.
