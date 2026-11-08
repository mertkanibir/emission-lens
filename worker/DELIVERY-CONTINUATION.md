# Prepared delivery continuation

**Owner:** Mert
**Updated:** 8 November 2026, 03:36 America/New_York / 08:36 UTC
**Status:** Prepared for review. No replacement GPU step has started.

The [controlled scheduling evidence](../evaluation/delivery-scheduling.md) supports removing HTTP waits from processing. It does not establish actual replacement GPU throughput or sustained field accuracy. Source `3b15e3a8c644a0f6d60b1b6f0ed9f18775ae86a9` freezes the tested runtime, including background delivery, durable publication gates and per-pass dependency watermarks. The prepared runtime archive SHA-256 is `a2942a75870b1066ead1b2341ed96260118ee1b21f70ba72917ffed814e1b9a5`; executed `worker/main.py` is `23478816d36cc87c72388cf8f9a1088646f79c45221f3ba295cd6609a6e5dc47`.

The ignored preparation directory is `runs/live-3151-continuation/20261108T083500Z`. It contains frozen source, archive, copied unchanged 222/223 profile JSONs, per-file hashes, guarded launcher, owned step script and a recipe marked `ROOT_REVIEW_REQUIRED_DO_NOT_LAUNCH`. It intentionally contains no worker credential or post-terminal overlap baseline. Mert must release the recipe only after reviewing those inputs.

The continuation must satisfy these conditions before starting:

1. Old step 176075.4 is absent from scheduler active steps, has a successful terminal receipt with zero core/measurement pending bodies, and has removed its copied credential. Existing healthy original jobs and applications remain protected.
2. Freshly inventory retained canonical LIVE camera-minutes after that terminal verification. Set the new minimum quantity minute strictly later than the maximum retained 222/223 minute; if the old final minute is 04:17 New York, the earliest allowed new quantity minute is 04:18. The new guard rejects every earlier quantity and every retained overlap, including completed traversals rebinned earlier than their receipt. Status-only envelopes remain allowed. The server overlap refusal remains active.
3. Use fresh remote directory/outboxes, identical pretrained n/640, requested 15 FPS, exact copied geometry/traversal/queue profiles and weight hash. Keep 220/228 excluded from quantities. No factor, calibration, mapping, model promotion or approval expansion is authorized by this replacement.
4. Use the separately owned login reverse forward 53253 to application 3151 and compute local forward 43653. The old 53251 forward belongs to watcher 67946, which can close it until 04:21:25; do not reuse or cancel it. Preserve the original authenticated SSH master.
5. End the command by 06:06 New York / 11:06 UTC, the scheduler step by 06:10 / 11:10, inside allocation 176075 ending 06:12:38 / 11:12:38. The launcher calculates its remaining bounded duration at start. Keep the original protected-live heartbeat, preview, backlog and MIG-memory guards. Cleanup affects only this child/step, new relay and copied credential.

The inherited six retained-minute guard checks, additional minimum-minute rejection/allowance checks and Python/shell syntax checks pass on this prepared package. The new reverse-forward preparation succeeded without changing old forwards. No private camera imagery, reserved segment or new inference/training job was used. Actual CUDA execution, new deliveries, final drained queues, original-stream health and UI progression require independent observation after a reviewed launch.
