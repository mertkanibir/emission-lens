# Independent visual crossing review

**Owner:** Mert. **Updated:** 8 November 2026, 01:09 America/New_York / 8 November 2026, 06:09 UTC.

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

**Adjudication/correction note (7 November 2026, 21:57 America/New_York / 8 November 2026, 02:57 UTC):** Mert added explicit `revise` and supersession records. Post-reference corrections are saved separately with original-ledger/evidence hashes and `references_opened_before_freeze=true`; comparisons visibly disclose `reference_independent=false`. An invalid copied transcription block in223 practice is superseded, retained and blocked from future comparison. Simultaneous distinct passages are never automatically deduplicated. Sixteen focused tests pass; original held-out results are unchanged.

`revise ORIGINAL_FROZEN_JSON CHANGES_JSON` accepts exactly the original ledger SHA, a private adjudication evidence path, explicit removal IDs, full new events and a reason. It does not rewrite the original or claim fresh blind evidence. `register_supersession` links a proven invalid bookkeeping artifact to its correction while preserving both; the manifest distinguishes current/superseded states and reference independence. The public report documents the223 practice correction and original-compatible comparisons.

**Transcription regression note (7 November 2026, 21:59 America/New_York / 8 November 2026, 02:59 UTC):** Mert added nondecreasing-time enforcement and a suspicious repeated contiguous event/evidence-block audit. Freeze never silently sorts/deduplicates input. If a repeated block could represent genuine simultaneous vehicles, `--repeat-review PRIVATE_REVIEW_JSON` must bind the ledger SHA and audit SHA with an explicit Mert/Carter rationale; all events remain. Review JSON has exactly `ledger_sha256`, `repeat_audit_sha256`, `reason`, `author`. Equal-time distinct passages remain supported. Historical original hashes and explicit correction permutations are preserved;18 focused tests pass. The manifest now includes post-reference revisions and supersession statuses. The original held-out ledgers all pass the added audits.

**Practice diagnostic note (7 November 2026, 22:11 America/New_York / 8 November 2026, 03:11 UTC):** Mert correlated pre-trace visual anchors with a verified non-mutating GPU trace. The supported failure for sampled misses is late confirmed-track admission after gate passage, not suppression of a valid admitted crossing. Exact installed association-cost verification and a smallest practice-only candidate remain pending; no settings change or fresh-window access occurred. Details and private provenance hashes are in the report.

**Recipe-provenance note (7 November 2026, 22:18 America/New_York / 8 November 2026, 03:18 UTC):** Mert added optional `adapt-model --pipeline-recipe PRIVATE_RECIPE_JSON`. It binds the actual experiment JSON file SHA256 to the normalized model artifact, sidecar and comparison; different recipes remain distinct even when their event lists are identical. Comparison schema/version participates in immutable artifact identity, preserving earlier comparisons. The supplied recipe must still be checked against actual resolved run settings; its hash alone does not establish that the run used those settings. Nineteen focused tests pass. The private practice-only association trial is in progress; no candidate efficacy or fresh-window result is asserted.

**Practice candidate checkpoint (7 November 2026, 22:34 America/New_York / 8 November 2026, 03:34 UTC):** Mert verified the private `fuse_score=false` control/candidate inputs, actual effective arguments and identical source samples. Temporal agreement improves, but source-sequence review confirms duplicate physical passages and one targeted sedan remains missed; the candidate is improved but unapproved. Preserve both ambiguity bounds and original scores. One separate practice-only n/1280 trial with original score fusion/default thresholds is authorized; no new job or rendering may access reserved `[720,840)` before Mert releases it. See the report for hashes, identity evidence and limitations.

**Resolution-only checkpoint (7 November 2026, 22:46 America/New_York / 8 November 2026, 03:46 UTC):** Mert verified n/1280 against the original tracker and unchanged practice inputs. It retains or recovers the six predeclared positive anchors but fails both assisted count bounds overall (76 model versus108–138 assisted). Keep it unapproved, retain partial candidate-screening status and preserve the unopened fresh interval. One final pretrained s/1280 baseline-only comparator is separately authorized; see the report for provenance and limits.

