# Camera 220 source and gate readiness

**Owner:** Mert. **Updated:** 8 November 2026, 00:48 America/New_York / 8 November 2026, 05:48 UTC.
**Status:** Source acquired; practice-only gate/policy fixed; actual blind counting in progress. This is not a completed visual count.

Mert used connected Drive metadata reads and authenticated raw-file references to acquire the recording and companion metadata once. Exact returned byte sizes match the saved local files; subsequent review reuses them. All media/frames/ledgers and private locators stay ignored. No220model/manual count, email answer key or model output was opened.

| Source | Bytes | SHA256 |
|---|---:|---|
|Video|51,999,860|`6caa25dfb47dc8d7e0305a90704a6726754018dbc8ae66ac696bbac4adc72bc6`|
|Recording metadata|13,438|`1f1f00a4eb7ccd540852d2d505e1dd293667bde7c42d6374ae1fa3c8e778446c`|

## Source timing

Actual ffprobe decoding verifies1280×720 H.264,17,670 strictly increasing native frame PTS and about1231.011s duration. Source first nativePTS3024854636, last3135639596, timebase1/90000; clip time subtracts the first native PTS before division. Median interval is about0.067s and maximum0.134s; no decoded gap exceeds0.2s. Recording metadata reports zero sequence gaps and three retrieval errors. Its recording-start UTC is a receipt/recording marker, not independently verified capture UTC.

Practice `[60,180)` has1749 native frames (first60.061s,last179.982s); held-out `[360,480)` has1762 (first360.031s,last479.952s). Both declared windows are available. Inventorying timestamps is distinct from visual review.

## Practice-selected geometry and blind boundary

Mert inspected the first ordered practice sheet (frames1–12,60.061–62.261s) and retained existing220-image-v2 `count-1` unchanged: start[0.2477,0.6417],end[0.6188,0.7],direction both. The finite line spans the visible approach/away road near the stop bar. Side-change, road/exclusion eligibility and endpoint uncertainty follow the existing package policy; no production configuration is edited or approved.

- Full-config raw SHA`5058158807ad085f79f6f660c945c3b36f1c263ffdb4a951c9987df3f4615e2b`.
- Selected semantic SHA`6c6bdcf9ab0cfdcd3f83b94a686d6e8d0681a63e89494fe4ecfd3d520d8a78ae`.
- Current private gate/policy receipt file SHA`5be7b6d9ce6ed268ac22743dc514d8a37011c0ab39c178fe040749dfc1e32804`.
- Exact native-PTS audit file SHA`2ebf3894a2996c661bcdef4a33a6cb50b36931de9e6b92fa3e4da649c2e273db`.

The gate/policy receipt precedes held-out viewing. A written practice-sheet end-time caption was corrected with an original-preserving metadata revision; actual inspected frames, gate/policy and blinding are unchanged. The declared model recipe remains the original pretrained n/640 at requested15FPS with original tracker/metric settings; execution/result custody is separately coordinated, not launched by this review stream.

## Actual progress and remaining work

All592 selected practice frames/50 ordered sheets are rendered. Two independent, disjoint half-window reviewers are inspecting `[60,120)` and `[120,180)`, retaining source evidence and uncertainty and reconciling the120s boundary. Rendered frames are not completed coverage; no full practice count is frozen yet. Now that the practice-selected gate is locked, the held-out sequence can be prepared/viewed against that unchanged policy while practice bracket checks finish. No220model/manual reference is released to reviewers.

Next: finish and freeze the practice ledger; inspect both held-out halves in order, reconcile their boundary/candidate evidence and freeze the assisted held-out ledger before any reference access. Record exact inspected frames/sheets, native revisits, sampling/coverage limitations and `human_confirmed=false`. Full-recording visual expansion, production220enablement, physical accuracy/calibration approval, new training/model execution and228reserved-window access remain outside this review. Carter owns distance calibration; healthy live222 and its application are untouched.

## Verification

Source sizes/hashes, actual codec/native PTS cadence/gaps, declared-window availability and the saved geometry/policy identity are verified. The private files and public source summary contain no reference counts. Review completion/accuracy and physical measurements remain pending.
