# Camera 228: practice-only tracker score-fusion trial

**Owner:** Mert
**Updated:** 7 November 2026, 22:38 America/New_York / 8 November 2026, 03:38 UTC
**Status:** Practice trial complete. Improved time-matched assisted agreement, but the review owner confirmed duplicate association; candidate remains unapproved. No promotion or camera enablement.

The authorized experiment clones the installed ByteTrack YAML and changes **only `fuse_score: true` to `false`** in a private candidate file. Detector/weights remain pretrained YOLO11n at 640 pixels, requested 15 FPS; initialization stays at 60 seconds and processing covers the full practice interval **[60,180)**. Road/exclusions, count-1, every confidence/association threshold, minimum hits 3, hysteresis 0.01 and maximum metric gap 1 second are unchanged. The reserved **[720,840)** interval was not accessed by the trial. The broader full-clip batch remains deferred.

[Scalar evidence](./228-fuse-practice.json), [separate evaluation helper](./practice_fuse_trial.py) and [scope/metadata regression tests](../tests/test_practice_fuse_trial.py) are published. Private YAMLs, frozen recipes, count reports, actual tracker arguments, association matrices, per-track event histories and traces remain under ignored `data/raw/count_check/228-fuse-practice-20261107/`.

## Actual configuration and execution proof

Default YAML SHA-256: `395701d947a749179dee3e327b1181b730c4ca98e7cac5a2ab05280aae573b8b`.
Candidate YAML SHA-256: `2dc2fd19c4f4dea2fd7ae6c33bb192353625d5e22f3323e3f67fb192b9540031`.
Frozen execution recipe SHA-256: `b856d4b428924cc50227c3680e2b058ec0bcc2e944ba7fffb1772fa08ad1d68d`. Distinct control/candidate pipeline recipe hashes bind the actual experiment to normalized comparison identities, including if event outputs happen to coincide.

The initial control attempt **175947** stopped after **24 seconds** on an observer-only metadata error: the installed predictor CFG has no `persist` key. No candidate inference occurred. Its source, recipes, partial control trace and log are preserved. The corrected helper records the actual registered tracking callback's `persist=True` and validates the forwarded call, with a focused missing-attribute regression. Packages/defaults were not upgraded or edited.

Explicitly authorized retry **175957** completed **0:0 in 48 seconds**, within a two-minute cap, on one H100 MIG `1g.10gb` slice. Both actual inference backends were **cuda:0**, with **43 tests plus 18 subtests passing**; the allocation is released. On each run's first processed frame, the helper resolved and hashed the actual YAML and read `vars(tracker.args)`. Arguments were identical except the candidate's `fuse_score=False`; device was `cuda:0`, tracker type ByteTrack, high/low/new thresholds 0.25/0.1/0.25, buffer 30 and first-stage match threshold 0.8.

Both runs processed exactly **1,392 samples**, with identical native-frame sampler decision streams. The control JSON values, classes and event times/directions exactly reproduce the retained original practice result; JSON formatting need not have identical byte hashes. All **324 detailed frames** had byte-equivalent canonical raw detector values across control and candidate. Source/geometry/weights hashes stayed fixed. The helper observes original association costs and assignments without altering their arrays or results. Only the scoped candidate YAML changes tracking decisions; production source/default files remain unchanged.

## Assisted comparison, not human accuracy

The current frozen assisted ledger has 138 candidate events, including 30 ambiguous positive crossings; excluding those leaves 108. Canonical matching is one-to-one, same direction, maximum-cardinality then minimum total absolute time gap at 1.5 seconds, strict half-open bounds. Legacy greedy results remain separate in the evidence. No Carter human reference is supplied.

| Reference treatment | Run | Model total | Matched | Unmatched model | Unmatched reference | Agreement precision | Agreement recall | Total error |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Include ambiguous | Control | 66 | 66 | 0 | 72 | 100.0% | 47.8% | -52.2% |
| Include ambiguous | Candidate | 123 | 118 | 5 | 20 | 95.9% | 85.5% | -10.9% |
| Exclude ambiguous | Control | 66 | 63 | 3 | 45 | 95.5% | 58.3% | -38.9% |
| Exclude ambiguous | Candidate | 123 | 100 | 23 | 8 | 81.3% | 92.6% | +13.9% |

Direction matters: candidate positive/negative totals are **58/65**, against inclusive references **69/69**. Positive agreement precision/recall are **93.1%/78.3%** inclusive, or **62.1%/92.3%** excluding ambiguous crossings. Negative agreement is **98.5%/92.8%** under either treatment. Aggregate screening is not enough to accept positive-direction behavior or explain all changed events.

## Mechanism and remaining audit

Installed score fusion uses `cost = 1 - IoU * incoming_detection_score`. The unconfirmed assignment limit is 0.7: scores below 0.3 cannot confirm even at perfect IoU; higher scores still require sufficient overlap and can lose assignment competition. Turning fusion off changes **both first-stage confirmed/lost association and unconfirmed association**. The low-confidence second stage already uses IoU alone. This is a targeted practice hypothesis with broader association side effects, not an unconfirmed-only switch.

The review owner froze six visual anchors and an audit plan before these results. Private event indexes align normalized event IDs to actual track histories, first metric admission and gate state; the 83–110 traces retain raw detection indices, actual costs/match outcomes and tracker state. Review owners must verify recovery of the **same physical passages**, pre-gate stable history and every changed event for duplicate, merged, swapped or extra associations. Time/direction matching alone cannot do that. Until that audit and separately authorized fresh validation, the candidate stays private and unpromoted. No additional GPU job, fresh-window inference, threshold/sampler/geometry repair, training or production change is authorized by this report.

**Post-result audit:** The independent review owner reported overlapping front/full-body tracks that counted the same vehicle twice, plus probable truck-part duplication and additional groups needing review. These invalidate interpreting the improved time-only total as physical identity recovery. The fuse-off experiment is preserved as improved-but-unapproved. Any different practice candidate is a separately authorized experiment, not a continuation or promotion of this setting.
