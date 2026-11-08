# Camera 222: GPU count checks at requested 15 FPS

**Owner:** Mert
**Updated:** 7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC

Job **175806** completed `0:0` on one H100 MIG `1g.10gb` slice, account `rpicourse`, QOS `normal`, reservation `binghamton_hackathon`. It took **4m33s**, including the four count runs and a two-minute four-camera benchmark. The allocation is released. [Scalar execution evidence and checksums](./count-check-175806.json) record source revision, clip/geometry/model hashes, actual CUDA devices, settings and results.

Mert retrieved Carter's `222_20261107T220646Z.ts` and recording metadata through the connected Binghamton account, verified matching local/server SHA-256 hashes and ran the existing count command for both requested windows/settings. The server checkout was fast-forwarded to `aabbbcead2af7fce0ae6d06d8d08c718120b9b2f` before execution. The verified Python 3.12 environment must run on compute; the login-node interpreter resolves to Python 3.9 and cannot see those packages. Both official pretrained models were downloaded inside the allocation. An initial 18-second wrapper attempt failed on its import path, was corrected, and is separately recorded as job 175804.

| Model / pixels | Clip window | Gate 1 negative | Gate 1 positive | Gate 2 positive |
|---|---|---:|---:|---:|
| yolo11n.pt / 640 | 1:00–3:00 | 36 | 9 | 77 |
| yolo11s.pt / 1280 | 1:00–3:00 | 37 | 10 | 79 |
| yolo11n.pt / 640 | 6:00–8:00 | 45 | 22 | 68 |
| yolo11s.pt / 1280 | 6:00–8:00 | 48 | 21 | 69 |

These are separate gate/direction totals, not a sum of unique vehicles. The four original JSONs remain in ignored `data/raw/count_check/carter-15fps-20261107/`, and were sent to Carter from Mert's Binghamton email. Readback verified all four JSON attachment names/sizes. No images were sent.

All runs requested `--fps 15`; the 1:00–3:00 window processed **1712** sampled frames and the 6:00–8:00 window **1738**, identically for both models. The clip has variable source timing and the sampler does not imply exactly 1800 frames or complete coverage. Recording metadata reports 123 segments, zero sequence gaps and three retrieval errors.

The optional four-camera YOLO11s/1280 benchmark processed **7193 frames in 120.006s**, **59.94 aggregate FPS**, with **14.59–15.63 FPS per camera** and **780 reader-buffer drops**. All four inference backends were `cuda:0`, and reader threads stopped. This is near the requested aggregate processing rate; dropped frames and a short run prevent a claim of loss-free sustained operation. Processing wall FPS and receipt-buffer age are not capture latency or footage coverage.

Verification: **38 tests plus 17 subtests passed** on compute for `tests/test_check_counts.py`, `tests/test_metrics.py` and `tests/test_benchmark.py`. All four JSON hashes match the execution manifest, event counts/direction sums and time bounds validate, both models used identical samples, and the saved camera-222 geometry hash is unchanged. The GPU runner only observed model loading to verify the actual backend device; it did not change the count implementation.

The original count invocations use the supplied clip, `--seconds 120 --fps 15`, starts 60 and 360, and weights/sizes `weights/yolo11s.pt / 1280` and `weights/yolo11n.pt / 640`. Benchmark command: `python -m evaluation.benchmark --seconds 120 --weights weights/yolo11s.pt --image-size 1280 --fps 15 --threads 1 --output <private-result.json>`.

At the original GPU execution checkpoint, Carter's manual totals and held-out crossing answer key were not among the shared files found; accepted count/tracking error was then unavailable pending comparison. Similar model totals alone do not establish accuracy. No model was promoted, no actual geometry enabled, and no physical calibration, contract or production setting changed. Raw footage and weights remain private and ignored, retained for ongoing review and boundary adjudication.

**Subsequent review (7 November 2026, 22:00 America/New_York / 8 November 2026, 03:00 UTC):** Carter later committed the [original count-1 human key and acceptance record](./calibration/222-count-acceptance.json) and enabled only camera 222/count-1. The [numerical audit](./calibration/222-count-audit.md) reproduces both model results, explains geometry byte/canonical hashes and retains endpoint/direction sensitivity. The [independent assisted review](./video_validation/report.md) now adds separate frozen comparisons; it is not new human ground truth. This run's JSON/checksums and its original no-approval scope remain unchanged. No additional model selection, camera activation or physical approval is made here.
