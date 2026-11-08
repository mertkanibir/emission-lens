# Checkpoint source, spatial and sampling audit

**Owner:** Mert

**Updated:** 8 November 2026, 00:50 America/New_York / 8 November 2026, 05:50 UTC

**Status:** Three camera-228 practice cases have bounded source/spatial/sampling evidence. Historical detector/tracker/metric cause is unproven; no repair is proposed. Four-camera inventory hashes pass; final recipe, execution and coverage remain pending.

## Completed camera-228 diagnosis

Mert revisited only the twelve already-reviewed cited practice frames for three clear-labeled unmatched candidates. Their original native PTS values map to clip time using `(native_pts - 3025948946) / 90000`; all twelve mappings check. These are original-source media times, not verified capture UTC.

Approximate post-reference visual bottom-centre point sequences cross the frozen finite count-1 gate in the stated directions, inside the road polygon and outside exclusions. Both endpoint sides lie beyond the existing hysteresis band. All 81 descriptive endpoint-placement variants at ±8 pixels retain finite-gate/road/exclusion eligibility for each pair. This is a visual sensitivity check, not detector boxes, a measured placement error, statistical interval or human ground truth. The original assisted uncertainty labels and ledgers are unchanged.

The completed 176055 sampler receipt has seven kept source frames in each cited bracket. Maximum consecutive kept gaps are approximately 0.134, 0.134 and 0.200 seconds, all below the existing one-second metric history limit. The brackets contain 7, 7 and 10 decoded frames respectively; three frames in the third bracket were rejected by the unchanged sampler. Thus the records do not show complete sampling loss of any cited crossing bracket. They do not establish detector visibility, association/confirmation or metric history before the bracket.

The review's v3 and executed v2 complete geometry hashes differ, while the selected count-1/road/exclusion/metric/matching semantic hash independently reproduces as `6c815e5b45d0ca2b0b2d7e42143c94a61d5f07ccbf8ab2db1161212f1e50b8ce`. Actual 176055 settings retain pretrained n/640, requested 15 FPS, confidence 0.1, original ByteTrack thresholds/score fusion and persistent tracking; the saved sample count is 1,392. No defaults changed.

The existing detailed trace covers only `[83,110)` with older selected geometry. These three brackets are later in the already-reviewed `[60,180)` practice window, and the 176055 run has no corresponding spatial trace. Substituting an older gate or a full-file run initialized at zero would change the relevant history. A contextual trace from a separately authorized full-file batch must remain labeled contextual; it cannot establish these historical miss causes by itself. No detector, sampling, tracker or metric repair is justified by this receipt. No additional GPU run, gate/model promotion or reserved `[720,840)` viewing occurred.

Private audit receipt SHA-256: `a994355ec1312a3b298a444ea5d5bfb10c1085b4f16e7e8147240265e03220e3`. It retains the manual point placements, cited frame hashes, recipe/sample/default receipts and per-stage limits. Raw frames, temporary identities and detailed payloads remain private.

## Independent four-camera input audit

The staged inventory's four original clips, four acquisition metadata files and four geometry files independently match their SHA-256 values. Camera-220 selected geometry matches its privately frozen practice gate/policy. No camera-220 model/reference outputs were read or sent to its blind reviewer.

Acquisition metadata labels zero gaps, but an independent read of camera-223 native PTS reproduces gaps from 582.880 to 598.878 seconds (15.998 seconds) and 627.942 to 631.942 seconds (4.000 seconds). Container FPS, nominal frame count, requested acquisition duration and an empty metadata gap list do not establish continuous coverage. Actual processed frame/time ranges, gaps, per-camera/session resets and omitted intervals must come from the completed execution receipt.

The forthcoming recipe must omit camera-228 `[720,840)` and restart tracking, sampling and metric state after that omitted range. Camera-220's two review windows need distinct initialized state and private outputs. Final recipe/run evidence is still pending; this note does not accept a full-recording run or claim complete footage coverage. Healthy live camera-222 job 176075/application 3138 are untouched.
