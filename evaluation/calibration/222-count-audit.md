# Camera 222 count acceptance audit

**Owner:** Mert

**Updated:** 7 November 2026, 21:31 America/New_York / 8 November 2026, 02:31 UTC

This is a numerical/provenance audit of Carter's published evidence in `b1a5edf`, not a second visual annotation. It preserves the [original acceptance record](./222-count-acceptance.json) and [original crossing key](./222-count-1-manual-clip-6m00-8m00.txt). An independent assisted visual review is a separate work stream and has not yet completed.

## Reproduction and boundary sensitivity

The committed human-key SHA-256 matches the record. Both held-out model JSON hashes match GPU job 175806's retained execution manifest. Applying the existing same-direction, closest-first, 1.5-second matcher reproduces the published results exactly:

| Convention | Model / pixels | Human / model / matched | Recall | Precision | Total error |
|---|---|---|---|---|---|
| Original report | YOLO11n / 640 | 66 / 67 / 61 | 92.42% | 91.04% | +1.52% |
| Original report | YOLO11s / 1280 | 66 / 69 / 63 | 95.45% | 91.30% | +4.55% |
| Literal `[360,480)` sensitivity | YOLO11n / 640 | 64 / 67 / 60 | 93.75% | 89.55% | +4.69% |
| Literal `[360,480)` sensitivity | YOLO11s / 1280 | 64 / 69 / 62 | 96.88% | 89.86% | +7.81% |

The human key ends in two distinct `7:60.0 +` entries. The existing parser converts them to 480 seconds, and one matches a prediction at 478.953 seconds. These may be rounded boundary annotations. Inspect the actual adjacent footage before adjudicating them; the half-open calculation above is a sensitivity result, **not corrected ground truth**. Preserve both original entries and record any adjudication as a revision. Simultaneous vehicles are not duplicates merely because their timestamps match.

Both aggregate calculations meet Carter's proposed minimum 85% recall and absolute total error of at most 15%. That is an initial screening criterion, not a guarantee of count accuracy. The original record still describes the criterion as awaiting Mert's confirmation. Under the literal half-open sensitivity, positive-direction total error is +22.22% for YOLO11n and +16.67% for YOLO11s; aggregate totals hide these directional differences. New comparisons must report direction-specific totals, precision, recall and disputed timestamps alongside the overall result.

## Matching and frozen geometry

Closest-first greedy matching is not generally maximum-cardinality: human times `[0,2]` and prediction times `[1.1,3.1]` with tolerance 1.5 admit two matches, while nearest-first takes only one. Maximum-cardinality matching does **not** change the actual 222 match counts in either convention above. New comparisons declare same-direction maximum-cardinality matching, then minimum total absolute time error, with deterministic tie-breaking, before reference access. Retain the original greedy result as an explicit compatibility output.

The acceptance record's pre-enable geometry hash starts `2f53d91…`, while the GPU manifest hash starts `916a653…`. Reconstructing the same pre-enable geometry with CRLF versus LF reproduces those byte hashes; gate coordinates and other semantic geometry match. Future manifests retain both raw-byte hashes and a documented canonical JSON/selected-geometry fingerprint, including road/exclusions, selected gate, direction convention and metrics settings. A semantic fingerprint must not hide an actual gate or policy change.

## Scope and next action

Carter enabled only camera 222's designated `count-1` image-space crossing path. The evidence covers one two-minute daytime held-out interval, one human annotator, pretrained models and requested sampling at 15 FPS. `count-2` is unaccepted. Physical road calibration, distance, speed, engine-running inference and emissions are not authorized by this count result.

Keep Carter's count-only decision and original evidence visible while independently reviewing the boundary/disagreement intervals. Use the proposed 85%/15% criteria as a clearly labeled screening result for upcoming cameras; final activation still requires Mert or Carter's reviewed decision, including directional failures and uncertain visual evidence. Assisted visual ledgers have `human_confirmed=false` until a human actually reviews them. Do not tune geometry using the held-out score.
