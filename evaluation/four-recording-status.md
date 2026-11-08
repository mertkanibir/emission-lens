# Four-recording execution and acceptance

**Owner:** Mert  
**Updated:** 8 November 2026, 00:45 America/New_York / 05:45 UTC  
**Checkpoint:** 8 November 2026, 01:13 America/New_York / 06:13 UTC

This matrix distinguishes source availability, model execution, visual review and scientific acceptance. A completed offline count batch does not establish accuracy or activate a camera. Raw video, detailed event ledgers, credentials and private source capabilities remain outside Git.

| Camera | Recording / coverage evidence | Current count/review status | Integration / next concrete result |
|---|---|---|---|
| 222 | Available; 17,918 decoded frames, 1,229.814 s source span including final frame duration. Existing practice and held-out reviews; other intervals not visually certified. | Carter enabled count-1. Existing human/assisted comparison limits remain; count-2 unaccepted. Full-recording baseline newly released, not yet completed. | Live job 176075 / app 3138 protected. Supported-minute estimates already demonstrated under approved 20 m/fleet/weather assumptions; incomplete totals remain null. |
| 223 | Available; 17,986 decoded frames, 1,222.421 s including final frame duration. Decoded PTS jumps around `[582.880,598.878]` and `[627.942,631.942]` s prevent a continuous-coverage claim. | Carter enabled count-1 based on assisted reference, not human ground truth. Existing two-window baseline/reviews are separate from full-recording execution. | Original-file adapter selected for 100-second practice replay into independent 3139, frozen source `b1081f19883e1950ab3c6cf28af22be41e7ec30e` and verified two-camera registry. Actual replay/measurement/preview acceptance pending. |
| 220 | Acquired once: 51,999,860 bytes, 17,670 advancing frames, 1,231.011 s; source hash `6caa25dfb47dc8d7e0305a90704a6726754018dbc8ae66ac696bbac4adc72bc6`. No decoded PTS step above 0.2 s reported by acquisition owner. Native capture UTC is unconfirmed. | Blind practice gate review is active, then held-out ledger freeze. All model/human answers withheld. Count configuration remains disabled/unapproved. | Full-recording baseline may run in private output custody after 223; release comparisons only after matching freeze and initialization/geometry alignment. Physical approval does not establish count accuracy. |
| 228 | Available; 15,438 decoded frames, 1,218.142 s including final frame duration. Reserved `[720,840)` must be skipped; full visual review remains incomplete. | Relocated count-1 practice model 80 versus 137–138 assisted candidates, approximately 42% deficit; both provisional screens fail. Coverage is partial, not human truth. Count remains unapproved. | One unchanged-baseline offline execution excluding the reservation, independent sessions before/after gap. No tuning, new candidate promotion or fresh-window access. |

Source scalar inventory: [review manifest](./video_validation/manifest.json), [223/228 acquisition and timing](./count-validation-223-228.md). The 220 acquisition is newer than the initial manifest; the review owner will publish its verified inventory update. Source durations here include final frame duration and are not wall-clock or capture-time claims.

## Exact boundaries and result receipts

- **223 media:** Derivative frame equality alone failed timing acceptance: GPU owner reports 30 omitted source frames and 591 changed adjacent deltas, with different sampler choices. Use only the verified original source adapter; preserve original PTS and estimated replay clock limitations. [App/handoff](../backend/223-HANDOFF.md), [acceptance plan](../backend/223-ACTIVATION.md). Actual execution/result receipt remains pending.
- **All-four batch:** Released after 223 frees the spare slice; actual job, bound recipe, per-camera source/decoded/sample coverage, directions/counts, gap/session treatment and cleanup receipt remain pending. No completed coverage claim is made yet.
- **220 blind review:** [Declared protocol](./video_validation/220-review-plan.md). Practice `[60,180)`, held-out `[360,480)`; freeze gate/policy before held-out and ledger before references. Whole-file baseline state may differ from the fresh-window comparison recipe and must not be silently treated as aligned.
- **228 disposition:** [Failed relocated practice comparison](./video_validation/228-relocated-practice.md). Three private missed-event spatial proposals remain unexecuted proposals. Preserve all old failures and reserved fresh interval.

No contract or scientific scope change is proposed. Whole-window unsupported emissions and positive stopped-time scenarios remain null; estimates are not measured AQI or pollutant concentration.
