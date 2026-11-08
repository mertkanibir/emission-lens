# Camera 220 queued blind-review plan

**Owner:** Mert. **Updated:** 8 November 2026, 00:12 America/New_York / 8 November 2026, 05:12 UTC.
**Status:** Queued; acquisition, rendering, review and model execution have not started under this plan.

Mert queued Carter's camera-220 recording/metadata handoff received on 7 November 2026 at 23:54 America/New_York (8 November 2026, 04:54 UTC). Carter's model count was withheld from this review. Media locators remain with Mert's coordinator; this plan contains no answer key or private download capability.

## Priority and release

Wait behind the current camera-222 live restart and camera-228 new-gate alignment. Mert must coordinate the concrete media/model handoff before this queue item starts. Queueing this plan authorizes no large video download, render, GPU job, geometry change or camera acceptance. Camera-228 `[720,840)` remains reserved and outside this scope.

## Fixed review protocol

1. After release, acquire the recording and companion metadata once into ignored `data/raw/clips/220/`. Record their file SHA256 values, source PTS origin/end, duration, cadence, frame count and gaps. Reuse a hash-identical local recording. Report unavailable/short footage explicitly; do not silently move the declared windows.
2. Inspect only practice `[60,180)` first, using chronological original frames without detector boxes, model events/counts, Carter's reference or acceptance records. Timestamp and gate overlays are permitted. Apply the package's finite-gate bottom-center crossing/direction convention. Preserve endpoint/occlusion uncertainty.
3. Select the designated gate from practice only. Freeze the exact geometry, raw/canonical/selected-semantic hashes, counting rule and metric settings before opening held-out `[360,480)`. Gate ID/coordinates and actual hashes remain pending; this plan does not select or edit them. Any later geometry change requires separate review identity and reference alignment.
4. Inspect the complete ordered selected-frame held-out sequence, with adjacent original/native-cadence frames near candidates. Record actual inspected sheets/frames, source gaps, incomplete coverage and uncertain passages. Rendering or sparse stills alone does not establish complete review.
5. Save the assisted event ledger with `review_method=assisted_visual_sequence_review` and `human_confirmed=false`, validate chronology/repeated blocks/strict half-open boundaries, and freeze its SHA before receiving corresponding model or human counts/events. Share the freeze with Mert before results are released. Preserve original freezes; later corrections use separately hashed, explicitly post-reference revisions.
6. Use the original pretrained n/640 baseline at requested 15 FPS, preserving the frozen source/window/geometry and original tracker/metric settings. Model execution belongs to the later coordinated handoff; none is launched by this plan. Record actual input/weight/recipe provenance and achieved source coverage. Requested FPS is not a measured throughput claim.
7. After the blind freeze, compare only matching camera/clip/geometry/gate/window records using the existing same-direction 1.5-second maximum-cardinality/minimum-time-gap policy. Keep candidate-inclusive and ambiguity-excluded results separate. Missing human references stay pending/null; assisted agreement is not human accuracy. Report precision, directional errors and supported duplicate/miss evidence alongside totals. Count-screen results do not automatically enable a camera.

## Ownership and boundaries

Mert owns this evaluation plan, ledger/comparison work and coordination. Carter owns distance calibration. Image crossing review does not approve physical distance, speed, completed-traversal accuracy, class/fuel mixtures or estimated emissions. Keep raw media, source frames, ledgers and detailed comparisons private under the package's ignored paths. No contract, worker, production camera or model-setting change is proposed here.

## Completion and open dependencies

- **Completed:** The queued scope, fixed practice/held-out windows, baseline recipe, blind boundary and ownership are recorded before media/model-reference access.
- **Open:** Mert's release after the current priorities; concrete recording/metadata handoff and hashes; practice gate selection/freeze; actual held-out review and ledger freeze; separately withheld baseline/reference handoff; Carter's independent distance calibration.

No camera-220 count, score, coverage or acceptance is asserted by this queued plan.
