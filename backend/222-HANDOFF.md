# Camera 222 registry and runtime handoff

**Owner:** Mert
**Updated:** 8 November 2026, 00:09 America/New_York / 8 November 2026, 05:09 UTC
**Status:** Consolidated production app restored on loopback port 3138 using the existing authoritative store, approvals and credential. Startup acceptance passes; genuine advancing live-worker/preview acceptance is with the GPU operator. Earlier bounded evidence remains retained without changing timestamps or unavailable values.

## Production restoration — 8 November 2026, 00:09 America/New_York / 05:09 UTC

Mert restored **one production Next application at `http://127.0.0.1:3138`** after the prior 3138/52623 services stopped. The overview, camera pages, authenticated `/api/worker`, `/api/measurements` and `/api/frames`, and public frame GET now belong to the same Node process. Preview memory is process-local; all worker endpoints must use the same forwarded application base. Sharing only the aggregate file between separate applications does not share preview frames.

The successful production build pins source `7b5818f923dab43815ffd7f74fb2ec9c9ee6c5d3` in the durable ignored workspace `runs/production-3138/20261108T050617Z/workspace/`. Installed dependencies were copied locally and workspace package links resolve inside that frozen tree. Build execution had no service credential or private registry/store environment. Shared `frontend/.next` was not rebuilt. Runtime injects the existing private worker token, approved registry and authoritative `runs/222-approved-handoff/staged-runtime/store.json`; no replacement data or approval was generated.

Private `runs/production-3138/ready.json` is the current ready handoff. It records the dashboard/worker/measurement/preview URLs, geometry/traversal configuration, source revision, runtime receipt, process ownership and secure existing `worker.env` path. The original token line is preserved; local worker URLs now point to 3138. `staged-runtime/connection.json` points to that ready handoff, and its old GPU handoff is explicitly superseded. The new SSH control path is `/Users/mertkanibir/.ssh/emission-lens/control`; its master check passed. Mert notified the GPU operator directly after readiness; backend restoration launches no GPU job.

Startup checks return HTTP 200 for overview/live/replay pages and approved measurement reads. Worker/measurement/preview routes reject unauthenticated payloads with 401 and authenticated malformed payloads with 400 without changing the store. Retained private calculation evidence remains authenticated and current. The store and registry hashes remain unchanged, and the token is absent from public static assets and checked HTML. A single PID listens on 3138. Preview GET correctly returns unavailable until genuine frames arrive. Old observations have aged out of the rolling hour naturally; retained source timestamps are unchanged.

The initial per-user launchd attempt exited `EX_CONFIG` before listening or opening logs; Mert removed that job. A detached private supervisor now owns the one production child and restarts it on exit. Its live ownership is recorded in the private launch/process receipts. The durable build folder must remain present. This is local process supervision, not a shared hosted deployment or an installed reboot/login service. Ports 3000 and 52623 had no listeners at restoration and no unrelated process was stopped. Advancing new GPU heartbeats, genuine same-process preview delivery and subsequent live ingestion remain operational acceptance checks; existing scientific limitations below still apply.

## Approval, input identity and scope

Carter's private registry `222-first-camera-2026-11-08T03:19:55Z` explicitly approves calibration `222-ground-esri-v1-7f52d53d8fc8`, movement `222-eastbound-through` and mapping `pretrained-visual-to-emfac2007-v1` for live/replay. It names **Carter**, review time **8 November 2026, 03:19:55 UTC**, and evidence references. These are supplied owner approvals; this handoff neither manufactures nor overrides them and requires no additional Mert approval for the isolated software demonstration.

The actual registry passes `parseRegistry`; its movement gate references, gate endpoints, 20 m distance, transform and class weights match the retained proposal. Preparation rejects a different or reversed approved gate pair even when the movement name/distance are unchanged. The actual mapping-linked config passes `TraversalBridge.from_config` against `222-image-v4`. Entry is `count-3` negative; exit is `count-1` negative. The original pending config has null mapping; it remains a separate negative profile. Both have null stopped observation and explicit fixed **70 °F / 60% RH** assumptions, not observed weather.

Private source copies came from extracted/normalized attachment text. Their hashes identify those copies, not byte-identical original email attachments. No private registry, credential, source email ID, footage or model file is committed. Geometry byte hashes remain exact: local LF `ab1b684086ce1d2543bba2c9df41748aad8e2c8af4ce164c9e2dbbd95188e674`; the CRLF representation matches Carter's declared `6f541639f5bfd24b061a8281f04cff7d033c77ee5909e316c76ea339523e222a`. Files are not rewritten to make those hashes agree.

## Evidence interpretation

