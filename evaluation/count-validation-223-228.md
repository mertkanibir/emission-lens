# Cameras 223 and 228: acquisition and frozen-gate baseline

**Owner:** Mert
**Updated:** 7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC
**Status:** Frozen-gate baseline execution and separate assisted held-out comparisons are complete; human adjudication and camera acceptance remain open.

Mert acquired the original 223/228 MPEG-TS recordings and their recording JSON through the connected Binghamton Drive account, without inline/base64 video. Provider metadata mislabeled the `.ts` extension as text; byte inspection/FFprobe identified H.264 MPEG-TS at 1280 × 720. Complete files remain in ignored `data/raw/clips/223/` and `data/raw/clips/228/`. Both local/server SHA-256 and byte sizes agree. No raw imagery, credentials or private download capabilities are committed.

[Scalar provenance](./count-validation-223-228.json) retains clip/metadata hashes, actual raw PTS, decoder offsets, source gaps/errors, exact reviewed gate definitions, raw JSON and canonical semantic hashes. [Execution script](./count-validation-223-228-run.py) invokes the existing `evaluation.check_counts count` CLI at pretrained `yolo11n.pt`, 640 pixels, requested 15 FPS, explicit `--clip`, starts 60/360 and duration 120 seconds. It observes CUDA backend/sample decisions without changing them. Each window starts a fresh tracker; there is no preroll.

| Source | 223 | 228 |
|---|---:|---:|
| Video bytes | 93,544,288 | 50,154,076 |
| Decoded frames | 17,986 | 15,438 |
| First raw PTS (1/90000 s) | 3,026,699,456 | 3,025,948,946 |
| Decoded PTS span, seconds | 1,222.354 | 1,218.075 |
| Nonadvancing PTS | 0 | 0 |
| Largest decoded PTS step, seconds | 15.998 | 0.134 |
| Recording segments | 121 | 122 |
| Reported/computed sequence gaps | 0 / 0 | 0 / 0 |
| Recording retrieval errors | 3 | 4 |

The 223 large PTS step occurs outside the two reviewed windows; within each window the maximum adjacent step is 0.067 seconds. The 228 practice/held-out windows have 323/440 intervals over 0.1 seconds and maximum step 0.134 seconds. Zero sequence gaps alone does not establish uninterrupted frames or footage coverage. Recording start is receipt metadata, not independently verified source capture UTC.

OpenCV source-media time equals raw frame PTS minus the first PTS, within approximately 6e-12 seconds of FFprobe's displayed precision. The clip is not assigned a synthetic constant-frame-rate clock. Requested 15 FPS sampling does not guarantee 1800 frames: the practice windows select 1798/1392 samples respectively. Model event time is the hysteresis-confirmation frame, which may be later than a visual crossing.

## Frozen scientific boundary

The independent reviewer designated existing `count-1`, both directions, without changing road region/exclusions. Before held-out execution, Mert verified the original byte hashes plus canonical full-JSON and selected-geometry hashes:

| Camera | Raw geometry SHA-256 | Selected semantic SHA-256 |
|---|---|---|
| 223 | `5165b1a2342b70b97afa35499d2b63042a44b4e9301e6528480a35eb3ed9ae29` | `58d449f9790dd44275eec47f19eeb8c3c9af26b97e3c787793f8a8ebc1f6da87` |
| 228 | `998013dab9c6ab6d04ebcd23caea581957445ea9de7d3109f459dea89f43538c` | `59dd678caa801e0aea7e1554b83663702fec8ba61a56468d973f796a99910c35` |

The semantic digest is SHA-256 of UTF-8 `json.dumps(payload, sort_keys=True, separators=(',', ':'), allow_nan=False)` using camera, selected gate, road/exclusions, the recorded counting rule, effective metrics policy and comparison policy. It is independent of LF/CRLF and irrelevant JSON formatting. Full JSON canonical hashes and exact payload settings are also retained. Effective metrics remain minimum hits 3, hysteresis 0.01 and maximum gap 1 second; saved configs remain disabled/unvalidated. The existing helper enables only its in-memory diagnostic copy.

Review convention is strict `[start,end)`, same gate/direction, maximum-cardinality then minimum summed absolute time gap, default tolerance 1.5 seconds. The original CLI includes the end frame (`t > end` stops decoding); it is preserved. Neither file contains an exact frame at 180 or 480 seconds, so these window endpoint sets coincide. Any future comparison must still filter strict bounds explicitly and retain legacy closest-first scoring separately. No matching/scoring or accuracy acceptance is performed in this execution stream.

Both independent assisted held-out ledgers were reported frozen before their corresponding model result paths were released. Neither ledger is human-confirmed; endpoint/coverage uncertainty remains explicit. Held-out file hashes are in the scalar evidence; raw model events/totals and practice-result locations are excluded from public source. This file contains acquisition, timing and execution provenance only. Camera 222's existing acceptance is managed separately by Mert and Carter; it was not rerun. No accessible 220 recording/share was found in the targeted Drive-name and matching email-metadata checks; Carter owns that camera's review.

Job **175884** completed **0:0** in **1m28s** on one H100 MIG `1g.10gb` slice, with a five-minute cap, one CPU and 16 GB requested memory. The actual inference backend was `cuda:0` for all four runs. Practice/held-out samples were **1798/1787 for 223** and **1392/1284 for 228**; these are processed frames, not vehicle totals. There were no end-boundary samples. All **30 focused tests plus 12 subtests passed** on compute. The four downloaded result hashes match the execution manifest and JSON event/time bounds validate. The exact executed runner hash matches the published script. The allocation is released; only the new temporary remote 223/228 media/metadata copies were removed after verified retrieval, while local review copies and Mert's SSH session remain available. No detector/tracker/model selection, training, labeling, gate edit, camera enablement, physical calibration, public schema or other stream's runtime work is changed by this checkpoint.

**Comparison handoff (7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC):** The [independent review report](./video_validation/report.md) now contains post-freeze assisted/model comparisons. Camera 223 meets the provisional aggregate screen against assisted candidates but retains endpoint/direction questions; 228 has a substantial deficit under both ambiguity bounds. These are not additional human-reference scores or activation decisions. Follow the review report's current practice-ledger supersession notes; they do not alter the held-out baseline files or original execution hashes. Broad recording expansion remains deferred, and 228 `[720,840)` stays reserved/unviewed pending a separately reviewed practice-selected change.
