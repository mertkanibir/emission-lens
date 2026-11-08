# Opt-in runtime measurement delivery

**Owner:** Mert
**Updated:** 8 November 2026, 02:23 America/New_York / 07:23 UTC
**Status:** Independent per-camera runtime/config/publisher wiring and conservative image-queue availability are tested on controlled inputs. Existing 222/223 scientific approvals and bounded execution evidence remain separately scoped; this implementation does not activate a new configuration.

**Background sender checkpoint (8 November 2026, 03:27 America/New_York / 08:27 UTC):** Mert added a separately tested background-delivery helper. One thread drains existing bounded disk outboxes; notifications coalesce without retaining payloads in memory. Core observations drain before dependent measurements, each request leases only committed immutable bytes, transient failures retry, fatal failures retain queues and expose only an error type, and shutdown has an explicit grace bound. Five controlled helper tests and nineteen publisher/portability tests pass. Runtime integration and measured before/after performance remain pending; no active worker, configuration or scientific contract changes at this checkpoint.

**Runtime delivery checkpoint (8 November 2026, 03:30 America/New_York / 08:30 UTC):** Mert connected the tested sender to the runtime. Processing performs durable enqueue and measurement checkpoint publication, then signals one background sender. Core observation FIFO precedes dependent measurement delivery; incomplete measurement publications remain blocked. The loop surfaces fatal delivery failures, drains for at most 30 seconds on shutdown, retains pending bytes and keeps required-delivery failures explicit. Reports expose sender status and wall time. A controlled full-runtime test processes another frame while the first core HTTP request is held, then verifies drained core/measurement queues and a stopped sender. Forty-two measurement/runtime, eleven runtime utility and five sender tests pass. This is scheduling evidence, not a GPU throughput or field accuracy claim. No running worker or scientific settings changed.

**Concurrent dependency checkpoint (8 November 2026, 03:31 America/New_York / 08:31 UTC):** Mert closed the producer/core-empty scheduling race before runtime replacement. Each delivery pass freezes immutable measurement FIFO watermarks before draining/checking core observations, so measurements newly committed after that check wait for the next pass. No producer lock spans HTTP. A regression forces the empty check, publishes new core and dependent measurement bytes at that exact boundary, verifies no measurement delivery in that pass, then verifies core-before-measurement order on the next pass. Six sender, nineteen publisher/portability and forty-two measurement/runtime tests pass; Python 3.9 compatibility is preserved. No live worker changed.

The runtime connects `worker.traversal.TraversalProducer` through the [versioned bridge](./MEASUREMENTS.md) to [measurement ingestion v1.0](../backend/MEASUREMENT-INGESTION.md). It does not change detector/tracker selection, legacy worker contract 1.1, or the reviewed camera files. The default is disabled.

## Private configuration

Omit `--traversal-config`, or supply exactly:

```json
{"bridge_version":"1.0","enabled":false}
```

For an enabled private file, all fields below are required. This is a **pending structural example**, not accepted geometry or a physical calibration. Gate IDs must already exist in the explicitly reviewed/enabled `--measurement-config`; `view_version` must equal that file's version. Set movement acceptance, physical context and evidence only after review. Server registry approval remains separate even if this private producer context is accepted.

```json
{
  "bridge_version": "1.0",
  "enabled": true,
  "camera_id": "222",
  "context_version": "reviewed-context-version",
  "view_version": "reviewed-image-version",
  "calibration_version": null,
  "mapping_version": null,
  "meteorology": {"temperature_f":70,"relative_humidity_pct":60},
  "policy": {"max_gap_s":1,"max_traversal_s":300,"hysteresis":0.01,"min_track_hits":3},
  "stop_observation": null,
  "movements": [{
    "movement_id":"reviewed-entry-to-exit",
    "version":"movement-version",
    "entry_gate_id":"entry",
    "exit_gate_id":"exit",
    "entry_direction":"positive",
    "exit_direction":"positive",
    "accepted":false,
    "calibration_version":null,
    "calibration_status":"missing",
    "calibration_evidence":null,
    "distance_m":null,
    "distance_source":null
  }]
}
```

A movement requires distinct non-touching existing gates with explicit compatible directions, accepted version/view, documented physical calibration and fixed directed-path distance to produce completed events. Missing context yields unavailable producer reasons. Local distance/status is used only to qualify producer evidence; neither enters the HTTP envelope as physical authority. The server resolves its own approved movement distance and mapping from the supplied versions. Unknown labels and missing per-vehicle stopped evidence remain unavailable.

