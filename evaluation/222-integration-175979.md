# Camera 222: isolated GPU-to-persisted-estimate integration

**Owner:** Mert
**Updated:** 7 November 2026, 23:03 America/New_York / 8 November 2026, 04:03 UTC
**Status:** Bounded replay/live delivery check passed. This is not field validation, sustained-performance acceptance or a completed demo rehearsal.

Mert demonstrated **GPU inference → authenticated backend ingestion → persisted conditional estimated CO₂/NOₓ → matching private evidence**, using Carter's unchanged approved camera-222 profile. Replay passed its prerequisites before a separate short live run began. The original application and production defaults were untouched; all results belong to the isolated review application and their explicit modes.

Job **175979** completed **0:0 in 2m55s** on one H100 MIG `1g.10gb` slice under a five-minute cap. All **20 runtime/measurement-runtime tests passed**. The [scalar record](./222-integration-175979.json) binds the recipe, source archive, actual runtime, inputs, reports and acceptance artifacts by SHA-256.

## Demonstrated result

| Check | Paced replay | Bounded live |
|---|---:|---:|
| Requested wall duration | 90 s | 60 s |
| Processed frames | 1,201 | 1,094 |
| Processed source-media span | 80.258 s | 90.791 s |
| Count-1 crossings | 30 | 17 |
| Completed / persisted traversals | 8 / 8 | 4 / 4 |
| Legacy / measurement batches delivered | 34 / 18 | 18 / 9 |
| Pending batches after delivery | 0 | 0 |
| Annotated previews sent / failures | 27 / 0 | 7 / 0 |
| Actual inference device | `cuda:0` | `cuda:0` |

The live source-media span includes HLS startup backlog and is not 90.791 seconds of newly captured live coverage. Its reader kept 1,360 frames, processed 1,094 and dropped 265 buffered frames; the traversal producer recorded one excessive-source-gap issue. These diagnostics prevent a claim of loss-free coverage or sustained throughput. Counts and completed traversals here are pipeline outputs, not manually adjudicated accuracy.

The server retained one supported completed-cohort minute and one empty-cohort minute in each mode:

| Estimated emissions: supported `ok` minute rows only | Replay | Live |
|---|---:|---:|
| CO₂ | 35.741459 g | 17.345262 g |
| NOₓ | 0.006533736 g | 0.003161844 g |

**These sums exclude unavailable minute rows.** The other minute in each mode has an empty cohort and unavailable emissions, so these values are not complete-window or all-traffic totals. Full-window scenario baseline values remain null. Linked stopped time is null, and the tested 20% shorter-stop scenario remains unavailable with null scenario/change values; no zero or savings claim is substituted.

## Profile, source and evidence

Both runs used pretrained YOLO11n/640, requested 15 FPS, the explicit reviewed `count-1` gate and required actual CUDA/delivery. Carter's server registry approval is dated **8 November 2026, 03:19:55 UTC**; the calibration is `222-ground-esri-v1-7f52d53d8fc8`, movement `222-eastbound-through` at fixed **20 m**, and mapping `pretrained-visual-to-emfac2007-v1`. The fleet mixture, **70 °F / 60% relative humidity**, and fixed movement distance are modeling assumptions. Independent scale checks, manual traversal completion checks and whether curved turns satisfy this movement remain unresolved. These conditional RUNEX estimates do not independently validate those assumptions or establish measured air quality.

Replay used the later measurement-review recording **222_20261108T003312Z.ts**, SHA-256 `e6db50f024cd61dc13140f24d60dbaa2070d962fda1bde6f2da52f10475401d3`. It is a different clip from the earlier camera-222 count-check recording and does not inherit that recording's count acceptance.

The actual source was archived from **`7d455137082c2a8457ab84c1225942f58380bae2`**; archive SHA-256 `969e977daff6c5bd6a705d7b1fe742ba4c2c44700ae889ee697da4a633f69457`, executed `worker.main` SHA-256 `20ec7e4eaabf7972260ac5be2b5b0ec4953963138f27bdfaf795a729e9e71713`. The runtime reports `b1a5edf…` in its Git field because it ran beneath that ancestor checkout; that field does not identify the copied archive's source revision. The archive and executed-file hashes provide the actual provenance.

Private evidence returned **401 without authorization and 200 with authorization**. Its current run, camera, mode, movement, calibration, mapping and null stopped values matched the persisted records. Replay produced no live contamination; its minutes, registry and evidence stayed unchanged after live processing. Two preserved public live heartbeats advanced during the run. Raw evidence payloads, per-vehicle times/identifiers, media and credentials remain private.

The authorized command profile was:

```sh
python -m worker.main --camera 222 --weights weights/yolo11n.pt \
  --device 0 --require-cuda --image-size 640 --fps 15 \
  --measurement-config "$EL_222_PROFILE/geometry.json" --count-gate-id count-1 \
  --traversal-config "$EL_222_PROFILE/traversals.json" \
  --replay-file "$EL_222_PROFILE/clip-222.ts" --seconds 90 --preview-every 3 \
  --outbox "$EL_222_RUN/outbox-replay" --output "$EL_222_RUN/replay.json" \
  --require-delivery
```

The subsequent authorized live command omitted `--replay-file`, used `--seconds 60` and separate `outbox-live`/`live.json` paths. Private environment settings and the loopback-only two-hop SSH relay supplied delivery; no credentials were command arguments or committed. This records the completed check and does not authorize another run.

## Shutdown and remaining acceptance

The allocation and both relay hops were released, the remote token copy was removed, and final public replay/live states and displayed states were **offline**, with both runs ended and the scheduler queue empty. No continuous worker remains. The original SSH master and the separate engineering-owned review application were retained for inspection.

No worker, backend, frontend, camera setting, public contract or default was changed by this run. Remaining work includes independent scale/movement/traversal validation, manual count/tracking acceptance, longer operation and forced-outage/restart checks, full labeled-replay/demo rehearsal and any required hosted persistence. No additional GPU job is authorized by this checkpoint.
