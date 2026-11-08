# Final dashboard consumer acceptance

**Owner:** Mert
**Updated:** 8 November 2026, 02:26 America/New_York / 07:26 UTC
**Running web source:** `685dc72e2dab3c8be437f467ae96d2957daa99ba`
**Local application:** `http://127.0.0.1:3151` · observed application PID `65858`

The final combined source includes the strict supported-minute display, separately unavailable hour totals, latest-minute queue semantics, positive visible stopped-vehicle lower bounds, same-minute linked completed-cohort counts/stops, explicit complete-minute scenarios and phone table containment. Its worker files exactly match the published lower-bound policy revision `59d2ac7`; backend metadata/brief revision `9fe26e9` is included. The build completed with exit 0, unchanged frozen source hashes and no service credentials. Source links identify this immutable running revision rather than the current checkout.

## Source, store and registry preservation

The first isolated generation copied one atomic current-3150 store and the existing two-camera registry/token. The later four-camera registry was installed and authenticated refresh performed only on the private 3151 clone. All 617 original worker batches and 54 measurement sources/digests remained exact. Fifty-four fixed minute cohorts retained exact count, traffic, timing, quality and version data; all current evidence references returned authenticated 200, and fresh-process reads matched the refreshed public results exactly.

Old cached NOx values in ten windows differed from recomputed values by at most **8.673617379884035e-19 g** (relative baseline difference **2.920077433131202e-16**). The independent original-CARB comparison passed its disclosed tolerance. Bit-for-bit numeric identity is not claimed for that refresh, and no values were rounded in storage to hide the difference.

The actual bounded 222/223 replays finished with drained worker and measurement delivery queues before the app restart. The final combined restart preserved the **entire 735-batch / 60-measurement store byte-for-byte**, together with its token and four-camera registry; source inputs were not retimed or rewritten. The accepted old replay source/build and its receipts remain separate. See [the actual replay acceptance](../backend/STOPPED-REPLAY-222-223-176075-2.md). Production 3150, protected 3138 and accepted 3139 remained intact.

## Final production browser checks

All **65 frontend tests**, root type checks and the final production build pass. The exact running build passed **18 browser checks** before live activation:

- Supported CO2/NOx minutes remain visible beside unavailable reporting-hour totals. A linked completed-cohort zero is visible and scoped independently of general observation-hour stopped time.
- Actual heat layers render, all four camera selections and three modes retain their meanings, and unsupported cameras receive no invented values.
- Explicit complete-minute selection, 0/20/100 reduction submission, fixed bounds, invalid-selection disclosure and hour reset work. The selected-minute scenario never enters the reporting-hour brief implicitly.
- A real 222 replay selected minute renders its supported values. The actual local brief download matches the exact rendered draft text.
- Desktop 1440 px, phone 354 px and narrow phone 322 px pages retain their viewport widths. Tables scroll independently; menu Enter/Tab/Escape and focus restoration work. The phone header retains its status control.
- Positive lower-bound presentation is verified with the visibly labeled synthetic sample, and zero/null distinctions have semantic tests. Licence and immutable source links match the running build.

The original phone check exposed an accessible table-header label escaping its scroller. The one-line positioning fix was verified in a separately frozen build; the final checks use the actual built CSS without stylesheet injection. No JavaScript page errors occurred. The observed missing/expired preview 404s were confined to preview endpoints after a process restart or completed replay, with honest unavailable UI states.

## Actual new LIVE consumer evidence

The final candidate serves **222 and 223 only**, run `c8c01fee-6fcf-4306-8e4c-3f95fb63305e`, started at **07:17:39 UTC**. Both cameras supplied three different advancing real images with their LIVE labels and matching new-run delivery identities/sequences. Both camera views showed supported pollutants and their linked completed cohorts; completed-minute scenarios were read from the new run. The user-facing browser switch to 3151 was separately confirmed. Isolated test contexts were closed; the stable app, worker and operational watchers remain running to their existing bounds.

At **07:24 UTC**, one atomic rendered observation per camera confirmed two supported live heat points and the exact running-source link:

| Camera | Visible queue observation | Supported emissions minute and linked scope |
|---|---|---|
| 222 | No latest queue observation; no older positive substituted | 07:22 UTC · 4.2 g estimated CO2 / 0.000768 g estimated NOx · one completed movement vehicle · supported linked stopped time 0 vehicle-s |
| 223 | **At least 2** visible stopped vehicles, 07:23 UTC · explicit provisional image-area/motion lower bound | 07:23 UTC · 16.2 g estimated CO2 / 0.003195 g estimated NOx · six completed movement vehicles · supported linked stopped time 0 vehicle-s |

The earlier 222 07:18 UTC source cohort contained a supported **0.133 vehicle-s** of linked stopped time. The independent current-generation backend audit checked its source linkage and original-factor calculations. No positive emissions benefit is claimed: the audited 20% hypothetical reductions kept the same pollutant bins and returned zero gram changes. General observation-hour stopped totals remain separate.

Cameras 220/228 have no new worker stream or quantities on this application and retain their actual inherited stale/unavailable states. They are not counted as freshly served cameras. The separate original 3150 application retains its earlier all-four preview scope.

A later full-live harness assertion sampled queue text, awaited an accessible label, and crossed an automatic refresh between those reads. That failed harness assertion is retained. The final queue proof reads text and label atomically and passes for the actual unknown 222 and positive lower-bound 223 observations; no application code changed to obtain that result. The final live phone capture remains exactly 354 px wide.

## Evidence and limits

Private durable pointer: `runs/frontend-shadow/20261108T071240Z/ready.json`. Siblings contain the build/source/restart receipts, immutable before/after store snapshots, `browser-checks/result.json`, the exact downloaded brief and `live-candidate/final-proof.json`. The best actual LIVE dashboard screenshot is `live-candidate/223-actual-live-overview-final.png`; `222-actual-live-phone-metrics.png` records the phone. Actual advancing camera images and scoped scenarios are retained privately in that same directory. No raw frames, credentials or private session/traversal identities are committed.

This is startup and consumer-path evidence. It does not establish sustained or loss-free operation, crossing/stopped-time field accuracy, an independently measured physical queue, source capture UTC, measured air quality or real environmental savings. Distances, fleet mixtures and weather inputs remain explicit modeling assumptions. Queue bounds use provisional image-area/motion evidence; unsupported zero remains unknown. Replay/synthetic data remain separate from live totals. Shared hosting, longer reliability evidence and broader scientific acceptance retain their existing limits. No further optional source changes or service restart were made after final live activation.
