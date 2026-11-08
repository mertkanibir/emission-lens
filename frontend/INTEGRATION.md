# Measurement integration — frontend consumers

**Owner:** Mert
**Updated:** 7 November 2026, 20:27 America/New_York / 8 November 2026, 01:27 UTC
**State:** consumer inventory and additive plan; backend measurement interface pending.

The dashboard design is frozen for this work. Frontend owns route adapters, server-page bindings, semantic presentation and bounded end-to-end checks. Backend owns transport validation/authentication, approved registry lookup, private persistence, authoritative aggregate composition, calculations and briefs. No camera configuration is enabled by this plan.

## Existing bindings and exact gaps

| Consumer | Current binding | Integration need |
|---|---|---|
| Overview/server page and API cameras | `get_camera_status`, `get_traffic_window`, `get_emissions_window`, `listCameras` | Keep using authoritative backend reads. Accepted measurement rows must compose there; frontend must not sum worker and measurement versions itself. |
| Overview calibration caption / workspace calibration count | Static `calibrationFor` from contracts | Consume a documented server-controlled measurement/registry read, scoped to camera/mode/version. Static camera metadata must not override a valid backend estimate or imply registry approval. |
| Camera detail and readiness | Traffic/emissions reads plus static `calibrationFor` and factor catalog | Show actual reviewed registry state, versions and explicit missing prerequisites when exposed. Counts review is independent of physical calibration, mapping and pollutant support. No inferred readiness score. |
| Camera scenario | `compare_scenario`; its `ScenarioSide.estimate_g` is permanently null | Read documented baseline/scenario grams separately for `co2` and `nox`, each quality-gated, plus backend signed gram/percent changes. Null remains unavailable; baseline zero has no defined percent change. No frontend emissions arithmetic. |
| Scenario assumptions/provenance | Backend limitations plus historical fixed meteorology copy | Display exact backend cohort, reduction, held-constant assumptions, meteorology, calibration/mapping/factor/method versions and safe evidence references. No guessed weather, review approval or raw identifiers/media. |
| Brief | `draft_brief`, `rank_investigation_priorities`; exact text passed to `BriefActions` | Preserve authoritative draft text, evidence references, mode isolation and local-only export. New per-pollutant scenario content belongs to the backend draft; frontend must not assemble different numbers. |
| Measurement ingestion | No frontend route yet | Add only the exact thin `POST = exportedBackendHandler` wrapper documented in `backend/MEASUREMENT-INGESTION.md`. Authentication, bounds, validation and publication remain in that handler. Never accept registry activation from page query/form input. |
| Worker/preview ingestion and export | Existing `/api/worker`, `/api/frames`, `/api/cameras/[id]/frame`, `/api/brief` | Preserve current handlers/privacy and exact local draft export. Do not add private evidence file serving or caller-controlled filesystem access. |

## Additive implementation order

1. Prepare reusable per-pollutant presentation guards for null, supported zero, signed increases/decreases, undefined percentages and independent CO2/NOx support. Keep backend field mapping pending the published interface.
2. Read `backend/MEASUREMENT-INGESTION.md` and current exported types before writing a transport adapter or consuming new read fields. Record exact function names/routes here after publication. No speculative handler/transport fields are implemented.
3. Bind the camera comparison/readiness and brief consumers to that documented read model, preserving the existing structure and native controls. Keep observation-minute timing separate from completed-traversal timing.
4. Run focused frontend semantic/render/route tests, a combined production build, and an isolated route → private test store → authoritative read → camera/scenario/brief render → actual local export check.
5. Test unauthorized/invalid submissions without mutation, synthetic/replay/live separation, revision/idempotency behavior as documented, missing/stale data and empty live calibration. Use private temporary fixture directories and an owned bounded port; preserve the user's localhost process and actual registries.

## Current dependency

`backend/MEASUREMENT-INGESTION.md` and its exported ingestion/read interfaces do not exist at this inventory checkpoint. The frontend needs the exact measurement handler export, required environment-variable **names**, validated request envelope/version, approved-registry read type, per-pollutant scenario response type and public-safe evidence/provenance fields. No credentials or live registry values belong in this file.

No contract or scientific acceptance change is proposed. A labeled fixture proves integration behavior only; physical calibration, reviewed count accuracy, class mappings and field-validation evidence remain separate acceptance inputs. Single-host persistence does not establish Vercel/serverless readiness.

## Prepared consumer checkpoint — 7 November 2026, 20:27 America/New_York / 8 November 2026, 01:27 UTC

Mert prepared `ScenarioPollutants` using existing table classes and a frontend-only presentation adapter; it is not yet bound to guessed backend fields. Separate pollutant rows preserve backend signed changes, supported zero, missing-side suppression, undefined baseline-zero percentages and very small NOx values. Exact local brief-export checks preserve modes, values, signs, assumptions and evidence text. All 14 focused frontend tests and `npx tsc -p frontend/tsconfig.json` pass. Render tests from the repository root use `TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import tsx --test frontend/test/*.test.ts` so the existing frontend aliases resolve.

The published measurement interface remains the next binding dependency; this checkpoint is not completed ingestion-to-dashboard acceptance. No production build is claimed for the pending backend integration.
