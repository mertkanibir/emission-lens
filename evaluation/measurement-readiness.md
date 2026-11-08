# Measurement readiness and producer handoff

**Owner:** Mert
**Updated:** 7 November 2026, 19:37 America/New_York / 8 November 2026, 00:37 UTC
**Status:** Readiness inventory and interface proposal; no camera is physically calibrated or enabled by this work.

## Evidence available at this checkpoint

`contracts/src/cameras.ts` sets all four road regions to null and all four `CameraCalibration` records to `missing`, version `unconfigured`. The four YAML files enable stream ingestion only. The local checkout has **no** `config/cameras/<id>.measurement.json`; only the arbitrary disabled/unvalidated `measurement.example.json` exists. Carter's 18:40 worklog entry reports recorded clips and a drawing tool on his environment; those clips/drawings are not present in this checkout and are not assumed lost or overwritten.

At initial inventory, local `data/raw/` contained labeling material and the fine-tuning dataset (400 still frames), without continuous traffic recordings. No retained `data/raw/clips/`, manual crossing-event file, stopped-interval annotation, measured ground-control table or physical-calibration evidence was found in `config/`, `evaluation/` or the local private data roots (environment/cache directories excluded). The prior GPU replay diagnostic documents a six-second real-source replay whose temporary clip was removed; that diagnostic is not a reusable manual crossing answer key. A new bounded camera-222 recording is now available under ignored `data/raw/measurement-review-clips/`. Its [scalar provenance](./calibration/222-recording-20261108T003312Z.json) records 14 HLS segments (sequences 26424–26437), 140.519 summed segment-seconds, 2,108 decoded 1280 × 720 frames and decoder time 0–140.452 s, with no nonadvancing decoded timestamps. Recording receipts span 00:33:16–00:35:06 UTC on 8 November (19:33:16–19:35:06 America/New_York on 7 November). There were zero recorder-reported sequence gaps and one retrieval/poll error. Neither successful decoding nor no reported sequence gap proves complete footage coverage or capture UTC. Manual/runtime crossing checks remain unperformed; the private clip is retained only for that pending review/demo purpose and must be removed when it ends.

| Camera | Available stills | Saved real measurement JSON locally | Reviewed selected-gate crossings | Independent scaled references / physical transform | Current readiness |
|---|---|---|---|---|---|
| 222, Carson | 100 dataset stills; 15 held-out; new 140.519 s local recording | None; separate proposal below | None | None / missing | First review candidate; image counts and physical quantities unavailable |
| 223, Torrance | 100 dataset stills; 15 held-out | None | None | None / missing | Await Carter drawing and clip review |
| 228, 182nd | 100 dataset stills; 15 held-out | None | None | None / missing | Await Carter drawing and clip review |
| 220, Crenshaw | 100 dataset stills; 15 held-out | None | None | None / missing | Await Carter drawing and clip review |

A negative inventory is scoped to files actually available here, not a claim that Carter lacks private work elsewhere. No training labels, weights or existing drawings were changed.

## Camera 222 image proposal, separate from runnable configuration

[222-image-proposal.json](./calibration/222-image-proposal.json) records the inspected frame hash and normalized geometry. Source: `222_20261107T211511Z_00154.jpg`, 1280 × 720. Its filename time is not independently verified capture UTC. The visible image clock is recorded separately; it is not silently substituted for a UTC timing source.

The proposal isolates the near-centre approach toward the crosswalk, leaving the rightmost turning area and sidewalks outside the region. Polygon vertices: `(0.56,0.34), (0.70,0.34), (0.75,0.12), (0.69,0.12)`. Proposed designated counting gate `approach-toward-camera`: `(0.59,0.29)` → `(0.70,0.29)`, positive direction. With image y increasing downward, this ordered horizontal gate's positive side is below the line. Review actual lane paths and gate endpoint coverage on continuous footage before adopting this geometry. It is not a final lane assignment, geographic direction, traversal pair or distance measurement.

`enabled=false`, `image_geometry_status=unvalidated`, physical calibration `missing`; no file is installed in `config/cameras/`. No stopped threshold, queue polygon, physical reference or entry/exit pair is invented. Compare the proposal with Carter's actual drawing once available rather than replacing it.

## Selected-gate manual held-out crossing acceptance

