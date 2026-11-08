# Brief availability and registry approval

**Owner:** Mert

**Updated:** 8 November 2026, 00:40 America/New_York / 8 November 2026, 05:40 UTC

**Status:** Backend correction and private snapshot reproduction pass. Running applications retain their frozen builds until separately rebuilt; live application 3138 is unchanged.

## Problem and correction

When replay observations aged outside the rolling hour, the brief and investigation ranking could say “Camera calibration is not valid” despite the actual server registry approving camera 222 for that mode and time. The shared emissions reader consulted static package calibration metadata for empty windows, so unavailable window data was incorrectly described as failed approval.

Mert coordinated the narrow change to `backend/src/queries.ts` and `backend/src/brief.ts`. An empty emissions window now resolves the actual registry using the supplied read clock. A single applicable approved calibration produces this explanation:

> No estimated-emissions records are available in this reporting window. Camera calibration is approved for this mode and time; completed traversals and a documented class mapping are still required. This is not a zero.

The ranking asks for current-window queue/traversal evidence rather than instructing the user to revalidate an already approved calibration. All brief reads share one clock. Empty-window estimates remain null and quality remains unavailable. Current registry approval does not override an actual calibration-invalid record. Missing, malformed, pending, expired, future, wrong-mode and ambiguous approval do not gain approved wording or numerical estimates.

## Verification

- `npm test -w @emission-lens/backend`: all 115 tests pass, including ten focused availability/approval checks in `backend/test/brief-availability.test.ts`.
- `npx tsc -p backend/tsconfig.json`: passes.
- A private byte copy of the frontend-review snapshot/registry reproduces the exact before/after condition at 8 November 2026, 05:36 UTC: approved registry, zero replay window rows, null CO₂/NOₓ, unavailable quality. Before the change the brief falsely says calibration invalid; after the change it explains missing window evidence. Registry result and snapshot hash are unchanged. Raw snapshot and response bodies remain private.

No approval checks, calculations, factors, contracts, status timeout policy or scientific assumptions changed. No worker/GPU job, production restart or active registry/store write occurred. Consumer verification on a rebuilt isolated frontend is handed back to Mert; this checkpoint does not claim a live rollout.
