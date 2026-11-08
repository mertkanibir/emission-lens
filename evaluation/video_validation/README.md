# Independent visual crossing review

**Owner:** Mert. **Updated:** 7 November 2026, 21:41 America/New_York / 8 November 2026, 02:41 UTC.

This package keeps assisted visual review separate from Carter's human reference and pretrained detector/tracker output. It does not run inference. An assisted ledger always records `review_method=assisted_visual_sequence_review` and `human_confirmed=false`. A frozen assisted ledger alone cannot enable a camera, physical speed, calibration or estimated emissions.

## Blind boundary and inputs

1. Acquire the single local recording and its recording metadata under ignored `data/raw/clips/<camera>/`. Inventory file SHA256, video PTS origin/end, original frame count, cadence and gaps. Recording receipt time does not establish capture UTC. Clip-relative time is source video PTS minus its first video PTS.
2. Inspect practice `[60,180)` with unannotated chronological frames. Gate overlays/timestamps are permitted; detector boxes/events, Carter totals, acceptance files and email are forbidden. Select one gate using practice only. Snapshot unchanged geometry or a practice-only proposal before opening `[360,480)`; share its exact hashes with the baseline owner. Never tune on held-out discrepancies.
3. Inspect the full ordered held-out sequence, using adjacent native-cadence frames near candidates. Rendering does not certify review. Record exactly which sheets were actually inspected and disclose sampling, occlusion, endpoint uncertainty and missing footage. Sparse overview stills alone cannot establish complete coverage.
4. Save the timestamped ledger and run `freeze`. Share its SHA before receiving the corresponding human/model reference. Preserve every original freeze. Later adjudication is a separately hashed revision with reasons and evidence, never a rewrite of the original count.
5. Compare only after freeze. Camera/window/clip/selected-geometry provenance must match. Missing human references remain pending. Totals-only human references support total error, never event precision/recall. Model-versus-assisted metrics describe agreement, not measured human accuracy.

All generated media, contact sheets, source PTS inventories, ledgers, reference keys, discrepancies and comparison JSON stay in ignored `data/raw/video_validation/`. Public reporting contains permitted scalar summaries and hashes only. No plate, facial or cross-camera identity work is performed; event IDs are window-local `eNNNN` labels, not vehicle identities.

## Counting and matching conventions

Count a physical directional passage when the vehicle's visually estimated bottom-center ground-contact proxy changes sides across the **finite** selected gate, within the road polygon and outside exclusions. Positive means `(end-start) × (point-start) > 0` in normalized image coordinates. Tangencies are excluded; touching an endpoint counts only with an actual side change. A turning vehicle may cross the same gate in each direction; preserve both passages rather than asserting unique intersection vehicles. Vehicle appearance supports only broad classes, not fuel or regulatory weight class.

Windows are strictly half-open `[start_s,end_s)`. Malformed, nonfinite, negative or endpoint timestamps are rejected; no silent clipping, coercion, deduplication or removal of simultaneous distinct vehicles occurs. A legacy report containing an event at `end_s` must be explicitly reconciled by the producer, retaining its original artifact.

Canonical comparison maximizes same-direction matches within 1.5 seconds, then minimizes total absolute time gap. Dynamic programming preserves chronological order and uses deterministic input-order tie-breaking. It also reports the existing closest-first greedy match count separately. The synthetic example reference `[0,2]`, predictions `[1.1,3.1]`, tolerance `1.5` yields two canonical matches and one legacy match. This policy was declared before reference access.

`adapt-human` retains the source key SHA and explicitly flags unresolved endpoint annotations. A noncanonical seconds value of60 is recognized only at the exact reporting-window end and never becomes an interior event. Original-compatible sensitivity is reported separately, preserving distinct simultaneous annotations. Every other malformed/out-of-window annotation is rejected.

Retain raw geometry bytes SHA256, canonical full-config SHA256 and a selected-geometry semantic SHA256. Canonical JSON uses sorted keys, compact separators and finite numbers. The semantic hash includes the designated gate, road polygon, exclusions, explicit crossing/direction rule, pinned metric defaults/settings and matching policy; changing real geometry/settings invalidates it. CRLF/LF formatting differences affect raw hashes while preserving canonical/semantic hashes. Review identity additionally includes camera, clip SHA, half-open window and review version.