`stop_observation:null` keeps linked stopped seconds null; baseline estimates may still be supported by independent calibration/mapping, while positive shorter-stop scenarios remain unavailable. An explicitly reviewed image-motion policy is exactly:

```json
{"method_version":"reviewed-image-interval-policy-version","image_displacement_per_s":0.001,"review_evidence_refs":["private-reviewed-policy-reference"]}
```

That numeric value is a shape example, not a recommended camera threshold. The runtime classifies each observed bottom-centre displacement interval by normalized image displacement per media second, then the producer clips those intervals to that vehicle's entry/exit bounds. Lost/reappearing tracks, duplicate identities, gaps, context changes and reconnects follow the conservative producer policy. General road-wide minute stopped seconds are never substituted. Video establishes stopped time, not engine operation.

## Start after reviewed inputs are installed

Use the existing private worker URL/token environment. The server separately needs a durable absolute `EMISSION_LENS_STORE_PATH` and a private reviewed `EMISSION_LENS_REGISTRY_PATH`; no approval file is bundled or installed by these examples.

```bash
python -m worker.main --camera 222 --require-cuda --device 0 \
  --measurement-config /private/path/reviewed-image.json --count-gate-id reviewed-count-gate \
  --traversal-config /private/path/reviewed-traversals.json \
  --require-delivery --seconds 120 --outbox runs/worker-outbox \
  --output runs/measurement-runtime-check.json
```

This command retains the existing detector defaults. Use the separately reviewed model/sampling settings for actual count acceptance; these examples do not select/promote a model or prove crossing accuracy. For replay, add the existing `--replay-file` option; the same pipeline emits only replay mode. Its clock is playback-anchored estimated media UTC, not original capture UTC.

### Independent camera configurations

**Multi-camera checkpoint (8 November 2026, 01:35 America/New_York / 06:35 UTC):** Repeat `--measurement-config` and `--traversal-config`; files match by their own `camera_id`, independent of argument order. Select a gate separately as `--count-gate-id CAMERA=GATE`. A bare gate retains its original meaning when exactly one image configuration is supplied; ambiguous or duplicate camera/gate/configuration inputs are rejected. A traversal file requires the matching enabled/reviewed image file and its unchanged view version. Only explicitly supplied reviewed/enabled files produce counts. Unconfigured or disabled cameras may deliver genuine previews/status without inventing metric zeros.

```bash
python -m worker.main --require-cuda --device 0 --fps 15 \
  --measurement-config /private/path/222-image.json --count-gate-id 222=count-1 \
  --measurement-config /private/path/223-image.json --count-gate-id 223=count-1 \
  --traversal-config /private/path/222-traversals.json \
  --traversal-config /private/path/223-traversals.json \
  --require-delivery --seconds 120 --outbox runs/fresh-multicamera-outbox \
  --output runs/multicamera-runtime-check.json
```

Each camera has independent metrics, selected-gate aggregation, traversal/stopped histories, clocks, observation references and measurement outbox/checkpoint. A reconnect resets only that camera's unfinished identities and stop qualification. Legacy observations for both cameras share the ordered core outbox; each measurement bridge receives only its own camera's observation revisions. Measurement flush still waits for core observations to drain. The original single-image-config CLI retains its `measurements/` path and flat diagnostics, augmented with `by_camera`. Multiple image configurations use `measurements/<camera_id>/`. Switching layouts or omitting a camera with retained checkpoint/retry evidence fails before new delivery; use a fresh outbox or explicitly drain/review the old one.

Reports retain full raw-file SHA-256, canonical JSON SHA-256, selected-gate-object SHA-256 and traversal-config hashes for each camera. The multi-camera run's bounded pipeline field fingerprints the complete sorted per-camera manifest. The selected-gate-object digest is a gate coordinate/direction identity, distinct from the review package's broader semantic geometry/comparison fingerprint; original review hashes remain authoritative for review comparisons. No count gate, distance, calibration, stop method or sampling setting is changed by matching several cameras.

### Image queue observations

An enabled reviewed image file must explicitly supply `queue_region`, `stopped_threshold_per_s` and `stopped_min_duration_s` to support an image-region stationary-vehicle count. The traversal file's `stop_observation` does not enable an image queue implicitly. Queue observations remain on one class row in the existing 1.1 batch, and measurement composition retains the corresponding observation reference. `queue_length_m`, general minute stopped seconds and unsupported physical fields stay null. No engine-running or separate idle-process inference is introduced.

