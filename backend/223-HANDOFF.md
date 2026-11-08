# Camera 223 private registry preparation

**Owner:** Mert
**Updated:** 8 November 2026, 00:32 America/New_York / 05:32 UTC
**Status:** Real-record cloned-store refresh/rollback passes; combined-profile UI support is published. Independent app on port 3139 is ready for a separately released bounded replay. Active 222 app/registry/store is unchanged; no 223 inference or GPU submission is performed here.

## Isolated integration checkpoint — 8 November 2026, 00:32 America/New_York / 05:32 UTC

Mert copied one complete atomic generation of the active store at **00:24:11 America/New_York / 05:24:11 UTC** into a private isolated directory: **172 worker batches and 16 measurement entries, all camera 222**. Captured snapshot SHA-256 is `53721696cfc3255a9e99bc2d51756c249953af284f8f09c4d868ac562f6952d2`. The original live writer continued normally; no claim is made that its file stayed static afterward.

An independently owned production app exercised the real authenticated refresh route on that clone: old registry → combined registry → old registry rollback → combined registry. All 16 entries refreshed, a repeat refreshed zero and left identical bytes, and every immutable source, identity, revision, timestamp, observation reference, supersession record and worker batch was preserved. Camera-222 inputs/calculations/traffic/emissions were exactly unchanged, with **zero numerical differences**. Rollback restored the original canonical snapshot and original evidence references exactly. Private evidence authentication/currentness and full stored-snapshot integrity pass at each phase, including records outside the rolling hour. Old evidence references correctly return 404 after replacement, so the private old/new reference map and archived snapshots are retained. No stored private source was re-ingested.

Camera 223 remains **approved but without records** in both live/replay: no completed cohort, evidence reference or numerical total is manufactured. Its exact retained configuration loads without frames, sessions or traversals. UI commit `87b7dd6` now recognizes the combined revision for both cameras while retaining old 222 support; its owner reports 44 frontend tests, TypeScript and isolated build passing. The new independent production build and actual HTML checks show the correct 20 m / 15 m scopes, absent weather inputs when no records exist and conservative unavailable values.

The private integration artifacts are under `runs/223-isolated-integration/20261108T052411Z/`: original, combined-refreshed and rollback snapshots, the actual HTTP checker, calculation-reference map and result receipt. `runs/223-isolated-integration/ui-handoff.json` identifies the refreshed clone. No production token was read or used; the test app used a new isolated token and stopped after its checks. Active port 3138 remains PID 3943 with its original registry.

The separately supervised **port-3139** app has its own cloned store, exact combined registry and independent server-side token. One Node process owns dashboard, aggregate/measurement writers and preview cache. It uses durable frozen source `b1081f19883e1950ab3c6cf28af22be41e7ec30e`, including UI `87b7dd6`, under `runs/223-replay-runtime/20261108T052843Z/workspace/`; the already completed durable build is reused for this app, with no further build required. Startup route/render/authentication/private-evidence/public-asset checks pass and no 223 records were inserted. The original live app's files and process are separate.

`runs/223-replay-runtime/ready.json` is the concrete private GPU handoff: app endpoints, credential path, exact source/config/media hashes, existing model checksum, same-origin preview transport, 90-second replay arguments and retained-read/evidence checks. It is explicitly **preparation only, awaiting root release**. The clip selects source elapsed **[60,150)** from the already reviewed **[60,180)** practice interval. Its lossless derivative's **1,320 decoded frame hashes match the original extraction in order**; original source SHA-256 is `808476414ca24d93f3190bb4a315a8fcbefe807c18c5e4f527d115a1ba89d2a0`, derivative SHA-256 `bd92fa92491193349fc6f785e281a194c23855814aa46e337476322189cb0f60`. Actual container first PTS is 2 s and reported duration 90 s; those facts are preserved rather than claiming capture UTC or rewriting retained measurements. No reserved fresh footage or new inference was used.

See [the narrow activation/rollback plan](./223-ACTIVATION.md). Resource/job release remains with Mert's coordination; this preparation does not submit inference or change the 222 service.

Carter's supplied combined registry `222-223-2026-11-08T04:03:40Z` approves camera 223 calibration `223-ground-esri-v1-34782d640860` for live/replay, with Carter's review at 8 November 2026, 04:03:40 UTC. Its replacement traversal configuration requests `223-image-v2`, shared mapping `pretrained-visual-to-emfac2007-v1` and one `223-southbound-through` movement: **count-3 negative → count-1 negative, fixed 15 m**. The image gates retain their `both` policies; the traversal directions are explicitly negative. Stopped observation is null. **70 °F / 60% RH** are fixed assumptions, not current observed weather. No approval or evidence value was generated by preparation.

