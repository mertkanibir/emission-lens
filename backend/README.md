# Backend

**Owner:** Mert  
**Updated:** 7 November 2026, 18:53 America/New_York (23:53 UTC)

Read path for camera status, traffic windows, estimated emissions, scenarios, investigation priorities, and draft briefs. The store reads validated live/replay worker batches when `EMISSION_LENS_STORE_PATH` is configured, with separate labeled synthetic fixtures. `db/` is a Postgres draft and has not been applied.

Live and replay windows remain empty until their own worker records arrive. The synthetic minute is labeled and is excluded from live totals. Invalid or missing calibration suppresses speed and distance-based emissions.

**Historical factor note (7 November 2026, 16:25 America/New_York / 21:25 UTC):** Mert loaded the validated 1,296-row CARB RUNEX catalog from `emissions/`. `get_factor_catalog_status` exposes provenance and scope; `lookup_runex_factor` returns g/vehicle-km at an explicit speed bin and meteorology; `estimate_completed_traversals` returns contract-1.0 rows and supporting evidence. No production class mapping is enabled. The existing fixture store is not replaced: worker persistence, calibrated observations and class mappings are still required for live results. See `emissions/README.md` for the supported region, year, method and limitations. No contract fields changed.

The assistant tools are `get_camera_status`, `get_traffic_window`, `get_emissions_window`, `get_context`, `compare_scenario`, `rank_investigation_priorities`, and `draft_brief`. There is no send tool.

Run `npm test` and `npm run typecheck` from the repository root after install.

**Ingestion note (7 November 2026, 18:18 America/New_York / 23:18 UTC):** Mert implemented authenticated `POST /api/worker`, public aggregate `GET /api/cameras?mode=live|replay|synthetic`, a persistent single-host atomic store, idempotent retries, revision handling, event-order protection and private local configuration. See [INGESTION.md](./INGESTION.md). This requires a persistent POSIX volume; ephemeral serverless disks are not a hosted persistence solution. The public endpoints never expose worker tokens or filesystem paths.

**Timing note (7 November 2026, 18:53 America/New_York / 23:53 UTC):** Mert aligned new traffic minutes to the estimated HLS media clock recorded by worker runs marked `t:hls-min-anchor-v1`. The read path discloses this basis and warns when a window mixes it with legacy or unspecified record times. Capture UTC remains unavailable; advancing-frame heartbeats still govern freshness. Higher-revision empty traffic batches retract superseded rows before corrected minutes are published, avoiding duplicate counts. Historical receipt-time records are unchanged. See [ingestion and revision semantics](./INGESTION.md) and [timing evidence](../evaluation/timing-alignment.md). Hosted shared persistence, physical calibration and approved class mappings remain open.

**Engineering checkpoint (7 November 2026, 19:41 America/New_York / 8 November 2026, 00:41 UTC):** `displayedState` now keeps an explicitly offline camera offline as its heartbeat ages. Added pure `build_completed_traversal_report` and `compare_completed_traversal_scenario` exports, documented in [TRAVERSAL-REPORT.md](./TRAVERSAL-REPORT.md) and [SCENARIOS.md](../emissions/SCENARIOS.md). They compute supported explicitly supplied cohorts without registering calibration or writing live totals. The aggregate-only scenario no longer treats general stopped seconds as the completed cohort's stopped component; nonzero traversal-time changes remain unavailable without linked evidence. A separate recovery claim prevents concurrent stale-lock reapers from removing a new live writer lock. All 82 package tests and backend/contract type checks pass. Live producer, trusted registries, private calculation-evidence persistence and authoritative composed writes remain unfinished; see [integration readiness](../evaluation/integration-readiness.md). No public contract fields changed.
