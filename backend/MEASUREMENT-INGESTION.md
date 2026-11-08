# Measurement ingestion and calculation binding

**Owner:** Mert
**Proposal published:** 7 November 2026, 20:31 America/New_York / 8 November 2026, 01:31 UTC
**Status (7 November 2026, 20:49 America/New_York / 8 November 2026, 01:49 UTC):** Server ingestion, registry, atomic evidence/composition, read/scenario/brief binding and 13 focused integration tests are implemented. The opt-in runtime producer bridge is in progress. Existing worker contract 1.1 is unchanged.

This separately versioned path accepts observations and completed traversal evidence, resolves server-approved calibration/mapping versions, calculates emissions, and replaces the authoritative minute and its private calculation evidence in one local transaction. It never trusts a worker-supplied calibration status, transform, distance, factor or emissions total. Registry approval remains a scientific decision outside this implementation.

## Early route/export handoff

UI owns the thin route files; engineering does not edit `frontend/`.

| Route | Backend export / signature | Purpose |
|---|---|---|
| `POST /api/measurements` | `handleMeasurementPost(request: Request): Promise<Response>` | Authenticated v1 ingestion; returns receipt, never raw evidence. |
| `GET /api/measurements?camera=222&mode=live&reduce=20` | `handleMeasurementGet(request: Request): Promise<Response>` | Public window/readiness and per-pollutant scenario summary; no raw traversal/session IDs or registry paths. |
| `GET /api/measurements/evidence?reference=<sha256>` | `handleMeasurementEvidenceGet(request: Request): Promise<Response>` | Same bearer authentication; private calculation provenance only. |
| `POST /api/measurements/refresh` | `handleMeasurementRefreshPost(request: Request): Promise<Response>` | Same bearer authentication; rederive retained measurements after server registry changes. Empty JSON `{}` only. |

Route files use `runtime = "nodejs"`, `dynamic = "force-dynamic"`, and wrap handlers in a one-argument function rather than forwarding the route context as a test clock. Ingestion uses the existing `EMISSION_LENS_WORKER_TOKEN` (at least 32 characters), a 1 MiB streamed body limit, no redirects/sending tools and uncached responses. Existing `POST /api/worker` remains for run/status/legacy observation packets.

Public backend functions: `ingest_measurement_batch(value, now?)` (Promise receipt), `refresh_measurements(now?)` (Promise result), `read_measurement_window({cameraId,mode,now?,stoppedTimeReductionPct?})` (local read model), and `get_measurement_registry_status(cameraId,mode)` (public version/readiness summary). Existing `get_traffic_window`, `get_emissions_window`, `compare_scenario` and `draft_brief` bind to persisted measurement results. `compare_scenario` gains additive `pollutants`, `completed_cohort` and `evidence_refs` fields; each pollutant has `baseline_g`, `scenario_g`, signed `change_g`, and `change_pct`. The old unlabeled `estimate_g` stays null; consumers use explicitly labeled CO₂/NOₓ fields. General observation-minute stopped seconds retain their original meaning.

### Public read types

Exports `MeasurementWindowView`, `MeasurementMinuteView`, `MeasurementPollutantComparison`, `MeasurementScenarioView`, `MeasurementRegistryStatus`. The GET handler returns `MeasurementWindowView`:

```ts
interface MeasurementWindowView {
  camera_id: string; mode: Mode; from: string; to: string;
  registry: MeasurementRegistryStatus;
  minutes: MeasurementMinuteView[]; // only active snapshots in this window
  scenario: MeasurementScenarioView;
  evidence_refs: string[];
  limitations: string[];
}
// Each minute: minute, batch_id, revision, state, reasons:string[],
// timing_basis, meteorology:{temperature_f,relative_humidity_pct}, calibration_version, mapping_version, evidence_ref,
// traffic:TrafficMinute[], emissions:EmissionsMinute[]. No identities.
// Scenario: available:boolean, pollutants:{co2,nox}, completed_cohort,
// evidence_refs, assumptions:string[], limitations:string[].
// Each pollutant: baseline_g, scenario_g, change_g, change_pct (number|null).
// completed_cohort: {count:number|null, baseline:{distance_m,traversal_time_s,
// stopped_time_s}, scenario:{distance_m,traversal_time_s,stopped_time_s}}.
// Registry status: state:'missing'|'invalid'|'configured', revision:string|null,
// calibration_version:string|null, mapping_versions:string[],
// physical_calibration_approved:boolean. Approval is camera/mode scoped.
```

These names and fields are stable for the thin route/read consumers; any additional fields will be additive. Errors return `{error:string}` with no private path, credentials or raw producer identities.

