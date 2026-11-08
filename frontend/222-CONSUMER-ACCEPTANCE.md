# Camera 222 — actual-record dashboard check

**Owner:** Mert

**Updated:** 7 November 2026, 23:13 America/New_York / 8 November 2026, 04:13 UTC

**Result:** Bounded consumer verification and the two demonstrated snapshot/history display fixes pass. No new flow, data-contract or scientific-input change.

## Source and isolation

This check uses actual replay/live records from GPU job **175979**, after job completion, drained delivery queues and engineering's final reload/evidence verification. It uses Carter's actual approved registry, not a controlled physical fixture. The frozen source bundle is the ignored `runs/222-approved-handoff/staged-runtime/acceptance/2026-11-08T040244028Z/` described in [the backend handoff](../backend/222-HANDOFF.md).

The complete snapshot was copied byte-for-byte, including worker and measurement batches. Snapshot SHA-256: `2f6de55fdf2fd9e5ce75ea52d1fa2a1c3a300b4f854df000defd506f3572cec0`. Registry SHA-256: `e244d2633ff6c59ff7446c991486fffcf01a2638cdfccd46fc4b27953bf273f9`. All copied store/registry hashes remained unchanged after the checks. No worker token or source environment file was copied into the consumer application.

The earlier temporary build had been cleaned up. An isolated production build was therefore recreated without touching shared generated files, then rebuilt with this checkpoint's snapshot/history fixes. It uses the published read path and the accepted consumer patch; concurrent map/overview work is separate and not included. Separate loopback listeners used the existing absolute store/registry settings: port 3137 for the full snapshot, 3138 for engineering's explicit replay-minute slice, and 3139 for its explicit live-minute slice. The latter two are separate scoped checks, never substitutes for the full window. Original timestamps and approvals were not rewritten. No historical/minute selector exists in the public UI.

## Complete snapshot

| Mode | Crossings | Original measurement cohort | Whole-window CO₂ / NOₓ | Final camera state |
|---|---:|---:|---|---|
| Replay | 30 | 8 | Unavailable / unavailable | Offline |
| Live | 17 | 4 | Unavailable / unavailable | Offline |

The cohort values appear in the completed-cohort disclosure. The separate general completed-traversal aggregate remains unavailable; its headline was not replaced with the measurement cohort. Each mode has two measurement minutes: one ready minute and one without completed-traversal evidence. The full-window estimates correctly remain unavailable rather than becoming zero or a partial supported-minute sum. Counts, cohorts, minute records, evidence references and numerical scenario fields match independent public reads of the staged service. An initial whole-object comparison detected exactly one extra fleet-assumption sentence from the newer published backend source; this known copy difference was explicitly isolated, with all other scenario fields compared exactly.

Visual/DOM checks confirm replay provenance, independent live counts, post-shutdown offline state, the eastern 20 m completed eastbound movement description, fixed distance/fleet/weather assumptions, the longer curved-turn-path caveat and missing linked stops. General observation-minute stopped time is not borrowed for the completed cohort. Positive-reduction grams and signed changes remain unavailable. Temporary frames are process-memory data and are absent from these snapshot clones; the frame-unavailable state is expected.

## Separate supported-minute checks

These are engineering's labeled one-minute slices of the same actual records, not whole-window results:

| Mode / source minute on 8 November 2026, UTC | Cohort | Baseline estimated CO₂, g | Baseline estimated NOₓ, g |
|---|---:|---:|---:|
| Replay / 03:58 | 8 | 35.741459375498366 | 0.0065337364924251285 |
| Live / 04:00 | 4 | 17.34526207707351 | 0.003161844094161299 |

Actual browser readouts and raw-value tooltips match these retained values. In the separate supported-minute views, comparison tables render 35.741459 / 0.006534 g and 17.345262 / 0.003162 g respectively; small NOₓ values do not become zero. The 20% scenario and its changes remain unavailable with null linked stopped time. Public API checks also verify that 0% reproduces the supported baseline with zero change, and that each scoped slice has no measurement rows in the opposite mode. Slice status is not used to verify shutdown; only the complete snapshot retains that operational context. After the display fix, the same precise values are also inspectable in the full snapshot's existing retained-minute disclosure without removing the unavailable minute.

The existing cream/green layout was visually inspected at the browser's actual 935 × 1018 viewport, with the corrected disclosure also inspected at the later 1280 × 720 viewport. The scope block, pollutant readouts and scenario notice fit without horizontal overflow or new browser warnings/errors. No responsive override, broad menu regression run or additional model experiment was performed in this bounded check.

## Presentation fixes and final handoff

- `MeasurementSnapshots.tsx` now renders both pollutants' existing minute grams beside their quality using `EmissionQuantity`. Missing rows, nulls and unsupported quality remain labeled unavailable; supported zero stays zero. The disclosure labels these as per-minute estimates for completed movement vehicles and explicitly preserves unavailable minutes. The full snapshot shows replay 35.7 / 0.006534 g and live 17.3 / 0.003162 g in these readouts, with exact source values retained in tooltips. Whole-window central estimates and 20% scenario values remain unavailable.
- `recordedMinuteHistory` groups equivalent UTC instants before formatting, retains every original class/record, sorts the newly created results and uses the existing strict nullable sums. Actual full-snapshot history now has two rows per mode: replay crossings 23 + 7 and live 5 + 12. Unknown traversal/stopped components stay unavailable. No timestamps, source records or backend aggregates were rewritten.
- All **34 frontend tests**, frontend TypeScript, the isolated production build and scoped whitespace checks pass. Six focused regressions cover mixed timestamp forms, record/class preservation, source immutability, null/zero/empty history, small positive NOₓ, per-pollutant support and absent pollutant rows. Final full-snapshot visual/DOM checks confirm precise retained grams alongside the unavailable minute, two canonical history rows, unchanged scope/assumptions, mode separation and offline states.
- These are conditional modeled estimates for the accepted fixed-path/fleet/weather assumptions. Independent scale, curved-turn eligibility, manual traversal validation, linked stops, source-outage recovery and sustained performance remain separate acceptance work. The live run's recorded drops preclude a new sustained-performance or accuracy claim.

The slice listeners on 3138/3139 are stopped. At Mert's request the verified full-snapshot production dashboard remains available at **http://127.0.0.1:3137/cameras/222?mode=replay#evidence**, with its browser tab retained. It reads a frozen snapshot through the existing rolling reporting window, so retained minutes will age out normally; no historical clock or timestamps are changed to keep them visible. Original localhost PID **46237** remains running on port 3000. The private build and cloned evidence are retained locally for bounded reuse; the pointer is `/tmp/emission-lens-222-consumer-path.json`. No credential, private registry, per-traversal evidence, footage or model file is committed.