[The movement proposal](../evaluation/calibration/222-movement-eastbound.json) and [correspondences](../evaluation/calibration/222-road-plane-correspondences.json) supply dated camera/view context, a pixel-to-ground-metre transform, georeferenced imagery/latitude conversion, 10 fit pairs and 5 held-out pairs. Recalculation from retained rounded coordinates gives fit RMS **0.821162 m** and held-out RMS **1.411190 m**, consistent with the reported 0.821 / 1.411 m. The reported held-out maximum is 2.343 m. The retained 19.33–20.51 m leave-one-out range is a sensitivity result, not a confidence interval.

The held-out landmarks are independent of fitting, while sharing the imagery source. This supplies meaningful calibration evidence beyond finite matrix arithmetic. Plan.md asks for independently supported scale, suitable road-plane assumptions and validation; it does not prescribe LARIAC by name or a new numeric cutoff. Carter's stated independent scale comparison remains unperformed. An unchanged-landmark/source-uncertainty review or a justified alternative can address that limit; the existing owner-approved estimate can be demonstrated with its assumptions disclosed. The [LA County service](https://public.gis.lacounty.gov/public/rest/services/LACounty_Cache/LACounty_Aerial_2013/MapServer?f=pjson) describes 2013 imagery, so changed paint must not be treated as unchanged control merely because its coordinates exist.

The important coverage limit is **movement eligibility**: both gates/directions can admit north-left turns on longer curved paths. The fixed 20 m through-path assumption is not guaranteed for every admitted track. Actual replay must inspect completed candidates and ambiguous/turning paths before claiming through-only field acceptance. The software demonstration is conditional on that fixed-path assumption. No new accuracy criterion or geometry edit is introduced here. Completed traversal timing has not been manually validated; stopped evidence remains null.

[The class proposal](../evaluation/calibration/class-mapping-v1.json) fits the retained catalog and each weight set sums to one. Its truck counts are **58 frame-box occurrences** (41 pickup, 13 box truck, 4 tractor-trailer) in 60 frames, not deduplicated completed vehicles or measured VMT. Equal distance implies count share equals VMT share only for an eligible unique traversal cohort; it does not establish that a frame-box sample is such a cohort. Regulatory pickup/box-truck weight subdivisions, car sedan/SUV mixture and bus category are modeling assumptions. Carter approved their use as assumptions; no measured regional fleet composition or independent fuel/weight identification is claimed. Classifier error is separate. Unknown and fine-tuned pickup/box-truck/tractor-trailer/Tesla labels receive no silent aliases. Fuel-aggregated factors receive no extra EV discount.

## Reproduce private preparation

From the repository root, using existing private extracted attachments and a Python runtime able to import the worker:

```bash
node --import tsx backend/scripts/prepare-222-profile.ts \
  --directory "$PWD/runs/222-approved-handoff" \
  --traversal-config "$PWD/data/raw/calibration-mail/222-endtoend-222-traversals.json" \
  --approved-registry "$PWD/data/raw/calibration-mail/222-endtoend-registry-222.json" \
  --mapping-proposal "$PWD/evaluation/calibration/class-mapping-v1.json" \
  --python /private/path/to/verified-python
```

The supplied approved registry/config are copied byte-for-byte from the extracted files after validation; approval values are not rewritten. Geometry is copied with its raw hash. The manifest retains source/derived hashes, assumptions and recomputed statistics; the mapping basis is retained separately. Existing differing files are never overwritten—use a new private directory for a changed input. Preparation does not edit `.env.local`, start inference or change the active application.

Omitting `--approved-registry` and using the original `222-traversals-extracted.json` creates the separate pending/null-mapping profile. It cannot activate physical output. An optional mapping proposal is numerically validated and retained as unapplied pending assumptions. Core worker 1.1 and measurement 1.0 are unchanged.

## Isolated software proof and actual replay invocation

```bash
python backend/scripts/check-222-handoff.py --profile runs/222-approved-handoff
python backend/scripts/check-222-handoff.py --profile runs/222-pending-handoff-v3
```

These commands use controlled trajectories through the actual geometry, producer, durable publisher, authenticated backend handlers and private store; they are **not actual video inference**. Each starts only its own loopback service, injects one lost acknowledgement, verifies exact retries/private evidence/mode isolation, restarts its service and compares retained calculation content. Reporting clocks legitimately advance across restart. Both positive and pending checks pass.

Under the source-approved record, the controlled 20 m candidate yields baseline estimates, a zero-change scenario reproduces them, and a positive shorter-stop scenario remains unavailable with null stopped evidence. Under pending approval, counts and candidate duration persist while physical distance/speed/emissions remain null. No fixture approval is installed.

For the bounded local CPU replay after scheduling is cleared:

```bash
python backend/scripts/check-222-handoff.py \
  --profile runs/222-approved-handoff \
  --replay-file data/raw/measurement-review-clips/222/222_20261108T003312Z.ts \
  --weights /private/existing/yolo11n.pt --seconds 30
```

