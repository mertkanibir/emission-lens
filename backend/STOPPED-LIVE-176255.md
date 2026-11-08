# Actual live stopped-policy checkpoint — job 176255

**Owner:** Mert  
**Updated:** 8 November 2026, 01:16 America/New_York / 06:16 UTC  
**Status:** Partial acceptance. Frozen source linkage, retained-history preservation and independent estimated-emissions arithmetic pass. Current live HTTP evidence acceptance remains unverified after the final assertion failed. No further retry or runtime change was made.

## Scope and verified evidence

The separate candidate on **http://127.0.0.1:3150** uses source `b1081f19883e1950ab3c6cf28af22be41e7ec30e`, UI `87b7dd6`, registry SHA-256 `7ed03ca706bd8b674d14b6459ce697f818574ab93a07a8d13f29201c5ecab85a`, and the exact replacement 222 traversal policy SHA-256 `6ffbac2983c8f2d465b2495a3d2238aaa7fd7c679776277b69f71ac607234b36`. Its literal stopped-image threshold is **0.0225**; it was not replaced by the fitter's unrounded value. Carter supplied this policy; its in-sample fit is not independent stopped-time accuracy.

Job **176255** supplies actual live frames for four cameras through one worker. Only **222** produces new measurement contributions; 223/220/228 supply status and previews. The [independent browser acceptance](../frontend/LIVE-CAMERAS.md) records three advancing sequence/time/image samples for every camera and actual LIVE scenes, including recovered 220. This does not enable additional camera metrics or accept sustained operation.

The frozen **06:12 UTC** candidate snapshot has SHA-256 `aa7c10c9944d0babe3d651a53204460c7d6a40963455d52812c85d4991df8033`. All **192 original worker entries and 18 original measurement entries** from accepted 3139 remain identical, including their sources, revisions and derivations. Four new measurement entries add nine completed candidates. Each observation reference matches the stored worker revision, run, camera, mode and UTC instant; the dependency digests agree. Session anchors, media durations, completion times, bounded stopped durations and server-resolved **20 m** distances agree.

A fresh Node process successfully validates the frozen snapshot and recalculates each new cohort's 20% hypothetical shorter-stop scenario. An independent calculation from the original CARB CSV matches the retained baselines and scenario results within relative `1e-12` / absolute `1e-14` tolerance. It applies the existing class mixture and upper-edge speed bins to each traversal, with hypothetical duration `duration − 0.2 × stopped_time`. No separate ordinary idle or extra EV adjustment is added.

| UTC minute | Completed candidates | Stopped times (s) | Estimated baseline CO2 (g) | Estimated baseline NOx (g) | Hypothetical 20% change, both pollutants (g) |
|---|---:|---|---:|---:|---:|
| 06:08 | 3 | 0.066, 0, 0 | 17.546574344115356 | 0.002970338142911267 | 0 |
| 06:09 | 2 | 0, 0 | 7.853272210574367 | 0.001485168500741833 | 0 |
| 06:10 | 2 | 0, 0 | 11.697716229410238 | 0.001980225428607511 | 0 |
| 06:11 | 2 | 0.067, 0.067 | 10.009171862688053 | 0.001758433718679711 | 0 |

The three positive stopped values and six supported zeros are preserved. All selected hypothetical speeds remain in their baseline factor bins, so **zero gram change is supported**. These are hypothetical cohort calculations, not measured savings or air quality. Legacy unknown-stop records remain intact; separately observed full-window scenarios remain unavailable.

## Failed verification and exact boundary

The first private-checker failure was line 14: it compared `...06:08:00+00:00` with `...06:08:00.000Z` as strings. Comparing parsed UTC instants corrected this checker error on the same frozen snapshot; the linkage and independent arithmetic checks then passed.

The final checker stopped at **line 53, `assert current_refs > 0`**, with **zero** current evidence responses. All four frozen references returned **HTTP 404** against the advancing live application. The check therefore did **not** establish authenticated current same-generation evidence or equality between the running HTTP response and a fresh reload. It does not demonstrate a runtime or arithmetic defect. No retry, new application, replay or profile change followed this result.

The final run did not reach its later public full-window-null, other-three-empty, process-ID or preview-watcher assertions. Those observations from other checkpoints must remain separate from this partial audit. [The scalar result](./stopped-live-176255-result.json) records the exact outcome. Private frozen snapshot, registry, fresh-process scenario output, checker and partial result are retained under `runs/stopped-live-candidate/20261108T060206Z/`; credentials and traversal identities are excluded from publication.

## Runtime handoff and remaining limits

- Candidate app **3150 / PID 29506**, supervisor **29505**, owns its independent store and server-side credential. Private `ready.json` identifies all paths. No server on 3160 was created.
- Worker bound is **7,200 seconds**, starting around **01:08 America/New_York / 06:08 UTC**. Scheduler allocation ends **8 November 2026, 03:14:15 America/New_York / 08:14:15 UTC**. Capacity, source and network limits can end it sooner; no two-hour availability guarantee is made.
- Mert's continuing GPU/operations ownership retains the candidate relay/guard and existing SSH master. Healthy jobs/apps remain running to their recorded bounds. Protected live job **176075**, app **3138 / PID 3943**, and accepted replay app **3139 / PID 14481** were not stopped or modified. This audit did not recheck those process IDs after its final failure.
- Current HTTP/reload acceptance, independent stopped-time accuracy, sustained throughput, reconnect recovery and final job completion remain open. Images cannot establish whether engines are running. The 220 count failure, 228 restrictions and protected fresh interval are unchanged. No contract, approval, hosted-store, production-runtime or scientific-method change is proposed or applied.

**Publication note (8 November 2026, 01:16 America/New_York / 06:16 UTC):** Mert publishes the verified frozen results and the failed live-evidence assertion together. The runtime acceptance remains partial; this documentation checkpoint does not convert a failed check into a pass. The completed [223 replay acceptance](./223-REPLAY-176174.md) remains a separate result.
