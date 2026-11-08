# Camera 228: Mert's repositioned practice gates

**Owner:** Mert
**Updated:** 8 November 2026, 00:08 America/New_York / 8 November 2026, 05:08 UTC
**Status:** Recipe-pinned GPU practice count completed. Two gate results are available; accuracy and camera enablement remain unaccepted.

Mert pulled the current remote branch and personally repositioned both counting gates on the original camera-228 practice frame. The native OpenCV window did not appear on the active desktop, so a private loopback browser editor used the same `GeometryDraft` save and `MetricsConfig` validation. No footage or private editor artifacts are committed.

The saved [geometry](../config/cameras/228.measurement.json) is `228-image-v2`, SHA-256 `238c036de60a315aca0f03f5c0c2172fa5bd4d1d0bb31caadde627a7fd59138a`, already published in `7b5818f`. Only the version and two gates changed. Road region, exclusions and original counting policy are preserved. The file remains **disabled/unvalidated**; the existing offline checker uses its reviewed in-memory copy without enabling production.

## Completed execution

Empire AI access was restored before submission. Job **176055** completed **0:0 in 38 seconds** on one H100 MIG `1g.10gb` slice, with one CPU, 16 GB memory and a three-minute cap. All **40 focused tests plus 12 subtests passed**, and the allocation was released. The earlier access blockage is resolved; this record contains the finished run rather than a pending submission.

The run used existing **pretrained YOLO11n/640 at requested 15 FPS**, original ByteTrack `fuse_score=True` and every original threshold. It initialized at 60 seconds and processed only practice **[60,180)** from the original clip. The run processed **1,392 frames**; the complete source/sampler-decision stream matches the previous practice stream. Reserved **[720,840)** remains untouched.

| Gate | Crossings | Positive | Negative | Observed classes |
|---|---:|---:|---:|---|
| `count-1` | 80 | 34 | 46 | 78 car, 2 bus |
| `count-2` | 15 | 7 | 8 | 15 car |

**Keep these gate counts separate.** Adding them would not establish a distinct-vehicle total. Positive/negative describe each gate's orientation, not a newly validated movement direction.

## Reproducible evidence

The [scalar record](./228-redraw-practice.json) binds geometry, weights, video, source, configuration, samples and output hashes. Frozen recipe SHA-256: `7df1a7b675bba3db45d1d93679e0eae4cf99b6e3bdb7007fb4f70af64b75ea86`; private count SHA-256: `08697fa6864851d3408aedce6d300370eafe1e15e7f3f44e42a3ae7906283d94`.

The source archive is from **`7b5818f923dab43815ffd7f74fb2ec9c9ee6c5d3`**, archive SHA-256 `43b9bdc4d1176d93de9532d154f40021b41682f5a9635f1a64b5eefedad44aa8`. Thirty copied source/config/test files match the frozen catalog. Actual `cuda:0`, predictor size640/confidence0.1/classes[2,3,5,7], registered callback persistence and resolved default tracker arguments were saved after CLI completion, before validation. YAML-defined keys matched the frozen defaults; the extra runtime device field was recorded separately. This is not a first-frame or detailed identity trace.

The existing checker command profile was:

```sh
python -m evaluation.check_counts count 228 --clip "$EL_228_CLIP" \
  --start 60 --seconds 120 --weights weights/yolo11n.pt \
  --image-size 640 --fps 15
```

The explicit clip was `228_20261107T220646Z.ts`, SHA-256 `568e224559d391995eb9339c467bc9bf8cc592e4245b6959eda65f0834648d8a`. Raw event times, per-frame sampling receipts, media and private execution artifacts remain outside source control.

## Acceptance boundary

Relocated gates require **new reference events at these positions**. The historical 138/108 assisted ledger and its prior accuracy scores do not apply; no reference comparison or measured accuracy is claimed. Existing geometry studies and results remain preserved separately. The next scientific checkpoint is visual crossing review at the new gates, followed by a separately authorized comparison. This completed count check does not authorize another GPU job, model promotion, tracker/threshold tuning, training, physical approval, production enablement or a public-contract change.
