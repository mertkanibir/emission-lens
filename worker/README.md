# Camera worker

**Owner:** Mert, runtime integration; Carter, detection, tracking and labeling.
**Updated:** 7 November 2026, 18:20 America/New_York (23:20 UTC).

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

`--outbox` defaults to the ignored `runs/worker-outbox/`. Use a separate directory for each concurrent worker. Batches are atomically persisted before sending, replayed oldest first after restart, and retain their UUID and exact content across retries. Network failures, 429 and server failures stay queued. Other HTTP rejections stop delivery and retain the batch for inspection. The bounded queue fails closed rather than dropping evidence when full. A hard-killed process relies on dashboard freshness checks; SIGTERM/SIGINT publishes an ended run and offline statuses before bounded reader shutdown.

The worker publishes contract 1.1 run/status envelopes with empty traffic/emissions arrays until metrics are supported. Capture UTC is unknown, so `last_source_timestamp` and capture-to-processing delay remain null. Heartbeats represent successfully processed advancing frames, not timer ticks; stale receipt or processing progress degrades status. No placeholder traffic minute is inserted when road gates and calibration are missing. There are no invented zeros, stopped times, distances, speeds, or emissions.

## Optional synchronized previews

`--preview-every 3` enables a transient annotated JPEG for each camera every three seconds. The default is disabled. Each JPEG uses the exact processed frame and its matching boxes, with an explicit LIVE/REPLAY, camera/session and receipt-time banner. Previews are downscaled to at most 960 pixels wide at quality 65, kept only in memory, and posted to `/api/frames` with the same private token. For custom ingest paths, set `EMISSION_LENS_PREVIEW_URL` explicitly.

Preview HTTP runs on a separate thread with a one-second request timeout and at most one pending JPEG per camera; a newer preview replaces an unsent older one. Delivery failures only increment diagnostics and never enter the disk outbox or stop tracking. The frame receiver applies its own retention/freshness limits. No overlay is drawn over a separate, unrelated HLS playback. Temporary track IDs appear only in their current camera/session's preview, not in persistent aggregate records.

Submit the provided bounded batch job with `sbatch infra/worker.slurm`. Credentials must remain outside version control. The script uses Mert's verified `rpicourse` / `normal` allocation and reads the existing `~/emission-lens-py312` environment.

## Labeled replay

```bash
python -m worker.main --camera 222 --replay-file /private/path/clip.mp4 \
  --device cpu --seconds 60 --output runs/replay-check.json
```

Replay uses the same reader sampler, buffer and tracker, with a paced local input and no automatic looping. It is published only in `replay` mode, separate from live records. Retain source attribution and capture context alongside private demo media; do not commit footage. Diagnostics record receipt timestamps rather than the clip's original capture UTC.

## Checks and limits

`python3 -m unittest discover -s tests -p test_publish.py -v` and the corresponding `test_runtime.py` command exercise real local HTTP response handling, restart retries, bounded queues, camera separation, stale processing, mode labels and null metrics without a model download. The complete worker suite uses the pinned `worker/requirements.txt` in the verified Python environment.

Delivery and tracking do not validate calibration, vehicle-count accuracy, stopped time, fuel type, CARB class mixtures or emissions. GPU benchmark results belong in `evaluation/`, with job IDs and explicit limitations.