**Final comparator/handoff note (7 November 2026, 22:55 America/New_York / 8 November 2026, 03:55 UTC):** Mert completed the frozen s/1280 baseline-only comparison:77 passages fails both assisted practice count bounds. The CLI wrote its report before a wrapper post-run argument assertion failed; exact resolved-argument/persistence/sample-equality proof is incomplete and explicitly retained, not inferred. No physical-identity assessment is possible from its timestamp-only output. Stop model experiments, keep228 unapproved and preserve the untouched fresh interval. Human adjudication or a separately scoped negative-direction tracking proposal is the next dependency. Nineteen focused harness tests remain passing; see the report for full provenance and bounded coverage.

**Queued 220 handoff (8 November 2026, 00:12 America/New_York / 8 November 2026, 05:12 UTC):** Mert queued the [camera-220 blind-review plan](./220-review-plan.md) behind the camera-222 live restart and camera-228 new-gate alignment. Practice `[60,180)` and held-out `[360,480)` use original n/640 at requested15 FPS; geometry must freeze before held-out access and the assisted ledger before reference release. Acquisition, rendering and execution remain pending Mert’s coordinated handoff; Carter’s model count stays unopened and Carter owns distance calibration.

**Relocated practice reconciliation (8 November 2026, 00:33 America/New_York / 8 November 2026, 05:33 UTC):** Mert reconciled the new blind relocated228 count-1 practice ledger with completed job176055 through the existing harness. Both ambiguity bounds fail; v2 execution/v3 review raw hashes remain separate and selected semantics match. See the [scoped result](./228-relocated-practice.md). Three unmatched cases are selected privately for a future spatial proposal only; no viewing, compute or tuning followed.220 remains queued for Mert’s next handoff.

**220 source/gate readiness (8 November 2026, 00:48 America/New_York / 8 November 2026, 05:48 UTC):** Mert acquired the220source/metadata once and fixed the existing practice-selected count-1 gate before held-out viewing. Two disjoint practice halves are actively counted. [Source/gate readiness](./220-source-readiness.md) records exact file/native-PTS provenance; rendered frames are not completed review. The two-window release supersedes the prior queue, while model/manual results remain withheld until ledger freeze.

**220 practice ledger frozen (8 November 2026, 00:56 America/New_York / 8 November 2026, 05:56 UTC):** Mert froze the actual220practice ledger before reference access:111assisted candidates,93excluding18endpoint/boundary ambiguities. All592selectedframes/50sheets plus21native-cadence candidateframes were inspected, with partial coverage/human_confirmed=false explicit. See [220review status](./220-review-status.md). Held-out reconciliation is active; all220model/manual answers remain withheld until its freeze.

**220 held-out ledger frozen (8 November 2026, 01:02 America/New_York / 8 November 2026, 06:02 UTC):** Mert froze the actual220held-out ledger at01:01:30NY/06:01:30UTC before any model/manual reference access:106assisted passages (63positive/43negative),594selectedframes/50sheets plus148nativecandidateframes, explicitpartialcoverage/human_confirmed=false. Practice111/93 is also preserved. See [220review status](./220-review-status.md). Only the two matching window outputs may now be handed off; no full-recording visual completion or acceptance follows.

**220 comparison and ownership handoff (8 November 2026, 01:09 America/New_York / 8 November 2026, 06:09 UTC):** Mert completed the aligned220two-window comparison:87model versus111/93practice assisted candidates and75versus106held-out; all provisional recall screens fail. [Actual result](./220-review-status.md) preserves hashes/coverage/ambiguity and original blind freezes. [Ownership handoff](./HANDOFF.md) routes remaining video evidence to Full-Stack Software Engineer —1; no further work, viewing, tuning or enablement is launched.
