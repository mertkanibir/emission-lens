# Four-camera live candidate: startup checkpoint

**Owner:** Mert
**Updated:** 8 November 2026, 01:12 America/New_York / 8 November 2026, 06:12 UTC
**Status:** Candidate job 176255 was verified running at startup and remains in progress. This is not full-run or sustained-performance acceptance.

The isolated candidate processes cameras 222,223,220 and 228 in one worker with independent model/tracker state. Actual **cuda:0** inference and live public statuses were verified during **06:10:15–06:10:28 UTC** on 8 November 2026. The run began at **06:08:22.920512 UTC**. The [safe scalar record](./four-camera-live-176255.json) binds the frozen source, recipe, startup proof and independent preview followup without publishing event IDs, per-vehicle times or private evidence payloads.

Independent longer followup verified **all four previews**: correct camera identity, three distinct sequences and JPEG contents, advancing processed/receipt timestamps and the same live run. Initial short reads repeated some 223/228 frames; the longer bounded check resolves that qualification, without establishing continuous freshness or loss-free operation.

## Scope and limits

Only **camera 222** has `count-1`, completed-movement and new linked stopped-time configuration. Cameras 223/220/228 supply genuine status/previews; their new counts and emissions remain unavailable. Current authenticated camera 222 evidence contains new completed cohorts with linked nonnull stopped observations. The new `222-context-v1-7f52d53d+stop-v1` / `222-image-stop-v1-0.0225` policy applies to these cohorts only; it does not replace historical null stopped evidence. Independent scenario arithmetic remains pending, and no savings or stopped/count accuracy claim is made.

The profile retains Carter's conditional 20 m through movement, fleet mixture and 70 °F / 60% RH assumptions. Physical scale, curved-turn eligibility and manual count/traversal/stopped-time validation remain open. Source clocks are estimated media UTC, not verified capture UTC. Startup source bursts/frame drops remain explicit; no sustained FPS, complete footage coverage or all-camera estimated-emissions claim follows.

## Provenance and lifecycle

The candidate uses pretrained **YOLO11n/640 at requested 15 FPS**, one H100 MIG 1g.10gb slice, four CPUs and 16 GiB requested memory. Worker duration is **7,200 seconds**, with a **7,560-second allocation cap** ending **8 November 2026, 03:14:15 America/New_York / 08:14:15 UTC**. Actual completion and terminal cleanup are pending.

Source commit: `b1081f19883e1950ab3c6cf28af22be41e7ec30e`; archive SHA-256: `86ef74f6ce6649729bf65e556be5666200e6d604cc25124e9ebe63ef759a7be5`. Frozen recipe SHA-256: `fbc23e647418df82f021210378bc5fd15721fd4b1c31283ef81b455846884154`; reviewed READY SHA-256: `8a9f2ea36495115717e46bdbc9104b70803fff270a7f8744824ab571bf7c174e`. Existing worker source remains pinned; the private observer records operational scalars without changing the returned worker status or scientific calculations.

Existing camera 222 live job 176075 and protected applications remain preserved. This publication did not alter jobs, applications, SSH sessions, relays, stores or registry state, and leaves the candidate running. Independent final arithmetic/consumer acceptance and a complete runtime/cleanup report remain separate checkpoints. The completed offline baseline is already recorded in [its independent audit](./reliability/four-camera-176183-audit.md).

**Final bounded startup qualification:** All four longer preview checks pass and processed counters advance. Both delivery outboxes are empty. Early reader-buffer drops were 220: 325, 222: 354, 223: 227 and 228: 194, unchanged across two retained snapshots; this is not a loss-free result. Current authenticated camera 222 evidence contains seven new traversal records, all with nonnull linked stopped values and one positive observation. The other three cameras have empty new traffic rows and unavailable new counts. Independent arithmetic and full-run acceptance remain pending. Both jobs and protected resources were confirmed alive at 06:12:19 UTC; no resource was stopped for this publication.
