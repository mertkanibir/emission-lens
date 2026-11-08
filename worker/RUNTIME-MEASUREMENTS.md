# Opt-in runtime measurement delivery

**Owner:** Mert
**Updated:** 7 November 2026, 21:04 America/New_York / 8 November 2026, 02:04 UTC
**Status:** Runtime/config/publisher wiring implemented and tested on controlled inputs. Real approvals remain absent.

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

`EMISSION_LENS_MEASUREMENT_URL` optionally sets the measurement endpoint. Otherwise `/api/worker` derives sibling `/api/measurements` on the same origin, dropping URL query values. A custom worker path requires an explicit measurement URL. Both routes use the existing private bearer token; HTTPS/loopback and redirect rules are unchanged. Legacy observation batches are delivered before dependent measurement batches. Physical approval and live/replay/synthetic separation remain server checks.

## Durable queue and restart

The main worker outbox remains at `--outbox`. Measurement envelopes use its separate `measurements/` subdirectory. `bridge.checkpoint` is private JSON continuity state with a non-`.json` filename so it cannot be mistaken for a queued HTTP envelope. No token, frame, plate/person data or raw tracker ID is retained there. The pipeline-version marker includes a prefix of the private traversal-config hash.

For each plan: persist pending checkpoint → enqueue all ordered envelopes → commit/persist checkpoint → permit HTTP flush. Retractions precede replacement minutes after clock rebins. Source-clock improvements recompute the original completion membership, and legacy observation references update/remove with their actual revisions. A legacy retraction followed by replacement of the same minute becomes one final reference update.

Startup restores and finishes a retained pending plan before flushing its outbox. Partial capacity, missing/corrupt checkpoints or undelivered earlier measurements fail closed and preserve recovery data. A new runtime does not reopen old tracker identities or silently combine overlapping runs. Drain/review prior delivery before starting another run; the server rejects cross-run camera-minute overlap. Do not delete an outbox to make an error disappear.

Checkpoint writes and outbox enqueue/acknowledgement directory entries are fsynced. The bridge retains at most 10,000 completed events and 240 minute revision keys; the runtime also bounds session clocks at 32. The producer queue retains at most 256 envelopes / 8 MB. Capacity is explicit failure, not silent eviction. Rotate/review bounded runs before those limits. Current server evidence retention is a separate 24-hour/32 MiB local policy.

## Verification and remaining acceptance

Focused tests cover opt-in configuration, exact v1 serialization without worker physical assertions or raw tracker IDs, linked stops, clock-rebin ordering, observation reference replacement, lost tracks/reconnects, partial-plan restart recovery, denied corrupt checkpoint delivery and unchanged queued-byte retries. A simulated-frame test exercises actual `worker.main` orchestration through both senders and final delivery checks without loading a detector/GPU. Backend tests verify that accepted fixture envelopes survive durable reload and drive explicitly labeled pollutant scenarios and briefs. See [integration readiness](../evaluation/integration-readiness.md).

These controlled tests are software integration evidence. Real camera calibration/class mixture review, held-out crossing acceptance and the configured GPU/replay/outage demonstration remain required. No live camera or scientific configuration is activated by this checkpoint.

**Final verification (7 November 2026, 21:04 America/New_York / 8 November 2026, 02:04 UTC):** 172 focused Python tests plus 112 subtests pass with the pinned worker dependencies in an isolated Python 3.12 environment. This covers `test_measurement_runtime.py`, `test_runtime.py`, `test_publish.py`, `test_aggregate.py`, `test_timing.py`, `test_traversal.py`, `test_measurement.py`, `test_metrics.py`, `test_calibration.py` and `test_check_counts.py`. The runtime adapter contributes nine tests. All 99 backend tests (17 measurement integrations), backend/contract type checks, Python syntax/help and scoped whitespace checks pass. Initial missing system-Python inference dependencies and a missing field in the simulated detection fixture were resolved before the passing runs. No production web build is run by this work package.