1. Freeze a clip hash, source/master URL, recording receipt times, HLS sequence/gap metadata and decoded time basis. Identify continuous usable intervals; a download/recording start is not source capture UTC. Use footage outside the detector train/validation/test collection for a new runtime check.
2. Freeze the geometry hash/version, one designated count gate and permitted direction(s), bottom-centre observation proxy, minimum hits, hysteresis and maximum observation gap **before** scoring. Entry and exit gates must not both inflate the same flow total.
3. Mert or Carter manually records every identifiable vehicle crossing the finite selected gate in each usable interval: local event token, media-time interval bracketing crossing, direction, broad class or unknown, occlusion/endpoint ambiguity, and review note. Include non-crossers, jitter, turns, short occlusions and tracks near endpoints as explicit checks. No plate/person identity; event tokens are clip-local.
4. Run the **actual runtime detector/tracker** (YOLO11n, 640, current pinned settings and source hashes) on the same replay pipeline. Match events one-to-one within a tolerance fixed before comparison. Record per-direction/class true matches, misses, duplicates, false positives, signed count error, absolute error, support and excluded intervals. A supported zero requires complete reviewed evidence for that interval; no usable evidence is unavailable.
5. Set acceptable errors, time-matching tolerance and minimum support with project coordination before accepting a camera. No numerical acceptance threshold has yet been agreed, so none is presented as passed. Record reviewer/date and discrepancies. Enable image geometry only after the recorded selected-gate check passes; this still does not enable metres, speeds or emissions.

The held-out comparison in `empire-ai-175644-comparison.*` used YOLO11s at 1280. Its accuracy numbers **do not validate YOLO11n/640**, ByteTrack identity continuity, line crossings, stopped time or frame-drop/reconnect behavior. The existing 120-second runtime benchmark validates bounded execution and records drops, not traffic accuracy. A reconnect can replay overlapping source video; temporary identity reset alone does not deduplicate that footage.

## Physical evidence required before calibration validity

Record a dated view fingerprint (camera, image size, zoom/orientation), road-plane domain and reference coordinate system in metres. Obtain documented independently scaled road points/distances with source, measurement method, date and uncertainty. Fit from at least four suitable non-collinear correspondences, reserve additional independently measured landmarks/distances for validation, and retain fit and held-out evidence separately. A map pin, guessed lane width, typical paint dimensions or speed limit supplies no independent scale.

