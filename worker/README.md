# Camera worker

**Owner:** Mert, runtime integration; Carter, detection, tracking and labeling.
**Updated:** 7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC

From the repository root, inside the verified compute-node Python environment:

```bash
python -m worker.main --require-cuda --device 0 --seconds 300 \
  --output "runs/worker-${SLURM_JOB_ID}.json"
```

Omit `--camera` for all enabled cameras, or repeat it to select a subset. The default pretrained model is YOLO11n at 640 pixels, sampled at 5 frames per media second. These settings need held-out evaluation; they are not an accuracy claim. Every camera owns its detector, ByteTrack tracker and class history. Reader reconnects reset tracker state. The runtime uses Carter's existing modules.

The diagnostic JSON records actual inference devices, package versions, weight/script hashes, per-camera processed frames, advancing media spans, reader drops and tracking wall time. Repeated tracked detection observations are diagnostics, never unique crossing counts. No raw imagery or temporary track identifiers are written.

**Tracker note:** Frame updates always request persistence; a new reader session explicitly resets the existing ByteTrack instance and class history. Class evidence is retained only for tracked/lost vehicles that remain recoverable; Tesla confidence uses lifetime count/sum rather than an unbounded frame list. The installed 8.4.206 package already refreshes callback arguments on every call, as documented in the [official tracker source reference](https://docs.ultralytics.com/reference/trackers/track/); the explicit reset avoids depending on that callback-registration behavior. A CPU test uses real callbacks and synthetic detections to check continuity and reset, without downloading model weights.

## Delivery and restart

Set `EMISSION_LENS_INGEST_URL` and `EMISSION_LENS_WORKER_TOKEN` privately in the process environment to enable periodic authenticated publishing. Set both or neither. HTTPS is required except for a loopback tunnel; an explicitly trusted private HTTP relay requires `EMISSION_LENS_ALLOW_HTTP=1`. Endpoint credentials and tokens are never printed or written to the outbox.

Use `--require-delivery` for an integration check: disabled publishing or a remaining final outbox fails the run. A camera that processes no advancing frames also fails, with diagnostics retained. Required CUDA checks the actual tracker backend after inference, not only whether a GPU is installed.

`--outbox` defaults to the ignored `runs/worker-outbox/`. Use a separate directory for each concurrent worker. Batches are atomically persisted before sending, replayed oldest first after restart, and retain their UUID, revision and exact content across retries. Multiple cumulative revisions remain separately queued in order; an earlier revision is never silently replaced. Network failures, 429 and server failures stay queued. Other HTTP rejections stop delivery and retain the batch for inspection. The bounded queue fails closed rather than dropping evidence when full. A hard-killed process relies on dashboard freshness checks; SIGTERM/SIGINT publishes an ended run and offline statuses before bounded reader shutdown.

The worker publishes contract 1.1 run/status envelopes with empty traffic/emissions arrays by default. Capture UTC is unknown, so `last_source_timestamp` and capture-to-processing delay remain null. Heartbeats represent successfully processed advancing frames, not timer ticks; stale receipt or processing progress degrades status. No placeholder traffic minute is inserted when reviewed road regions and gates are missing. There are no invented zeros, stopped times, distances, speeds, or emissions.

## Optional reviewed image measurements

`--measurement-config /private/path/reviewed-camera.json` enables the separate image-measurement path only when its configuration says `enabled: true` and `image_geometry_status: reviewed`. Carter has enabled/reviewed `config/cameras/222.measurement.json` (`222-image-v3`) for the designated `count-1` path only. `count-2` is unaccepted; the 220/223/228 image configurations remain disabled/unvalidated. `config/cameras/measurement.example.json` is a disabled, unvalidated structural example, not usable calibration. Geometry needs review against the actual camera before activation.

**Independent-camera update (8 November 2026, 01:35 America/New_York / 06:35 UTC):** The current reviewed files are 222-image-v4 and 223-image-v2, each with its separately accepted count-1 scope; the older paragraph and count-profile checkpoint describe their original acceptance state. Repeat `--measurement-config` and private `--traversal-config` with explicit `--count-gate-id 222=count-1 --count-gate-id 223=count-1` for independent runtime producers. Existing single-camera commands remain supported. No 220/228 enablement follows. Image queues require an explicitly reviewed queue region and image-motion threshold; the separate traversal stop policy alone leaves queue counts null. New warmup/gap/occlusion handling preserves unavailable values instead of inferring empty queues. See [exact CLI, private ROI review and bounded retention](./RUNTIME-MEASUREMENTS.md). This code checkpoint does not change active jobs or approve a queue region.

**Count-profile reconciliation (7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC):** The documented camera-222 count checks used pretrained YOLO11n/640 at requested **15 FPS**, not the default 5 FPS. To use that count-only profile with the bounded CUDA command above, add `--camera 222 --fps 15 --measurement-config config/cameras/222.measurement.json --count-gate-id count-1`. This does not enable physical traversal measurement or validate other sampling settings. Preserve the [222 audit](../evaluation/calibration/222-count-audit.md) and its unresolved endpoint/direction issues. [Current 223/228 review](../evaluation/video_validation/report.md) does not authorize their activation. The [four-camera benchmark](../evaluation/count-check-175806.md) is bounded performance evidence with drops; [queue portability](./QUEUE-PORTABILITY.md) records native platform checks.

When a configuration has multiple gates, `--count-gate-id` must choose one explicitly; crossing counts are never summed across entry/exit gates. The worker aggregates actual crossing events into **estimated HLS media UTC minutes**, with the model's supported vehicle classes only. A zero requires an advancing observed frame under the enabled reviewed gate. Pretrained weights do not produce supported Tesla/pickup/etc. zeros. The optional image-space queue observation is stored on one class row so it cannot be summed per class. Stopped time, physical distance, traversal time, completed traversals, coverage and emissions remain null in these rows.

Each camera-minute has a stable batch UUID and increasing revisions of the cumulative count snapshot. Revisions replace the prior snapshot rather than adding counts again. The run's pipeline version includes measurement version, selected gate, a hash prefix and `t:hls-min-anchor-v1`; diagnostics retain the full configuration hash and supported class list. The engine suppresses crossings across source gaps and resets temporary identities on reconnect.

The session-local clock uses `anchor = min(received_at - media_time)` and places frames at `anchor + media_time`. Every reconnect starts an independent anchor. When later backlog frames improve an anchor, all earlier scalar observations are rebinned using prefix sums and exact microsecond boundaries. This is an **estimated** source-time alignment: the minimum transport delay, capture UTC and footage coverage remain unknown. Heartbeat and preview receipt timestamps retain their original meaning.

If counts move out of a published minute, higher revisions retract its prior batch before filling corrected minutes. A fully emptied minute has no rows; it does not become an unsupported zero or a null row that would spoil window totals. Retractions and replacements remain FIFO in the disk outbox, including after a wall-clock step backwards and restart. Historical stored receipt-time records are not rewritten without source evidence. The read path labels new estimated-media windows and warns about mixed timing bases.

A new worker run overlapping another run's camera-minute is rejected by persistence instead of silently overwriting or merging observations. Its outbox is retained for review. Resolve overlapping source windows explicitly; starting at a new receipt-minute boundary alone cannot guarantee disjoint source footage when HLS opens with backlog. Reconnects may also re-deliver earlier footage: this clock does not establish source-frame deduplication or validated coverage.

## Optional synchronized previews

`--preview-every 3` enables a transient annotated JPEG for each camera every three seconds. The default is disabled. Each JPEG uses the exact processed frame and its matching boxes, with an explicit LIVE/REPLAY, camera/session and receipt-time banner. Previews are downscaled to at most 960 pixels wide at quality 65, kept only in memory, and posted to `/api/frames` with the same private token. For custom ingest paths, set `EMISSION_LENS_PREVIEW_URL` explicitly.

Preview HTTP runs on a separate thread with a one-second request timeout and at most one pending JPEG per camera; a newer preview replaces an unsent older one. Delivery failures only increment diagnostics and never enter the disk outbox or stop tracking. The frame receiver applies its own retention/freshness limits. No overlay is drawn over a separate, unrelated HLS playback. Temporary track IDs appear only in their current camera/session's preview, not in persistent aggregate records.

Submit the provided bounded batch job with `sbatch infra/worker.slurm`. Credentials must remain outside version control. The script uses Mert's verified `rpicourse` / `normal` allocation and reads the existing `~/emission-lens-py312` environment.

## Labeled replay

```bash
python -m worker.main --camera 222 --replay-file /private/path/clip.mp4 \
  --device cpu --seconds 60 --output runs/replay-check.json
```

Replay uses the same reader sampler, buffer and tracker, with a paced local input and no automatic looping. It is published only in `replay` mode, separate from live records. Retain source attribution and capture context alongside private demo media; do not commit footage. Diagnostics record receipt timestamps, and optional aggregates use the playback-anchored estimated media clock. Neither establishes the clip's original capture UTC; historical factor/weather attribution still needs original capture context.

## Checks and limits

`python3 -m unittest discover -s tests -p test_publish.py -v` and the corresponding `test_runtime.py` and `test_aggregate.py` commands exercise real local HTTP response handling, immutable revision retries, bounded queues, camera separation, stale processing, mode labels, supported zero/null metrics, selected gates, UTC-minute boundaries and cumulative snapshot revisions without a model download. The complete worker suite uses the pinned `worker/requirements.txt` in the verified Python environment.

Delivery and tracking do not validate calibration, vehicle-count accuracy, stopped time, fuel type, CARB class mixtures or emissions. GPU benchmark results belong in `evaluation/`, with job IDs and explicit limitations.

**Timing verification (7 November 2026, 18:49 America/New_York / 23:49 UTC):** Mert reproduced a 25.060645-second session-anchor improvement across 204 advancing live camera-222 frames with zero reader drops. This was a timing-only check, not a detector/vehicle-count or capture-latency measurement. Controlled tests cover 30-second startup backlog, minute boundaries, rebins after publication, queue ordering, reconnect isolation and retraction persistence. See [timing evidence](../evaluation/timing-alignment.md). No core contract fields changed.


**Runtime measurement checkpoint (7 November 2026, 21:04 America/New_York / 8 November 2026, 02:04 UTC):** Added default-disabled `--traversal-config` integration using the isolated traversal producer and versioned measurement bridge. The runtime validates private movement/view/stop context, uses session-minimum media clocks, keeps per-vehicle stopped evidence distinct, and publishes measurement v1.0 through a separate durable outbox/endpoint. A pending checkpoint is persisted before enqueuing and committed before flushing; restart recovery finishes retained plans first. Actual `worker.main` orchestration and forced partial enqueue/restart are tested with controlled frames. No detector/tracker/camera setting or scientific approval is changed. See [exact private setup and remaining acceptance](./RUNTIME-MEASUREMENTS.md). Legacy image rows keep unsupported physical columns null; server composition owns supported completed-cohort quantities and estimated emissions.