Queue availability requires an advancing continuous qualification interval, including when the region appears empty. A repeated frame, source gap, reconnect warmup, invalid detection or current unqualified track yields null. When unresolved historical track loss is the only remaining blocker, currently visible qualified stationary tracks may supply a positive **lower bound**, displayed as “at least N visible stopped vehicles”; unobserved or occluded vehicles are not counted. A zero candidate remains null while any missing identity is unresolved. Missing identities persist after short motion history expires; re-observation outside the region resolves their absence, while re-observation inside requires renewed qualification. No timeout or session reset is used to manufacture a zero. This is a visible-approach observation, not a complete physical queue inventory or queue length. Detector silence alone cannot establish full scene visibility or scientific queue accuracy.

**Visible lower-bound checkpoint (8 November 2026, 02:04 America/New_York / 07:04 UTC):** Mert accepted this explicit observation definition in Plan.md/Coordination.md before implementation. The existing 1.1 numeric shape is unchanged. Positive counts include only current valid in-region tracks meeting the unchanged image-motion, minimum-hit and three-second stopped qualification. Historical missing identities are retained; current-frame blockers still withhold the result, and incomplete visibility never supports numeric zero. This worker change does not activate a camera or alter a running job; backend metadata, dashboard wording and configured runtime acceptance are coordinated separately.

Mert prepared an ignored, disabled/unvalidated camera-222 candidate and labeled overlay from the already-reviewed `[60,180)` practice sequence. Its initial polygon is bounded by existing count-3/count-1 endpoints, preserving all count/calibration gates and the image view identity, with the exact existing 0.0225 normalized-displacement policy and an explicit 3-second qualification proposal. It describes only stationary occupancy between those gates; upstream approach queues are outside that polygon. Visual approval and any additional image-region scope remain separate activation decisions. The traversal threshold's portability to a broader queue ROI and field queue accuracy are unvalidated. No public camera file, registry, 220/228 approval or live process is changed.

**Queue-review follow-up (8 November 2026, 01:38 America/New_York / 06:38 UTC):** Mert rejected the interior polygon for queue use. The replacement private visible-approach candidate is immediately upstream of count-1, with normalized vertices `[[0.5,0.195],[0.815,0.22],[0.807,0.347],[0.39,0.2811]]`. Validation confirms every vertex lies inside the reviewed road/outside exclusions, polygon edges cross none of those boundaries, every vertex is strictly upstream of count-1 and minimum depth 0.195 stays within the fitted depth band's 0.185 lower bound. All existing gates, road/exclusions, view 222-image-v4 and private traversal configuration remain unchanged. The exact 0.0225/3-second proposal has no field queue-accuracy or threshold-portability approval. The labeled existing-practice overlay and disabled/unvalidated file await visual review; this is visible approach occupancy, never whole-intersection or physical queue length. Repeated configuration loading also now preserves strict boolean validation: numeric zero cannot masquerade as the disabled default. All 14 runtime adapter tests pass after this follow-up.

**Operational ROI review (8 November 2026, 02:05 America/New_York / 07:05 UTC):** Mert visually approved the separate 222 and 223 approach overlays for bounded, explicitly provisional visible-approach stationary-vehicle observations. Private enabled copies and separate approval/hash/method records preserve every existing road/exclusion/gate structure, image view and calibrated traversal identity. The 223 proposal uses `[[0.22,0.245],[0.45,0.20],[0.60,0.22],[0.53,0.37],[0.14,0.275]]`, exact 0.0283 displacement per source second and 3-second continuous qualification. Its polygon is upstream of count-1, inside reviewed road/outside exclusions, with no boundary crossings; minimum depth 0.20 exceeds the fitted band's 0.1861 lower bound. This approval concerns operational image-region scope only: threshold portability, occlusion, detector identity loss and field stopped/queue accuracy remain limitations. Interior polygons remain rejected for queue use. No 220/228 quantity approval follows.

### Actual bounded stopped-policy replay

**GPU delivery checkpoint (8 November 2026, 02:05 America/New_York / 07:05 UTC):** The scheduler's supported overlap mechanism ran sequential 222/223 replays as step `176075.2` inside the existing single-camera allocation. Step execution was 01:53:00–02:03:11 America/New_York / 06:53:00–07:03:11 UTC, completed `0:0` in 10m11s. Both original allocations, 176075 and 176255, remain running; no third GPU slice or cancellation was used. Separate fresh worker/measurement outboxes delivered only to isolated 3151, leaving 3138/3139/3150 and their relays untouched.

| Camera | Original reviewed source interval | Actual processed source times | Frames | Selected count-1 crossings | Completed candidates | Reader-buffer drops | Final worker / measurement pending |
|---|---|---|---:|---:|---:|---:|---|
| 222 | `[60,180)` | 60.061–179.982 s | 1,712 | 45 | 24 | 0 | 0 / 0 |
| 223 | `[60,180)` | 60.061–179.984 s | 1,798 | 128 (126 car, 1 bus, 1 truck) | 55 | 0 | 0 / 0 |

