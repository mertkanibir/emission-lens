# Measurement integration — frontend consumers

**Owner:** Mert
**Updated:** 7 November 2026, 21:05 America/New_York / 8 November 2026, 02:05 UTC
**State:** ready-to-connect binding and controlled consumer acceptance completed.

This work preserves the completed tan/green design. Frontend owns thin adapters, server-page bindings, presentation guards and acceptance. Backend owns authentication, validation, approved registries, private persistence, composition, calculations and brief text. Core contract 1.1 is unchanged; the separately versioned measurement envelope is documented in [the backend interface](../backend/MEASUREMENT-INGESTION.md). No real camera configuration or scientific approval is enabled here.

## Exact bindings

| Consumer | Binding and boundary |
|---|---|
| `/api/measurements` | One-argument GET/POST wrappers around `handleMeasurementGet` / `handleMeasurementPost`. Node runtime, force-dynamic; route context is never forwarded as a backend test clock. |
| `/api/measurements/evidence` | GET wrapper around bearer-authenticated `handleMeasurementEvidenceGet`. No private provenance is automatically fetched by the UI. |
| `/api/measurements/refresh` | POST wrapper around bearer-authenticated `handleMeasurementRefreshPost`. No caller-controlled registry approval or path. |
| Overview and workspace status | Existing authoritative `get_camera_status`, `get_traffic_window`, `get_emissions_window`; calibration status uses `get_measurement_registry_status(cameraId,mode)`. Frontend never combines worker and measurement versions itself. |
| Camera/scenario | One `read_measurement_window({cameraId,mode,now,stoppedTimeReductionPct})` supplies pollutant/cohort/receipt/assumption presentation. `scenario.pollutants` maps `baseline_g`, `scenario_g`, `change_g`, `change_pct` independently for CO2/NOx. Existing `compare_scenario` supplies its separate observation-minute comparison. |
| Readiness and evidence | Public registry state, versions, retained-minute calculation state/reasons, exact minute meteorology, applied factor/method versions and safe receipt references. Count review is explicitly not exposed by this public summary. No overall readiness score. |
| Brief | Exact `draft_brief` text is rendered, copied and downloaded. Its pollutant and calculation-assumption lines come from the backend. No second frontend measurement read or alternate numerical draft can diverge across incoming revisions. |
| Existing aggregate API | `/api/cameras` preserves its shape; its legacy `calibration` property remains static contract metadata. The measurement GET and page bindings carry authoritative registry/readiness information. |

## Semantic guarantees

- Null stays unavailable. Supported zero stays zero. Unsupported numeric fields do not certify readiness; each pollutant keeps its own support.
- Signed changes are scenario minus baseline. Positive changes remain increases. Missing sides withhold both changes; baseline zero has no defined percentage.
- Original completed-cohort distances, elapsed traversal time and linked stopped time are separate from general observation-minute stops. The same original completion cohort is used on both sides; hypothetical rows never enter observed totals.
- Registry approval is camera/mode scoped. Registered versions or accepted counts do not independently approve physical calibration, mappings or emissions.
- Exact temperature/RH assumptions and calibration/mapping references are shown per retained minute. Mixed windows are not assigned one invented weather value. These are supplied calculation assumptions, not observed weather.
- Summary gram readouts retain small NOx values; detailed comparisons retain six fractional places. Very small values use scientific notation instead of a false zero. Compact summaries expose the raw numeric value in their tooltip.
- Public UI/GET summaries contain no raw traversal/session identity, registry path or credential. Private evidence and refresh remain authenticated. Drafts are local exports, never automatically sent.

## Verification

From the repository root:

```bash
TSX_TSCONFIG_PATH=frontend/tsconfig.json node --import tsx --test frontend/test/*.test.ts
npm run typecheck
npm run build
```

All **24 frontend tests**, root type checks and the combined production build pass. The stale duplicate generated route declaration reported during coordination was absent after production type regeneration; only generated build output was affected. No tracked source declaration or user server was removed.

The controlled route test covers unauthorized non-mutation, strict distance-override rejection, exact retry/conflict, authoritative traffic/emissions/scenario agreement, private evidence authentication, exact export, synthetic/live/replay isolation, registry revocation preserving counts, exclusive upper-minute boundary, and different 70 F / 80 F minute assumptions. Render guards cover independent pollutants, signed increases/decreases, null/zero, undefined percentages, partial support and small gram values.

