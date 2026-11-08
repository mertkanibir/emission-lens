# Registry candidate review and frozen replay selection

**Owner:** Mert
**Updated:** 8 November 2026, 00:41 America/New_York / 05:41 UTC
**Status:** Later four-camera registry validates and is retained privately for review. Existing two-camera candidate remains frozen for the independent 223 replay; nothing is installed or submitted by this review.

Carter's later supplied registry revision is `220-222-223-228-2026-11-08T05:15:18Z`. The complete connector text was normalized from CRLF to LF before retention. Its extracted-file SHA-256 is `5d0f07f9995c42c97116961958b3f34d077bbfa52756ec715726f8ec8142b638`; this is **not an original MIME-attachment byte hash**. Strict `parseRegistry` passes, with canonical digest `4e33b28bcb3738e5ff8a2c83d6d4348350cb4eb2d987d2564270f623d40fa735`.

The full camera-222 and camera-223 calibration records and shared mapping record are semantically identical to the prepared two-camera registry. Camera 222 also matches the original active single-camera record. The only registry-level changes are the global revision and added 220/228 calibrations. Exact current gate endpoints/directions, matrices, movement gate references and distances match their public source documents for all four cameras.

| Camera | View / calibration version | Registry movement scope | Separate image-count state |
|---|---|---|---|
| 222 | `222-image-v4` / `222-ground-esri-v1-7f52d53d8fc8` | Existing 20 m eastbound movement, unchanged | Existing enabled/reviewed image path; active app unchanged |
| 223 | `223-image-v2` / `223-ground-esri-v1-34782d640860` | Existing 15 m southbound movement, unchanged | Enabled by Carter with explicitly assisted reference; not human ground truth |
| 220 | `220-image-v2` / `220-ground-esri-v1-d2c4e9781c94` | Added away/toward movements, 12 m each | Configuration remains disabled/unvalidated |
| 228 | `228-image-v3` / `228-ground-esri-v1-a2654998e413` | Added away/toward movements, 20 m each | Configuration remains disabled/unvalidated; failed count review is not overridden |

Physical registry approval does not authorize count acceptance, camera enablement, inference, implementation or blind-reference access. In particular, 228's movement spans only part of the counting-line lane coverage; rightmost-lane vehicles cannot complete those movements. No claim of full count/cohort coverage follows from the fixed distance.

The 220 version suffix does not match either the current LF correspondence-file hash (`af08c5c0b1b98438f6c9706923bd09f376c89c7a6db9a386c921cab8d3d5c230`) or its CRLF representation (`b46cd453b40357e97c3cf630b2d9dac1cab24eb380acc00a4941ac2d5e15db5b`). Its actual matrix/gates/movements match the public source. Preserve this supplied version as opaque source provenance; do not invent a hash match, rewrite the approval or call the physical matrix mismatched solely because of that suffix.

The private review pointer is `runs/registry-candidates/latest.json`, retaining the exact extracted registry, source identities/hashes and per-camera comparison. No raw mail, model/human count reference, blind ledger or video was read for this comparison. No stopped-observation policy is added; prepared 223 still has null linked stops and explicit fixed weather/fleet assumptions.

## Frozen independent 223 recipe

The selected candidate remains **`222-223-2026-11-08T04:03:40Z`**, exact returned-text registry SHA-256 **`7ed03ca706bd8b674d14b6459ce697f818574ab93a07a8d13f29201c5ecab85a`**. Its unchanged 222/223 inputs have passed cloned refresh/rollback, compatible UI and [actual replay acceptance](./223-REPLAY-176174.md). The independent app on 3139 remains frozen to source `b1081f19883e1950ab3c6cf28af22be41e7ec30e`, including UI `87b7dd6`. The final media recipe selects the unchanged original file plus adapter, 100 s wall / allowed source `[60,180)`; the rejected derivative is preserved only as provenance. Exact arguments/hashes remain in the private ready/final recipe.

`runs/223-replay-runtime/20261108T052843Z/frozen-candidate.json` records this explicit selection and the later registry review. Mert's root coordination still controls job release. Keeping the already verified narrow candidate avoids changing a recipe solely to add cameras outside this replay's scope; it does not invalidate Carter's later physical approvals. No new build or repeated refresh check is performed by this review.

The later revision remains a separate future installation candidate. It changes the global registry digest, invalidating cached derivations even for identical 222/223 inputs. Current UI `87b7dd6` intentionally falls back for this unknown revision. Selecting it later therefore requires exact UI revision compatibility, a separately frozen recipe and isolated refresh/reverification before installation. Do not overwrite the active 222 registry or quietly replace the prepared 223 recipe from an email subject alone.

## Source and concurrent implementation boundaries

A running-source link must name the immutable `source_commit` in that application's private launch receipt, not the current checkout or branch. Live 3138 uses `7b5818f923dab43815ffd7f74fb2ec9c9ee6c5d3`; isolated 3139 uses the frozen revision above. The server-only `EMISSION_LENS_WEB_SOURCE_REVISION`, implemented separately in UI `acee09c`, should be passed explicitly from that receipt by a compatible future launcher/build. Missing/invalid metadata must produce a generic repository link without claiming a running version. This review changes no link or service.

Back-End — 1's separately assigned missing-window brief/ranking wording fix was published as `03ad2daa327e5f266f2ac0006d2716b25a656d5c`, with 115 backend tests/type checks reported passing. Those source paths have no overlapping edits from this review; existing frozen applications are intentionally not rebuilt for it. The proposed five-minute heartbeat-offline policy is still a product-policy proposal, not an implemented status change. A later implementation needs distinct timeout/report wording and explicit boundary, skew, recovery and mode tests; current live behavior remains unchanged.