Specify entry/exit gates and allowed lane movement, supported road-segment/path distance, physical stopped threshold and predeclared residual/traversal tolerances. A turning movement's chord is not silently its travelled path. Validate across the intended road region, not just the fitted landmarks. Record camera-motion, horizon/foreshortening, occlusion and road-planarity limits. Passing matrix arithmetic alone cannot confer camera validity. See [OpenCV's planar homography reference](https://docs.opencv.org/4.x/d9/dab/tutorial_homography.html).

No usable scaled references are currently available, so all four physical calibrations remain missing. Counts can eventually be independently reviewed in image space; physical speed, distance-based queue length, calibrated traversals and estimated emissions stay unavailable until their separate gates pass. An observed queue with no completed calibrated traversals is insufficient emissions evidence, never a zero estimate.

## Internal producer handoff — proposal, not an approved transport change

Existing contract 1.1 records and `emissions.CompletedTraversal` are preferred. No production producer, transport, schema or scenario behavior is changed here. Rich evidence below is a proposed private sidecar until coordination agrees ownership and validation. No temporary track identities enter persistent public aggregates.

| Quantity | Precise proposed meaning |
|---|---|
| Context and identity | Enclosing run ID, camera ID and mode; session key `(run,camera,reader_session)`; opaque stable traversal ID created at entry. Tracker IDs are private and camera/session scoped. |
| Geometry provenance | Immutable image-geometry/calibration version and content hash, road domain, ordered movement/entry/exit gate IDs, distance method and independently reviewed validation references. No physical quantity without accepted calibration. |
| Source time | Monotonic entry/exit media seconds within one continuous session. Keep gate-confirmation media times separately: current `CrossingEvent.media_time_s` is hysteresis confirmation time, not interpolated crossing time. Interpolated crossings require brackets and a documented estimator. |
| UTC and receipts | Preserve receipt UTC and clock method/version/anchor separately. Current HLS minimum-delay anchor yields **estimated** event UTC, not verified capture UTC. Use source-time differences for durations. Replay receipts do not establish original recording UTC. Normalize calculator-facing timestamps to UTC `Z`. |
| Completion | Exactly one ordered entry→exit within the same supported movement, continuous session/identity and calibration version, with no disqualifying gap, ROI exit or lost identity. Incomplete/rejected tracks are recorded as reasons, not completed traversals or zero distances. |
| Distance and duration | Positive segment/path metres and positive `exit_media_s − entry_media_s` seconds including stops. Do not derive distance by summing noisy box-footpoint displacement. Do not substitute receipt/processing duration. |
| Class | Settled supported visual class at completion with model/rule provenance. Unknown/unmapped remains unknown. Generic truck is not a known regulatory weight/fuel category. |
| Stopped interval | Half-open `[start_media_s,end_media_s)` with method (image displacement or validated road plane), threshold, qualification policy and optional traversal association. Image-based stationary evidence does not establish engine state. |
| Quality and lifecycle | Complete/incomplete/rejected reason, observation support, dropped/gap intervals, calibration status and continuity evidence. Reconnect, backward/repeated media, excessive gaps, tracker loss, calibration/view change reject open traversals. Source overlap must be excluded/withheld if not independently resolved. |

Project accepted traversal evidence into existing `CompletedTraversal`: `session_id`, `traversal_id`, UTC-Z `completed_at`, `vehicle_class`, `distance_m`, `traversal_time_s`, with the existing camera/mode/calibration/mapping/weather/window envelope. Assign the entire completed traversal's distance, duration and factor-derived grams once to the minute containing exit/completion time. Calculate speed-bin factors **per traversal before summing grams**; a row-average speed is insufficient for nonlinear factors.

General observed stopped intervals belong to observation minutes: split intervals exactly at boundaries and sum vehicle-seconds, which can exceed 60. Separately derive the stopped component of the **completed traversal cohort** for shorter-stop scenarios (`0 ≤ stopped_s ≤ traversal_time_s`). These two populations are not interchangeable. Current `backend/scenario.ts` subtracts minute stopped seconds from completed traversal seconds; feeding road-wide stopped observations into that arithmetic would be a cohort error. Coordination must choose an explicit sidecar or an approved field-semantic extension; do not silently redefine `traffic_minute.stopped_vehicle_seconds`.

For estimated media-anchor corrections, preserve event/traversal IDs, rebin UTC attribution, and use existing higher revisions/retractions before replacements. Reconnect timing state remains independent. Existing empty retractions remove old evidence; they are not supported zero observations.

Current `CameraMetrics` has no physical transform, traversal state or stopped-interval endpoints/cohort linkage. `MinuteAggregator` intentionally leaves completed traversals, traversal duration, distance, stopped seconds and physical coverage null. This document is the producer proposal Senior Engineer can consume; implementation is still pending coordination and real supporting measurements.

## Regulatory mapping boundary

A defensible visual-to-CARB mixture requires a versioned external regional/year fleet or VMT source, explicit visual/regulatory inclusion rules and normalized **VMT-based** weights with uncertainty/scenario bounds. Car includes SUVs, so a proposed LDA/LDT blend cannot be chosen by guessed counts. Broad truck categories require documented alternatives or unavailable output. Fuel-aggregated factors already include their fleet mixture; subtracting observed/assumed EVs again double-counts the adjustment. No numeric regional mixture is activated by this checkpoint.

## Bounded calibration mathematics, without camera approval

`worker/calibration.py` adds standalone pure-Python checks: finite nonsingular 3 × 3 homography validation, image-pixel → caller-defined ground-metre projection with a projective-horizon guard, and measured-distance residuals. `DistanceReference.reference_id` must resolve to independently retained measurement evidence; code cannot certify independence or source quality. No transform is fitted, no real reference invented, no camera registry/config edited, and no runtime producer is enabled by this module.

`check_reference_distances(matrix, references, absolute_tolerance_m=..., relative_tolerance=...)` requires a nonempty reference set, unique evidence IDs, distinct finite image endpoints, positive finite measured distances and explicit finite nonnegative tolerances. Each distance passes the mathematical check only when `absolute_error_m ≤ absolute_tolerance_m + relative_tolerance × measured_distance_m`. No numeric physical-acceptance tolerance is supplied by default. Nonsingularity is not good conditioning; arithmetic results do not establish road-plane validity, appropriate reference layout, image resolution/ROI support, viewpoint stability or measurement accuracy. Callers must enforce those separate evidence gates and reject unsupported/horizon regions.

Verification: `python3 -m unittest discover -s tests -p test_calibration.py -v` passed **19 tests** using known synthetic affine/projective matrices, scale changes, invalid/singular/nonfinite data, horizon cases, explicit residual failures, empty references and tolerance boundaries. `/private/tmp/emission-lens-tests/bin/python -m pytest tests/test_metrics.py tests/test_draw_geometry.py tests/test_record_clips.py tests/test_calibration.py -q` passed **58 tests and 47 subtests**. These are mathematical/logic tests, not field validation. The camera-222 proposal separately passes the existing geometry parser while disabled/unvalidated. Its private visual overlay is an aid for review, not a published source image or accepted calibration.

## Next dependencies

- Carter's actual drawings/review notes and the selected-gate manual/runtime comparison. A bounded local camera-222 clip with provenance is now available; it has no crossing answer key yet.
- Independently scaled ground references and held-out validation landmarks for camera 222 first.
- Coordination decision on traversal-linked stopped evidence and completion-minute attribution before Senior Engineer wires scenarios.
- Held-out evaluation of the actual runtime model/settings. No retraining, label edits, model promotion, GPU allocation or external communication is part of this checkpoint.
