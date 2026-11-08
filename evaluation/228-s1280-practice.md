# Camera 228: final pretrained s/1280 practice comparator

**Owner:** Mert
**Updated:** 7 November 2026, 22:56 America/New_York / 8 November 2026, 03:56 UTC
**Status:** Baseline count file retained; job failed in post-inference metadata validation. Count screen fails. No promotion or rerun.

Mert ran the existing count CLI with pretrained YOLO11s at 1280 pixels, requested 15 FPS, original ByteTrack score fusion/default thresholds and the unchanged camera-228 geometry. Processing initialized at 60 seconds and covered only practice **[60,180)**. The recipe and input hashes were pinned before execution. The reserved **[720,840)** interval remains untouched.

Job **175973** used one H100 MIG `1g.10gb` slice under a three-minute cap. It ended **FAILED / 1:0 after 50 seconds**, after all **30 focused tests plus 12 subtests passed** and the baseline CLI wrote its count report. The allocation is released. The [scalar checkpoint](./228-s1280-practice.json) preserves recipe, weight, input, count, partial-execution and failure-log hashes; raw event timestamps remain private.

## Retained count and evidence limits

The count-1 output contains **77 crossings: 38 positive and 39 negative**, from **1,392 processed frames**. That total remains below both frozen assisted-reference treatments: **138 including ambiguous passages** and **108 excluding them**. The total differences are −44.2% and −28.7%, respectively. These assisted references are not human-confirmed truth, and total agreement alone cannot establish identity correctness. Canonical matching and any independent review remain in the [validation report](./video_validation/report.md).

After CLI completion, the receipt code checked the actual model parameter device was `cuda:0` and predictor image size/confidence/classes were 1280/0.1/[2,3,5,7]. The preserved failure line comes after those assertions. This supports those narrow assertions; it is **not a saved first-frame or argument snapshot**.

The next check compared the entire runtime tracker namespace with the YAML-declared dictionary and failed. The installed tracker can add runtime fields such as device, but the raw namespace was not saved, so its exact differing values are unavailable. The later sample-decision receipt and source-hash postflight were not reached. The report's 1,392-frame total therefore does not establish exact sampled-frame identity with earlier controls. A future independently authorized receipt should compare YAML-defined keys and record additional runtime fields separately; no corrected wrapper was executed here.

No detailed observer was used. The timestamp/direction-only report cannot assess recovery of physical anchors, duplicate vehicles, merges, swaps or class correctness. The retained source/recipe, partial receipt and count file remain separate rather than being rewritten into a successful execution record.

## Decision

Model experiments end at this checkpoint. The count screen fails even the clear-reference treatment, so this practice result does not support promotion, fresh-window access or camera enablement. The [n/1280 trial](./228-native-practice.md) and earlier fusion candidate remain separately preserved and unapproved. No model, tracker, threshold, sampler, geometry, production worker or public contract changed; no training or inference rerun followed the metadata failure.