## Measurement envelope — version `1.0`

Every listed field is required; unsupported fields reject the whole request. UUID batch IDs and nonnegative integer revisions identify **complete snapshots**, never increments.

```json
{
  "measurement_version": "1.0",
  "batch_id": "00000000-0000-4000-8000-000000000001",
  "revision": 0,
  "run": {"run_id":"opaque-run", "model_version":"detector-pipeline-version", "device":"cuda:0", "started_at":"2026-11-07T20:00:00Z", "ended_at":null, "mode":"synthetic"},
  "camera_id": "222",
  "mode": "synthetic",
  "minute": "2026-11-07T20:04:00Z",
  "calibration_version": null,
  "mapping_version": null,
  "units": {"distance":"m", "time":"s"},
  "timing": {"basis":"estimated_hls_media_utc", "clock_method":"hls-min-anchor-v1", "sessions":[{"session_id":"opaque-session", "anchor_utc":"2026-11-07T20:04:00Z"}]},
  "meteorology": {"temperature_f":70, "relative_humidity_pct":60},
  "observation_ref": null,
  "observations": [{"vehicle_class":"car", "count":1, "stopped_vehicle_seconds":null, "queue_count":null, "coverage":null}],
  "traversals": [{"session_id":"opaque-session", "traversal_id":"opaque-traversal", "movement_id":"entry-to-exit", "completed_at":"2026-11-07T20:04:30Z", "entry_media_s":10, "exit_media_s":30, "traversal_time_s":20, "stopped_time_s":5, "vehicle_class":"car"}],
  "retract": false
}
```

The example is a **synthetic shape example**, not a registered camera/mapping or accepted field measurement. The default registry is empty, so it produces unavailable physical estimates. Use only controlled test stores for fixtures. The normal synthetic demo clock remains fixed around `2026-11-07T20:04:00Z`; live/replay use their own windows and never include synthetic totals.

- `run.mode` must equal `mode`. Camera/run/mode remain immutable for a batch UUID; a higher revision may correct its minute and full contents. Minute and all event/anchor times are UTC (`Z` or `+00:00`), minute aligned; source-time provenance is explicitly **estimated**, not capture UTC.
- `timing.sessions` is scoped to this camera/run; each traversal must reference one listed session. Entry/exit media seconds are nonnegative, strictly ordered; elapsed time equals `exit - entry` within microsecond precision. `completed_at` must agree with that session anchor plus exit media time and belong to `minute`. Stopped time is null or finite in `[0,total]` for that same completed vehicle.
- Distances are **not supplied by the worker**. `movement_id` resolves to the fixed, independently supported metre distance in the approved server calibration entry. Pixels/image displacement, arbitrary per-worker `distance_m`, transforms, calibration-valid flags and gram totals are rejected as unsupported fields.
- Observations contain only selected-gate counts, general observed stopped seconds, image queue counts and supported coverage. They are not reconstructed from completed traversals. No duplicate class rows or traversal identities within a snapshot. Queue/coverage are camera-minute observations: queue appears on at most one class row; class coverages must agree when present.
- `observation_ref` is null or `{ "batch_id": "<worker-UUID>", "revision": 0 }`. It explicitly links a legacy worker observation snapshot for the same camera/run/mode/minute. If that reference is absent/stale/retracted, its dependent physical calculation is withheld until refreshed with a current reference. Independently observed legacy crossing/queue/general-stop fields are preserved when completion-only data is composed; calculated nulls do not erase them.
- `retract:true` requires empty observations/traversals and withdraws this measurement snapshot and all dependent physical/scenario results atomically. Higher-revision minute corrections remove the old minute without fabricating zero rows. Another active measurement batch/run owning the same camera/mode/minute conflicts (409); no automatic restart/overlap merge.

## Server registry — version `1.0`

Set `EMISSION_LENS_REGISTRY_PATH` to a **server-controlled absolute JSON file**, never a worker request or client upload. Unset/missing/pending entries supply no physical approval. The initial/default document is:

```json
{"registry_version":"1.0","revision":"unconfigured","calibrations":[],"mappings":[]}
```

A calibration entry has exactly `camera_id`, `version`, `approval`, `valid_from`, `valid_to`, `calibration`, `movements`. `calibration` is the existing `CameraCalibration` record with matching camera/version, nonempty gates/references, a finite nonsingular 3×3 transform and `validation_status:"valid"` for an approved entry. Gates are an object keyed by entry/exit gate ID. A movement is `{ "movement_id":"entry-to-exit", "entry_gate_id":"entry", "exit_gate_id":"exit", "distance_m":100, "distance_units":"m", "evidence_refs":["independent-distance-reference"] }`. The distance is an approved fixed segment/path assumption, not accumulated noisy vehicle displacement. `valid_from`/`valid_to` (exclusive end; null for no end) scope the calibration in estimated source UTC.