This path requires existing media/weights, performs no downloads and checks the previously verified YOLO11n SHA-256 `0ebbc80d4a7680d14987a577cd21342b65ecfd94632bd9a8da63ae6417644ee1`. Runtime settings are 640 pixels, 15 requested FPS, count-1, actual mapping-linked traversal config, CPU and separate private replay outboxes. It records clip/model hashes and actual runtime diagnostics. This optional CPU path was not run; the scheduled GPU path below supplied the actual-video evidence.

For the scheduled GPU replay, the private `staged-runtime/gpu-handoff.json` records exact input paths/hashes, replay arguments, separate live arguments and loopback relay requirements. [The current coordination decision](../Coordination.md) authorizes **90 seconds paced replay**, followed by **60 seconds live only after persisted counts, a completed traversal and baseline CO₂/NOₓ are verified**. This supersedes the initial 30-second preparation example. The separate staged application and `worker.env` are private; credentials never go into chat or Git. The GPU owner provides its secure reverse-loopback endpoint, sources the private token and uses the existing verified weights. Live uses fresh `outbox-live`/`live.json`. Do not overlap the 228 allocation or merge replay into live totals.

Read `GET /api/measurements?camera=222&mode=replay|live`. Registry refresh is the existing authenticated **POST** `/api/measurements/refresh` with `{}`; no GET mutation is added. Authenticated evidence remains private. The active original server is not restarted or reconfigured by this handoff. The staged application reuses an existing production build; current source-only disclosure changes await the coordinated application build.

## Final retained GPU evidence

Mert's GPU job **175979** completed the 90-second replay followed by gated 60-second live check and released its allocation. Both outboxes drained. Replay retained **30 crossings / 8 completed candidates**; live retained **17 / 4**. These are bounded software/run observations, not manually validated traversal accuracy. No additional GPU run or training was started by the backend preparation.

The final snapshot has **two minutes in each mode**: one ready minute and one with no completed cohort. Consequently **both default whole-window CO₂/NOₓ baselines remain null**, including at zero scenario reduction. Do not publish a partial sum as that whole-window estimate or replace an unavailable minute with zero.

The supported minute estimates alone are:

| Mode | Supported minute, America/New_York / UTC | Completed candidates | Estimated CO₂ (g) | Estimated NOₓ (g) |
|---|---|---:|---:|---:|
| Replay | 7 Nov 22:58 / 8 Nov 03:58 | 8 | 35.7414593755 | 0.00653373649243 |
| Live | 7 Nov 23:00 / 8 Nov 04:00 | 4 | 17.3452620771 | 0.00316184409416 |

Replay's 03:59 UTC tail and live's 03:59 UTC minute are insufficient evidence. The numbers above depend on the fixed 20 m movement/fleet/weather assumptions already described; they are not full-intersection emissions. Linked stops remain null and all positive shorter-stop scenario grams/changes remain null. Zero reduction reproduces baseline only within the supported single-minute slice.

At **7 November 2026, 23:02:44 America/New_York / 8 November 2026, 04:02:44 UTC**, a fresh process validated a frozen copy of the actual final disk snapshot against the running HTTP views, authenticated every private evidence reference, checked ended worker metadata and separate run identities, recalculated each contribution and checked totals against its ready minute. Floating-point comparisons allow at most `max(1e-14, abs(retained) × 1e-12)`; they do not alter persisted values. The source snapshot stayed unchanged throughout the check. Snapshot SHA-256: `2f6de55fdf2fd9e5ce75ea52d1fa2a1c3a300b4f854df000defd506f3572cec0`.

Private artifacts are under `runs/222-approved-handoff/staged-runtime/acceptance/2026-11-08T040244028Z/`. Its `store.json` and `registry.json` are the **full** cloned records for UI review, preserving both unavailable minutes. The separate `supported-minute-replay/` and `supported-minute-live/` snapshots select only the named ready minute and its unchanged linked observation record. Their exported drafts explicitly identify that evidence slice and its excluded unavailable minutes; they are not a replacement default store. Both full-window unavailable briefs and scoped numerical briefs trace their actual references, disclose assumptions, contain no session/traversal identities and were returned byte-for-byte by the existing `POST /api/brief` attachment route. Nothing was sent externally. Private `verify-final.mts` and `result.json` retain the check and scalar receipt.

## Verification and remaining acceptance

Six focused backend tests cover candidate preservation, view/gate drift, pending withholding despite finite/valid flags, independent counts across retraction, mapping weights/unapplied assumptions and CLI rejection of approved movement gate-pair drift. The full backend suite passes **105 tests**; backend and explicit script TypeScript checks and Python compilation pass. Actual approved preparation reruns idempotently without changing supplied bytes. Controlled approved/pending HTTP checks include exact retry, lost-acknowledgement recovery, authorized/private evidence, no live contamination and durable reload. Actual replay/live delivery and the final retained-evidence/export checks now pass at bounded scope. Independent scale/manual traversal/candidate-path review, linked stopped evidence, forced live outage/reconnect, sustained operation and the coordinated current-source UI build remain open. Parser success and GPU delivery do not establish field accuracy.