### Controlled production fixture

An owned server on **3100** used a private generated token, private store and explicitly **synthetic-only** fake registry. It never installed test approval on the user's server. Camera 222 produced supported fixture values; camera 223 retained seven fixture crossings while physical estimates stayed unavailable. Live/replay did not borrow synthetic grams.

| Estimated pollutant | Baseline g | Hypothetical 50% scenario g | Signed change g |
|---|---:|---:|---:|
| CO2 | 522.7040374906867 | 427.43196531596425 | -95.27207217472244 |
| NOx | 0.0586826695139753 | 0.05012077846198043 | -0.008561891051994869 |

These are integration/calculation checks, not field measurements, validated physical distances or demonstrated savings. The production browser shows 70 F / 60% RH; the unit route check also retains a distinct 80 F / 60% RH minute. Original timestamps/cohort and factor assumptions remain explicit.

### Browser acceptance

- Desktop and **354 px phone**: all four workspace menus, Escape/outside/exclusive dismissal, four camera destinations, live/replay/synthetic switches, four brief options, scenario 0/50/100, cohort/evidence disclosures, copy feedback and actual download pass.
- Gram and percent changes fit together in the existing desktop panel. Phone evidence tables scroll independently; non-table content stays inside the viewport. A horizontal gesture leaves page pan at zero. Local/system reduced-motion behavior passes and overrides are cleared.
- The actual downloaded synthetic brief is **2,126 characters**, exactly equal to `draft_brief` after newline normalization, including pollutant comparisons and exact meteorology. Copy feedback passes; clipboard contents were not independently read back.
- Approved `mark.svg`, SVG/ICO favicons and apple icon are applied from the delivered kit. Served assets match committed bytes. Layout, text, palette and status color meanings are preserved; no CSS or brand asset file was changed by this stream. Brand acceptance is separate from scientific readiness.
- Production browser warnings/errors captured: none. The original localhost server remains **PID 46237** on port 3000. Its synthetic overview was refreshed with the approved mark and original 24-crossing sample. An actual localhost measurement GET returns HTTP 200, live physical approval false and both pollutant comparisons unavailable.

## Evidence and cleanup

Local artifacts under `/tmp/emission-lens-measurement-acceptance/`: `comparison-desktop.png`, `controlled-fixture-full.png`, `evidence-phone.png`, `browser-checks.json`, `actual-brief.txt`, `export-verification.json`. These are controlled UI/test evidence, not raw footage, and are not committed.

Owned production servers, private token/store/registry directories and temporary browser tab were removed. Port 3100 is released; the user server remains running. Viewport/media overrides were restored. The owned downloaded file was moved from Desktop into the local acceptance artifacts.

## Remaining inputs

Frontend has no guessed-field or missing-export dependency. Independently accepted physical calibration/movement distances, production visual-to-CARB mixtures, valid linked field traversals and deployment persistence/topology remain outside this consumer checkpoint. Count acceptance does not approve those inputs. The architecture is currently single-host; this is not a Vercel/serverless deployment claim. Real registry, worker/model selection and camera configuration were not changed by frontend work.

## Final generated-output and revised-asset check — 7 November 2026, 21:05 America/New_York / 8 November 2026, 02:05 UTC

Mert recorded one generated-output recurrence after the production build: an identical ignored `frontend/.next/types/routes.d 3.ts` copy reappeared (2,394 bytes, identical to the canonical declaration). Only that exact untracked copy was removed; root `npm run typecheck` then passed and the named copy was absent. No generated artifact or tracked declaration was staged. The origin of the duplicate was not established by this cleanup.

Brand revision `d96ae5b` is separately approved and published: center leaf and thinner corner bars at the same asset paths. Actual localhost returned HTTP 200 and byte-for-byte equality for the revised `mark.svg`, `favicon.svg`, `favicon.ico` and `icon-180.png`. The isolated presentation fixture was already closed; Mert's revised preview approval and this served-byte check are recorded separately from the earlier menu/visual acceptance. No further product/source styling or asset generation was performed here.
