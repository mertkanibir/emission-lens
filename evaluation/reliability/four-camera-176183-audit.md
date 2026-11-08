# Four-camera batch 176183: independent execution audit

**Owner:** Mert

**Updated:** 8 November 2026, 01:07 America/New_York / 8 November 2026, 06:07 UTC

**Status:** All seven requested intervals independently verify. Scheduler COMPLETED 0:0 in 9m43s, one MIG slice, 19-minute cap. This is offline execution/count arithmetic evidence, not accuracy, scientific approval or continuous footage coverage.

The [safe receipt](./four-camera-176183-audit.json) records frozen recipe/driver/archive/batch hashes, per-window input bounds, actual frames, gaps and verification results. All 28 archived source/config files match the manifest. Actual inference uses CUDA, n/640/requested 15 FPS, original tracker YAML/thresholds/score fusion and persistent tracking. Each window creates fresh model, tracker, sampler and metric state; receipt identity is camera plus window name plus its local numeric session.

| Interval | Sampled input frames | First to last original-media time (s) | Termination |
|---|---:|---|---|
|220 practice, separately initialized|1,714|60.061–179.982|Exclusive180s end|
|220 held-out, separately initialized|1,746|360.031–479.952|Exclusive480s end|
|228 prefix|9,048|0–719.992|Exclusive720s end|
|228 fresh suffix|4,573|840.047–1218.075|Available decoder EOF|
|222 available recording|17,797|0–1229.747|Available decoder EOF|
|223 available recording|17,967|0–1222.354|Available decoder EOF|
|220 available recording|17,518|0–1230.944|Available decoder EOF|

The baseline intervals contain **66,903 sampled input frames**. Summing all seven rows gives 70,363 because 220's review windows overlap its available-recording pass; that larger number is not a disjoint baseline total. These are processing frames, not vehicle counts or proof of unique image content. Vehicle totals remain private, including full 220 answers outside the released review windows.

For every sealed interval, the independent auditor rehashes count/config/gzip artifacts and canonical uncompressed sampler lines; recomputes each 15 FPS sampling decision; verifies strict timestamp order, bounds, actual configuration, count-event/direction/class arithmetic and selected count-1 receipt equality. All checks pass. No retrieval failures are reported. Source media time is retained without window rebasing; each original stream's 1/90000 time base/startPTS was checked independently. This does not establish capture UTC.

Camera 228 has no retrieved/modelled timestamps in `[720,840)`; suffix state starts fresh and does not infer crossings through the omitted range. CPU boundary checks also verify exclusion of exact 720 s and preservation of the first eligible 840 s frame. Decoder prefix timestamp grabs are distinguished from pixel retrieval/inference; the reserved footage was not viewed or scored.

Camera 223's actual source gaps 582.880–598.878 and627.942–631.942 remain recorded, despite an acquisition metadata gap count of zero. Other acquisition retrieval errors remain unknown missing footage. EOF, container FPS/nominal frame count and metadata duration are not complete-coverage proof. Within an interval the unchanged checker retains ByteTrack state across source gaps while metric history clears; this is not a reconnect test. Sequential offline decode has no live-buffer drop measurement.

The optional 228 context trace was omitted. The historical three-miss diagnosis therefore remains limited to [source/spatial/sampling evidence](./checkpoint-0113-source-audit.md), with no established detector/tracker/metric cause and no proposed repair. No new model, gate, default, status policy, production registry/store or active service was changed by this audit. Private 220 review evidence was released only for the two frozen review windows under Mert's coordination; full-recording answers remain withheld.
