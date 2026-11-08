# Read-only stopped-time replay acceptance

**Owner:** Mert
**Updated:** 8 November 2026, 01:57 America/New_York / 06:57 UTC
**Status:** Driver prepared and independently tested; new actual 222/223 execution results are pending. Existing 176075/176255 jobs and 3138/3139/3150 applications are preserved.

Run one command after Mert supplies the fresh isolated replay application's ready receipt and both final runtime reports:

```sh
python3 backend/scripts/check-stop-replays.py --manifest runs/private-replay-acceptance.json --output runs/private-replay-acceptance/result
```

The manifest and output must stay under ignored private storage. The driver only reads the supplied application, files and original CARB CSV. It never starts/stops a service, posts data, refreshes the store, submits a GPU job, changes a profile or sends a message. It loads the bearer token from the ready receipt's private environment file, uses loopback authenticated GETs without redirects and writes private output with mode 0600. Tokens do not enter command arguments or output.

## Private input shape

`ready_path` is a private JSON receipt with `base_url`, `authoritative_store_path`, `approved_registry_path`, `registry_sha256`, `private_worker_environment_path`, `build_workspace` and optional `node_executable`. Its build workspace must be the actual pinned application/worker source. The registry must contain all four camera entries; 222/223 still require their own approved replay calibration/mapping and source-time coverage.

```json
{
  "ready_path": "/absolute/private/replay/ready.json",
  "baseline_snapshot_path": "/absolute/private/replay/before.json",
  "runs": [
    {
      "camera_id": "222",
      "runtime_report_path": "/absolute/private/replay/222-runtime.json",
      "traversal_policy_path": "/absolute/private/replay/222-traversals.json",
      "geometry_path": "/absolute/private/replay/222-geometry.json",
      "source_recording_path": "/absolute/private/source-222.ts",
      "source_sha256": "exact-source-sha256",
      "execution_receipt_path": "/absolute/private/replay/222-execution.json"
    },
    {
      "camera_id": "223",
      "runtime_report_path": "/absolute/private/replay/223-runtime.json",
      "traversal_policy_path": "/absolute/private/replay/223-traversals.json",
      "geometry_path": "/absolute/private/replay/223-geometry.json",
      "source_recording_path": "/absolute/private/source-223.ts",
      "source_sha256": "exact-source-sha256",
      "execution_receipt_path": "/absolute/private/replay/223-execution.json"
    }
  ]
}
```

The baseline is optional only for a fresh empty store; otherwise its exact existing entries must remain unchanged. An optional top-level `weights_sha256` pins the expected pretrained weights; both runtime reports must in all cases use the same weights. Each final report must name a separate actual CUDA replay run, configured **300-second wall bound**, 15 requested FPS, 640 pixels, exact geometry/traversal hashes, drained worker/measurement delivery and no runtime failure. Literal stopped thresholds remain **222 = 0.0225 / 223 = 0.0283**, with exact method names and `+stop-v1` contexts.

The private execution receipt binds root's actual launch/source record to its returned report:

```json
{
  "run_id": "actual-runtime-run-id",
  "runtime_report_sha256": "exact-returned-report-sha256",
  "source_sha256": "exact-source-sha256",
  "traversal_policy_sha256": "exact-policy-sha256",
  "geometry_sha256": "exact-geometry-sha256"
}
```

An omitted execution receipt leaves source-to-launch linkage unverified and produces a partial result, even if read/math checks pass. If the actual launch explicitly selects a finite source interval, add matching `source_window_s:[start,end]` to both its run item and execution receipt. The driver then checks actual source bounds and records whether endpoints were covered within one second. Do not add a `[0,300]` source interval merely because the configured wall duration is 300 seconds: warmup, pacing and drops mean these are different quantities. Without an explicitly selected source interval, endpoint coverage is not a pass requirement.

## Checks and interpretation

The driver captures one sealed generation and verifies every new active measurement with authenticated current HTTP and a fresh process using the recorded build. It only reacquires (at most three times) after proving a concurrent replacement; approval, source, integrity or arithmetic failures do not become retries until green. Original history stays intact, old evidence semantics are unchanged, and public live/synthetic reads must exclude the new replay references and all private traversal/session IDs.

