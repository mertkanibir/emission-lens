# Camera 228: read-only practice trace

**Owner:** Mert
**Updated:** 7 November 2026, 22:14 America/New_York / 8 November 2026, 03:14 UTC
**Status:** Corrected diagnostic completed; baseline prefix events reproduce exactly. Physical-passage attribution and any repair remain with the review owners.

Mert ran a separate observer around the unchanged `evaluation.check_counts.count` function, pretrained YOLO11n/640 and requested 15 FPS. Tracker and sampler initialize at **60 seconds**, matching the retained practice baseline. Every native sampler decision from 60 through 110 seconds is logged; detailed detections/tracks/metrics cover **[83,110)**. Nothing from the reserved **[720,840)** segment was processed. There is no new model, geometry, sampler policy or production change.

[Safe scalar provenance](./228-practice-trace.json), the [observer script](./trace_228_practice.py) and [synthetic observer tests](../tests/test_practice_trace.py) are published. The actual per-frame gzip JSONL, temporary camera-session IDs, boxes, candidate cases and logs remain in ignored `data/raw/count_check/228-practice-trace-20261107/`. Private trace SHA-256: `2e8cfff00e7f723740ce8fd014d523e189c328769a873f45891010662708d28f`. No imagery is generated or retained by the observer.

## Verified execution

The original attempt **175925** failed after **30 seconds** because the observer referred to the older `STrack.tlbr` property; the installed ByteTrack version exposes `xyxy`. It produced no detailed frame rows. Its source, partial trace and log are preserved privately. This is an observer compatibility defect, not a detector/counting result.

After explicit coordinator authorization, corrected job **175928** completed **0:0 in 33 seconds**, within a two-minute cap on one H100 MIG `1g.10gb` slice. The actual inference backend was `cuda:0`; the allocation is released. All **39 tests plus 12 subtests passed** on compute. On the first processed frame at 60.06 seconds, the observer successfully read real `xyxy` boxes and verified its raw-detection callback preceded the ByteTrack callback. No worker, checker, weight or saved geometry bytes changed.

The selected count-1 raw geometry SHA remains `998013dab9c6ab6d04ebcd23caea581957445ea9de7d3109f459dea89f43538c`; selected semantic SHA remains `59dd678caa801e0aea7e1554b83663702fec8ba61a56468d973f796a99910c35`. The original clip SHA is `568e224559d391995eb9339c467bc9bf8cc592e4245b6959eda65f0834648d8a`. Actual source hashes, package versions, weight hash and executed observer hash are retained in the JSON. Both gates' time/direction event sequences over **[60,110)** exactly match the saved original practice run. This verifies observed prefix event equivalence, not identity correctness or vehicle accuracy.

## What was observed

- **366 decoded detail frames; 324 kept and 42 rejected.** All 42 rejections were approximately **0.333–0.667 ms** before `next_due_s`; none was within 1 microsecond. Across the entire processed prefix there was one tiny near-due reject. Actual OpenCV floats and sampler due values before/after each decision are preserved, including signed seconds/tick deltas. No epsilon or sampling fix was applied. These skips alone do not establish the vehicle-count cause.
- **Zero source-gap resets** and **zero removals of an already admitted metric history due to current road/exclusion rejection** occurred in the detailed interval. There were 112 admitted observations without an effective prior history. This does not rule out late first admission, association loss or occlusion.
- **6,533 post-NMS detection observations** and **2,385 returned tracked-vehicle observations** were copied across these frames. Of the latter, 1,900 were eligible and 485 were outside the road polygon; 364 of those also lay in exclusions. These are repeated frame observations, not distinct physical vehicles. Raw detection/confirmed-track differences require spatial/temporal correlation; they do not by themselves identify a missing vehicle.
- The selected-gate predicate reconstruction agrees with actual emissions on every observed row. The private trace separately preserves actual crossings and before/after states; reconstructed predicates never replace or modify a production decision.

Raw PTS ticks are recorded through the same clip's verified decoder offset: `raw_pts = 3025948946 + round(media_time_s * 90000)`. OpenCV media time is the original checker's `CAP_PROP_POS_MSEC / 1000`; this is not a constant-FPS synthetic clock or verified capture UTC. The trace includes post-NMS boxes/classes/confidences before association, actual ByteTrack active/lost/removed states, returned track bottom-centres, road/exclusion membership, finite-gate predicates, signed distance, stable/pending sides, hits, prior/source gaps and actual emitted/deduplicated decisions.

The reviewer/coordinator can pair frozen visual anchors with these private positions and times. No absence-of-detection, physical ID-switch, total deficit explanation, camera acceptance or repair improvement is claimed without that pairing. The full-clip batch remains deferred; no training, promotion or repair trial was run.

## Installed ByteTrack source readback

The worker explicitly passes `bytetrack.yaml`. No same-name repository override was found; the installed resolver selects the sole package file. Read-back defaults are high threshold 0.25, low threshold 0.1, new-track threshold 0.25, track buffer 30, first-stage match threshold 0.8 and `fuse_score: true`. Source/config checksums and line references are in the scalar JSON. These values are reconstructed from the installed default/resolver and unchanged worker call; this trace did not save a direct runtime `tracker.args` snapshot. Any approved candidate should capture that snapshot and resolved file before interpreting results.

The installed `_unconfirmed_association` calls shared `get_dists` and assignment limit **0.7**. With score fusion, `cost = 1 - IoU * incoming_detection_score`; thus a current detection score below **0.3** cannot match even at IoU 1. At score 0.35 the necessary IoU is about 0.857; at 0.40 it is 0.75. This condition concerns the incoming detection, not the prior track's stored score; feasible pairs can still lose assignment competition. Unmatched unconfirmed tracks are removed, while remaining detections above the new-track threshold can start new unconfirmed identities.

This supports a practice hypothesis for delayed confirmation, consistent with the review owners' visually anchored examples. It does not prove all 228 deficits have this cause. A private `fuse_score: false` candidate would also change first-stage confirmed/lost association because it shares `get_dists`; the low-score second stage already uses IoU alone. Possible false confirmation/association changes must be checked if a trial is separately authorized. No tracker YAML, worker/tracker source, threshold, model, geometry or sampler was changed or trialed by this readback.