A mapping entry has exactly `version`, `approval`, `region`, `calendar_year`, `mapping`. `mapping` is the existing `ClassMapping` with matching version, documented evidence and positive VMT shares summing to one per visual class. Region/year must match the retained Los Angeles (SC), 2026 factor catalog. Unknown vehicles stay unmapped. Fuel-aggregated factors receive no additional EV discount.

For either entry, approval is exactly `{ "status":"approved|pending|rejected", "reviewed_by":"Mert|Carter|null", "reviewed_at":"UTC|null", "evidence_refs":["reference"], "modes":["synthetic"] }`. Approved entries require a named reviewer, UTC review time, nonempty evidence references and nonempty mode scope. A synthetic-only approval **never** applies to live/replay. Duplicate version keys, malformed units, invalid transforms/weights or unsupported fields invalidate the registry; observation counts remain available but physical outputs are withheld. Registry changes invalidate old derivations immediately on reads; refresh or exact source resubmission recomputes them transactionally under the new registry fingerprint. Approval is never inferred from a JSON example or mathematical validity alone.

## Durable composition, identity and reads

The existing protected local snapshot gains optional separately typed measurement entries; old worker snapshots remain readable. A single POSIX writer lock and atomic rename commit authoritative traffic, both pollutant rows, source revision and private evidence together. Stored source identities are camera/run-scoped hashes; raw tracker IDs, frames, plates/person data and arbitrary producer fields are not retained or returned. Exact normalized source retries are idempotent; changed same/lower revisions conflict. Superseded receipt hashes identify corrections. Retraction/registry/reference changes invalidate dependent emissions and scenario reads; scenario artifacts are recalculated from the retained completed cohort and never inserted as observed emissions.

Public summaries include minute, quality/reasons, timing basis, versions, `evidence_ref`, composed contract-1.1 traffic/emissions and per-pollutant scenario comparison. Private authenticated evidence includes calculation contributions and registry/source digests, not image payloads. A camera-minute with no completed traversals is insufficient emissions evidence, never zero grams. General stopped time and completed-cohort stopped time are separate. Range endpoints remain null.

The initial repository adapter is the existing persistent single-host file store. Ingestion/HTTP use Promise-based boundaries so a later shared-store adapter can replace transactions; existing synchronous dashboard reads remain a local compatibility layer. No Supabase credentials/project, paid hosting, public port or multi-instance preview service is provisioned here.

## Plugging in reviewed inputs

1. Keep the empty registry until the scientific owner supplies accepted calibration movements/references and mapping weights. Install that reviewed versioned JSON privately on the server with appropriate mode scope.
2. The producer bridge emits the exact v1 envelope, using the same per-session media-clock anchor and opaque traversal identity, actual entry/exit elapsed seconds and that traversal's own stopped component. Leave missing stopped evidence null. Supply version references, never a valid flag/distance/grams.
3. POST authenticated complete snapshots to `/api/measurements` with stable UUID/revisions. Link the observation source when applicable, or supply observations directly; keep model/labels/weights and runtime selection unchanged.
4. Read `/api/measurements` or existing backend query/scenario/brief tools. Check quality/reasons and evidence references before displaying physical quantities. Replace fixture registries/payloads only in the private runtime, never activate controlled-test approval records for a real camera.


## Server checkpoint verification

At 7 November 2026, 20:49 America/New_York / 8 November 2026, 01:49 UTC, all 95 backend tests and backend/contract type checks pass. The 13 measurement integration checks use temporary synthetic-only registries/stores and cover source integrity, independent observations, real-factor arithmetic, reload, per-pollutant scenarios/briefs, retries/revisions/retractions, clock minute correction, mode/run overlap, malformed/absent approval, registry revocation, linked observation revisions, missing stops, unknown movements/classes, authentication and streamed-body bounds. They approve no real camera or mixture. Authenticated evidence retains the current source and at most 64 superseded source receipt hashes per batch; detailed superseded calculation bodies are not an audit archive. The single snapshot retains at most 1,000 measurement batches within the 24-hour write/refresh horizon and shares the existing 32 MiB ceiling.

**Assumption disclosure (7 November 2026, 20:49 America/New_York / 8 November 2026, 01:49 UTC):** Public minute summaries carry their exact retained temperature/humidity. Scenario `assumptions` and the brief list each retained minute with its own values and calibration/mapping references; mixed-value windows do not collapse to one invented weather value. The legacy scenario gains additive `calculation_assumptions` for the same traceable text.