## Staged files and verification

The current private pointer is `runs/223-prepared-handoff/ready.json`; this checkpoint's profile is `runs/223-prepared-handoff/20261108T051338Z/`. It retains exact supplied returned-text registry/config bytes as `registry.json` and `traversals.json`, plus the exact current public geometry, movement, correspondence and mapping-source bytes. `manifest.json` records paths/hashes, approval scope, residuals and activation dependencies; `comparison.json` records the active-222 comparison. Private source provenance identifies the returned attachment-text representation; original downloadable email attachment byte identity was not independently established. Neither registry, attachment, source email metadata nor credential is committed.

Both registries pass the existing strict `parseRegistry`. Preparation checks exact camera/view/calibration/mapping identities, transform, gate endpoints **and movement gate references**, 15 m distance, explicit directions, approval modes/time scope and class weights. `MetricsConfig.from_dict` and `TraversalBridge.from_config` pass with no observed frames, sessions or completed events. The initial 00:13 staging performed no detector, actual replay, ingestion, application start or source-data mutation. Private `runs/223-prepared-handoff/prepare.py` retains the reproducible staging/check procedure and creates a new immutable profile directory per invocation.

Independent recalculation from the retained rounded coordinates gives **8 fit pairs: RMS 0.586989 m, maximum 0.967336 m; 4 validation pairs: RMS 1.077400 m, maximum 1.528033 m**. Four other correspondences remain rejected. The retained 14.48–15.35 m leave-one-out range is sensitivity, not a statistical confidence interval. The original correspondence document retains its candidate label; the supplied private approval is Carter's subsequent decision, not an inference from matrix arithmetic.

Hash conventions remain explicit:

| Artifact | SHA-256 |
|---|---|
| Supplied combined registry, returned-text bytes | `7ed03ca706bd8b674d14b6459ce697f818574ab93a07a8d13f29201c5ecab85a` |
| Supplied traversal config, returned-text bytes | `5fa3d72c391552e51f8d1c4a185958b203f59da89d348e93a0e28843d0f0c047` |
| Current local LF geometry v2 | `e22aead81e8c3c561f8eaaf20ba0460c050b7c7979e46df31a485f27d7251b4c` |
| Current local LF correspondences | `9e5bfcb69442f8e50f8a51da812afe9ebc76d237c7b178f8b45b324dd8e20f60` |
| CRLF representation of correspondences | `34782d640860fa0f53990d3dbdffba527b273174604bd8b0657b1a63b381510d` |

The calibration suffix matches the CRLF correspondence hash prefix. The movement document supplies no `view_sha256`. The earlier count-acceptance hash identifies **v1 before enabling**, not the current v2 geometry. No file was normalized to make these identities agree.

## Required coordination before activation

The proposed registry's **entire camera-222 calibration object and shared mapping are semantically identical** to the active supplied owner-approved records; there are no changed paths inside either object. The document revision and added 223 calibration change the global registry fingerprint. A read-only check against the preserved actual 222 snapshot proves that swapping this document would immediately withhold cached 222 physical values until the existing authenticated **POST `/api/measurements/refresh` with `{}`** or an exact source retry recomputes them. No refresh or swap was performed on the running app. Future installation must coordinate with the active writer, preserve retained records and verify 222 again after derivation refresh.

At the initial 00:13 checkpoint, frontend `measurementScope` recognized only 222's old exact registry revision, so the proposed swap made its scope generic. **UI commit `87b7dd6` resolves revision/profile compatibility and adds accurate 15 m disclosure** in the independent app; the original 3138 build is intentionally unchanged. A future production cutover must use the verified compatible build. This backend work changes no frontend allowlist or calculation contract.

Actual 223 replay/delivery and candidate inspection remain separately authorized operational work. Camera 223's count acceptance is based on **assisted review, not human ground truth**; it does not validate count-3, completed traversal timing or physical path length. Few near-field features, shared-imagery landmark validation, unestablished aerial positional accuracy, road-plane/lens assumptions and longer turning paths remain limitations. The shared fleet mixture is an owner-approved modeling assumption; truck frame-box occurrences do not establish unique-vehicle VMT, fuel or regulatory weight class. Null linked stops withhold positive shorter-stop scenarios; supported baseline RUNEX does not require inventing stop values or adding an ordinary-idle/EV adjustment.

Core worker contract 1.1 and measurement 1.0 are unchanged. The restored 222 application continues to use its original private registry, authoritative store and credential.
