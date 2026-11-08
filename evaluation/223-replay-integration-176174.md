# Camera 223: completed bounded replay integration

**Owner:** Mert
**Updated:** 8 November 2026, 00:53 America/New_York / 8 November 2026, 05:53 UTC
**Status:** Isolated GPU replay completed with delivery drained. Final independent arithmetic/private-evidence/reload review remains a separate checkpoint.

Mert ran the authorized original-source camera-223 replay through the existing GPU worker, authenticated isolated backend and replay dashboard. Job **176174** completed **0:0 in 1m51s** with actual **`cuda:0`**, a zero worker return code and no worker failure. The [scalar record](./223-replay-integration-176174.json) binds source, profile, original media, adapter, execution and the retained public-view snapshot. This is a software integration milestone, not new count or physical-calibration acceptance.

## Actual processed interval and output

The exact-file adapter admitted only original source **[60,180)** and retained the original decoder media clock. The **100-second wall run** actually processed **60.061 through 148.053 source seconds**: approximately **87.992 seconds**, not the entire 120-second allowed window. One session kept and processed **1,319 frames**, with **zero reader-buffer drops**.

| Result | Observed value |
|---|---:|
| Selected `count-1` crossings | 93: 91 car, 1 bus, 1 truck |
| Completed traversals | 26 |
| Legacy batches delivered / pending | 35 / 0 |
| Measurement batches delivered / pending | 18 / 0 |
| Previews sent / failures | 28 / 1 |

The preview failure is retained; it did not fail the worker or leave aggregate batches pending. Median/p95 tracking wall-time diagnostics were **24.05/25.99 ms**. This bounded snapshot does not establish sustained throughput, complete source coverage or counting accuracy.

A retained 200 HTTP public-view snapshot contains one ready minute and one insufficient-evidence minute. Supported `ok` emission rows alone sum to **71.496669 g estimated CO₂** and **0.014042455 g estimated NOₓ**. These sums exclude unavailable rows and are not whole-window or all-traffic totals. Full-window baseline/scenario values are null; linked stopped evidence is null, so no positive shorter-stop savings are available. Independent final arithmetic, authenticated private-evidence, reload and retained camera-222 clone-invariance review remain with the separate consumer checkpoint; no such final pass is claimed here.

## Source and scientific limits

Replay used the original camera-223 TS file, SHA-256 `808476414ca24d93f3190bb4a315a8fcbefe807c18c5e4f527d115a1ba89d2a0`, with the private exact-file adapter only. CPU preflight on **OpenCV 4.12** matched all **1,800 original timestamp/frame-hash pairs** for the allowed window. That local proof is not a cross-version decoder-equivalence claim. A derivative was rejected before inference because pixel matches did not preserve timing and 30 original frames were missing from its checked [60,150) interval. No derivative inference or duplicate integration job was run.

Copied worker source is pinned to **`b1081f19883e1950ab3c6cf28af22be41e7ec30e`**, archive SHA-256 `6c044ddb894f121ae34d7ff9206e4f2dcf546ba385acb19521b34807280b5457`. The adapter SHA-256 is `0af709c64c4ed31deb4d8f836b9b2f63f0941d8c9572131f5b2d3671a2a6844e`; entry SHA-256 is `f1abeee36aebcd1e1227b47c57c0003f97976123b2b868754b03e804cd6ee97e`. Frozen recipe SHA-256: `2c9edaf2c93f715d6d908c9c98e3f9c190b32ee6a1285e91ea2850aac68a2475`; final report SHA-256: `c6fa5a9bcd2404f79b01472bec1743482ef2fc4d3646afb1d03368459a8b1404`.

The unchanged pretrained YOLO11n/640 at requested 15 FPS profile uses `count-1`, calibration `223-ground-esri-v1-34782d640860`, mapping `pretrained-visual-to-emfac2007-v1` and Carter's fixed **15 m** `223-southbound-through` movement. Fleet mixture and **70 °F / 60% relative humidity** are conditional assumptions. This job did not independently validate movement eligibility, scale, fleet composition, weather or count accuracy. Playback timing is estimated media UTC, not capture UTC.

## Cleanup and remaining review

After the job was terminal, Mert cancelled only its owned camera-223 login forward. Compute exit closes its own relay and removes its remote credential copy. The isolated camera-223 application remains available for review; camera-222 live job 176075, its production application, guard, idle-awake process and SSH session were preserved. No application restart, registry refresh, store alteration or extra inference was part of this publication. This job used the approved two-camera registry and did not activate a four-camera registry.

Remaining acceptance is the consumer's final persisted arithmetic/authentication/evidence/reload/isolation review and independent physical/count validation. No emissions are substituted with zero for unavailable cohorts. Private IDs, per-vehicle event times, evidence payloads, media, credentials and credential paths stay outside source control.