Candidate-inclusive and candidate-excluded comparisons remain separate when `ambiguous_crossing` events exist. Their count range is an ambiguity bound, not a confidence interval. Carter's provisional recall ≥85% and absolute relative total error ≤15% are review criteria only; precision, directional error, disputed times and coverage remain visible. Final acceptance belongs to Mert and Carter.

## Commands

Requirements: Python 3.9+, FFmpeg/ffprobe and Pillow. No detector weights are needed.

```sh
python3 -m evaluation.video_validation.review inventory
python3 -m evaluation.video_validation.review render 223 \
  data/raw/clips/223/223_20261107T220646Z.ts \
  config/cameras/223.measurement.json count-1 --start 60 --end 180 --fps 5
python3 -m evaluation.video_validation.review freeze PRIVATE_LEDGER_JSON PRIVATE_SEQUENCE_JSON
python3 -m evaluation.video_validation.review adapt-model PRIVATE_FROZEN_JSON \
  ORIGINAL_MODEL_REPORT LOCAL_CLIP FROZEN_GEOMETRY
python3 -m evaluation.video_validation.review adapt-human PRIVATE_FROZEN_JSON ORIGINAL_HUMAN_KEY
python3 -m evaluation.video_validation.review compare PRIVATE_FROZEN_JSON \
  NORMALIZED_MODEL_JSON --reference NORMALIZED_HUMAN_JSON
python3 -m evaluation.video_validation.review export-manifest evaluation/video_validation/manifest.json
python3 -m unittest tests.test_video_validation -v
```

Omit `--reference` if no separate human key is supplied. Use `--fps 15` on short candidate windows for native-cadence review; source cadence still governs actual frames. The renderer selects original source frames and does not synthesize duplicate frames across gaps. `sequence.json` maps each frame to source PTS and clip time. Every twelve consecutive selected frames form one ordered sheet; enlarged gate crops may be derived privately from these same frames.

The ledger schema is explicit in `freeze`: camera/clip/geometry/window/gate/review identity; counting rule; method/human flag; reviewed sheets; coverage status; events; limitations. Each event has unique local ID, numeric clip time, gate, positive/negative direction, broad visual class, uncertainty and positive supporting sequence-frame indices. Allowed uncertainty values are `clear`, `occluded`, `ambiguous_time`, `ambiguous_crossing`.

Normalized post-freeze references contain `camera_id`, `clip_sha256`, `geometry_sha256`, `window`, `gate`, `source` (`carter_human` or `model`), `events` and `total`. Reference events may contain only local `id`, numeric `clip_time_s`, `gate`, `direction`. A totals-only reference uses `events:null`. Keep original sources unchanged; explicit provenance binding is required rather than guessing a missing timestamp or gate. The model adapter preserves source hash/recipe in a private sidecar. Its filename/version checks still require the acquisition owner to attest actual remote input hashes and time basis.

`inventory` is rerunnable: immutable PTS caches are keyed by clip SHA; every matching frozen review is retained in the manifest, and a changed clip/geometry/window/version gets a new identity. All remaining file intervals stay in the queue until actually reviewed. Missing media is pending, never a supported zero.

An active private reservation rejects any overlapping render, including a wider requested window. Camera228 `[720,840)` is currently reserved unviewed for a prospective fresh evaluation; the authoritative status and dated coordination note are in the report. Leave it untouched until Mert releases it after any practice-selected change. Comparison artifact names include the actual source-reference hashes, so a newly supplied key creates a separate comparison without recounting or overwriting the original ledger.

See [current status](./report.md) for completed review coverage and limitations. The shared checker, camera configurations, detector/tracker, runtime and core contract are unchanged.

**Checkpoint note (7 November 2026, 21:50 America/New_York / 8 November 2026, 02:50 UTC):** Mert completed original held-out ledgers for222/223/228 and their post-freeze comparisons, all three practice ledgers, focused diagnostics and14 passing checks. Broad full-file work is deferred while223/228 disputes are resolved. Existing shared checker/camera/runtime behavior is unchanged.