For each camera it reports actual completed-candidate count, positive/zero/unknown stopped counts, maximum stopped duration, frame count, first/last PTS, per-session spans, reader drops, reader state and traversal issue counters. It independently checks each `[0,duration]` stopped bound, anchor/exit/completion agreement, same-minute linked worker revision/run/camera/mode, unique completed identities and registry-resolved movement distance. The persisted count must equal the final actual worker diagnostic. Native intra-session PTS gaps are not recoverable from aggregate first/last timestamps; continuous video coverage and field accuracy remain explicitly unverified.

**Queue reporting addition (8 November 2026, 01:57 America/New_York / 06:57 UTC):** Mert requested actual queue-observation counts without requiring a numeric queue to pass. The driver records zero/positive/unavailable/ambiguous states per linked observation minute and the latest public `queue_observation` timestamp/reason/count/length. It reads the public replay camera route and compares its traffic summaries exactly with the fresh sealed-snapshot read. Missing or conflicting identity evidence remains null; no threshold or queue policy changes to force a number. Eight oracle/policy/reporting tests pass. The result binds its own driver hash and recorded application/executed-worker hashes.

Every complete retained replay minute is queried separately through the labeled explicit `from`/`to` interface, including empty and unmapped cohorts. No numeric-only filter creates a selected total. Original CSV baseline, hypothetical 20% grams and signed change are recomputed per traversal using unchanged distance/cohort/class mixture/weather and original RUNEX bins. Unknown classes, missing stops and empty cohorts retain null; supported zero stays numeric. Unsupported included minutes keep whole-window results unavailable. A numeric complete-minute result is presented only with that minute's exact scope.

The exercise matrix requires completed candidates, numeric stopped values, count-1 crossings, numeric complete-minute scenarios and source execution linkage. An all-zero stopped cohort is valid; a positive stop is reported when observed and is never required to turn a valid zero into a pass. If a required condition did not occur, the driver writes **PARTIAL** with the actual values. It never invents a positive observation or swaps policies to obtain one. Failed integrity/math assertions stop the driver without a pass result. The raw private report and all attempted generations remain available for inspection. Dashboard REPLAY labeling remains a separate frontend/browser check; a backend pass does not claim that it occurred.

**Methodological correction:** An unconditional `scenario_g <= baseline_g` requirement conflicts with the retained scientific method. Nonlinear upper-edge RUNEX bins can increase estimated emissions after a shorter-stop assumption. The driver preserves signed increases and supported same-bin zero changes. It adds no ordinary-idle process, EV discount, statistical interval, measured air-quality claim, engine-running inference or real-world savings claim.

Eight independent-oracle/policy/reporting tests pass, including original CSV mile arithmetic, missing/unknown/empty nulls, supported zero, a valid entirely zero stopped cohort, exact literal policies, queue state reporting and a positive signed 20% factor-bin change. Python syntax/help and whitespace checks pass. This preparation is not evidence that the new actual replays have run.

**Checklist reconciliation (8 November 2026, 01:51 America/New_York / 06:51 UTC):** Mert read Carter's complete saved checklist (private source SHA-256 `5fde2de60a99faa948312d121989208b3364b616f9b2352356264400c70f1c5e`). The driver now also checks reviewed/enabled `222-image-v4` / `223-image-v2` geometry, matching policy view versions, count-1 provenance, exact through-movement IDs and numerical scenario percentage fields. Its original positive-stop exercise gate was too strict and has been corrected with a regression: Carter explicitly accepts supported zeros. The checklist's unconditional nonincrease condition is superseded by the methodological correction above. Its description of 223 as the first emissions E2E is historical overstatement; [job 176174](./223-REPLAY-176174.md) is already accepted. The stopped-time reference remains calibration-derived, not human annotated. 220/228 remain excluded from these metrics after failed held-out count screens; registry presence is not new scientific approval.