Both report actual CUDA, requested 15 FPS, 640 pixels, unchanged pretrained weights and `failure:null`. Each worker had a 300-second wall limit followed by approximately 1.45 seconds of graceful cleanup; 300 wall seconds are not 300 source seconds. The exact native-file practice adapter preserves original decoder media timestamps and excludes inference outside the reviewed interval. The 222 run used the approved provisional approach ROI and exact Carter 0.0225 traversal stop policy; the already-frozen 223 run retained its base image geometry and exact 0.0283 stop policy. The separately approved 223 queue ROI was prepared after launch and was not substituted into the checked recipe. No duplicate replay or threshold change was used to obtain a number.

The immutable executed archive is revision `692d739bd0083e27bcc501008bdb409a218e5903`; both actual main-file hashes are `db55400ffc63ee5a01fc4f8cb7c83feb5cea26e8496e93cb581e711e7bf356c4`, matching the frozen 3151 source. The legacy report `git_commit` field resolves the containing remote checkout `b1a5edf188d06c1af7fc1a29cffd4f24e80734f8`, not the unpacked artifact revision. Separate source/configuration/policy/runtime-report hashes and actual run IDs are retained in private execution receipts, preserving this distinction.

The protected live stream was checked 118 times while the replays ran: maximum observed heartbeat age 15.244 seconds, advancing preview sequences, at most one pending delivery file, final pending zero and at least 9,435.8 MiB free MIG memory. No guard fired; each guard could terminate only its own replay child. Scheduler cleanup removed the copied credential and left zero queued envelopes. This establishes bounded concurrent execution and delivery, not sustained operation, independent count/traversal/stopped accuracy or loss-free coverage outside these intervals. Original-CARB/scenario/current-HTTP/reload acceptance is owned by the separate backend check and is not inferred from job completion. The later proposed queue lower-bound refinement and a combined four-camera LIVE build remain separate, unexecuted work at this checkpoint.

`EMISSION_LENS_MEASUREMENT_URL` optionally sets the measurement endpoint. Otherwise `/api/worker` derives sibling `/api/measurements` on the same origin, dropping URL query values. A custom worker path requires an explicit measurement URL. Both routes use the existing private bearer token; HTTPS/loopback and redirect rules are unchanged. Legacy observation batches are delivered before dependent measurement batches. Physical approval and live/replay/synthetic separation remain server checks.

## Durable queue and restart

The main worker outbox remains at `--outbox`. Measurement envelopes use its separate `measurements/` subdirectory for one image configuration, or `measurements/<camera_id>/` for several. `bridge.checkpoint` is private JSON continuity state with a non-`.json` filename so it cannot be mistaken for a queued HTTP envelope. No token, frame, plate/person data or raw tracker ID is retained there. The pipeline-version marker includes a prefix of the private traversal-config hash or the multi-camera manifest hash.

For each plan: persist pending checkpoint → enqueue all ordered envelopes → commit/persist checkpoint → permit HTTP flush. Retractions precede replacement minutes after clock rebins. Source-clock improvements recompute the original completion membership, and legacy observation references update/remove with their actual revisions. A legacy retraction followed by replacement of the same minute becomes one final reference update.

Startup restores and finishes a retained pending plan before flushing its outbox. Partial capacity, missing/corrupt checkpoints or undelivered earlier measurements fail closed and preserve recovery data. A new runtime does not reopen old tracker identities or silently combine overlapping runs. Drain/review prior delivery before starting another run; the server rejects cross-run camera-minute overlap. Do not delete an outbox to make an error disappear.

On POSIX, checkpoint writes and outbox enqueue/acknowledgement directory entries are fsynced. Windows uses closed-file, file-flushed write-through publication and acknowledged retirement; see [queue portability and platform limits](./QUEUE-PORTABILITY.md). Each bridge retains at most 10,000 completed events, 10,000 clock mappings and 240 minute revision keys. The transport's 32-session bound applies per minute envelope, rather than to all lifetime sessions; 34 independent sessions in separate minutes now pass, while a 33-session cohort in one minute still rejects without discarding its new event or checkpoint state. Each producer outbox retains at most 256 envelopes / 8 MB. Capacity is explicit failure, not silent eviction. Rotate/review bounded runs before those limits. Current server evidence retention is a separate 24-hour/32 MiB local policy.

Acknowledged events/minutes are intentionally not pruned during an active run: the existing session-minimum clock can improve later and legitimately rebin original cohorts, requiring the complete old snapshot for retraction/revision. Unacknowledged retries and pending plans also remain intact. No timing freeze, cross-run footage merge or untested rolling-history promise is introduced. Longer than 240-minute operation and high-volume event exhaustion remain unsupported by this bounded implementation.

## Verification and remaining acceptance

Focused tests cover opt-in configuration, exact v1 serialization without worker physical assertions or raw tracker IDs, linked stops, clock-rebin ordering, observation reference replacement, lost tracks/reconnects, partial-plan restart recovery, denied corrupt checkpoint delivery and unchanged queued-byte retries. A simulated-frame test exercises actual `worker.main` orchestration through both senders and final delivery checks without loading a detector/GPU. Backend tests verify that accepted fixture envelopes survive durable reload and drive explicitly labeled pollutant scenarios and briefs. See [integration readiness](../evaluation/integration-readiness.md).

These controlled tests are software integration evidence. Real camera calibration/class mixture review, held-out crossing acceptance and the configured GPU/replay/outage demonstration remain required. No live camera or scientific configuration is activated by this checkpoint.

**Multi-camera/queue verification (8 November 2026, 01:35 America/New_York / 06:35 UTC):** The retained local application environment passes 180 focused delivery, portability, runtime, aggregation, timing, traversal, measurement, metrics and calibration tests. New actual-main controlled-frame coverage processes all four camera sources while independently publishing 222/223 crossings, completions, queue values and matching observation references; 220/228 receive no invented measurement rows. A 222-only reconnect leaves 223 state intact. Other new checks cover argument matching/rejection, retained-layout refusal, queue warmup, expiry/occlusion/null retention and per-envelope clock limits. These checks stub detector/GPU/network delivery; they establish orchestration behavior, not new live execution or accuracy. Python compilation, `--help` and scoped whitespace checks pass. System Python initially lacked PyYAML for the main-test setup; using the retained environment resolved this without dependency changes.

**Final verification (7 November 2026, 21:04 America/New_York / 8 November 2026, 02:04 UTC):** 172 focused Python tests plus 112 subtests pass with the pinned worker dependencies in an isolated Python 3.12 environment. This covers `test_measurement_runtime.py`, `test_runtime.py`, `test_publish.py`, `test_aggregate.py`, `test_timing.py`, `test_traversal.py`, `test_measurement.py`, `test_metrics.py`, `test_calibration.py` and `test_check_counts.py`. The runtime adapter contributes nine tests. All 99 backend tests (17 measurement integrations), backend/contract type checks, Python syntax/help and scoped whitespace checks pass. Initial missing system-Python inference dependencies and a missing field in the simulated detection fixture were resolved before the passing runs. No production web build is run by this work package.


**Queue portability (7 November 2026, 21:37 America/New_York / 8 November 2026, 02:37 UTC):** Fixed Windows CRT directory-open incompatibility in queue/checkpoint publication while retaining POSIX directory flushes and all file flushes. Windows uses native write-through moves and an acknowledged marker for safe cleanup/restart ordering. All real file/rename/access failures remain errors. macOS focused and broader regression selections pass; native CI results are tracked in [QUEUE-PORTABILITY.md](./QUEUE-PORTABILITY.md). Detector/tracker, camera geometry, contracts and binary provenance hashing are unchanged.

**Native queue acceptance (7 November 2026, 21:40 America/New_York / 8 November 2026, 02:40 UTC):** Published fix `845ce3c` passes [Windows Server 2025 and Linux CI](https://github.com/mertkanibir/emission-lens/actions/runs/42439373791), each with 53 tests plus 15 subtests and no skips. Local macOS checks also pass. [Platform notes](./QUEUE-PORTABILITY.md) record exact Python/runner versions and remaining power-loss/network-share limits. Scientific readiness and the actual configured GPU/replay demonstration are unchanged.


**Accepted LIVE startup (8 November 2026, 02:23 America/New_York / 07:23 UTC):** The new combined685dc72 runtime is genuinely processing only reviewed222/223 on existing-allocation step176075.4 into3151, with both provisionally approved approach ROIs and exact stopped policies. Separate backend/current-browser acceptance passes; the sealed735/60 history is preserved and producer/server overlap refusals remain active. Initial reader drops201/22 stayed unchanged during observed follow-up; no sustained/loss-free/field-accuracy claim is made. The bounded child/step/watcher and untouched original resources are documented in [the runtime handoff](./LIVE-3151-176075-4.md) and its public-safe scalar receipt. The earlier692d739 replays remain separate immutable evidence.
