# Contracts

**Version:** 1.1  
**Owner:** Mert  
**Updated:** 7 November 2026, 18:55 America/New_York (23:55 UTC)

Typed records for the shared data contract in `Plan.md` §14. Fixtures and the backend read path use this package. There is no hosted database yet. A configured local worker store supplies live/replay records; labeled synthetic fixtures remain separate.

## Clarification added with this package

`traffic_minute.traversal_time_s` is total traversal time for completed traversals, in vehicle-seconds, including stops. `Plan.md` §8 needs it to recover average speed. It is additive: older readers can ignore it. Queue count and queue length in metres stay separate. Queue count is a camera-minute observation and is stored on one class row so it is not summed per class.

## Vehicle classes (1.1)

**Changed:** 7 November 2026, 16:22 America/New_York (21:22 UTC), agreed by Mert and Carter.

`car`, `tesla`, `pickup`, `truck`, `box_truck`, `tractor_trailer`, `bus`, `motorcycle`, and `unknown`.

- The fine-tuned detector produces `pickup`, `box_truck`, `tractor_trailer`, and `tesla`.
- `truck` stays for the pretrained detector, which has one truck class. It is the fallback if the fine-tuned model does not beat the pretrained one on held-out frames.
- A track is `tesla` only with at least three Tesla frames averaging 85% confidence. Anything less is reported as `car`, so the contract never claims an electric vehicle the evidence does not support.
- Only additions: every 1.0 value is still valid.

## Modes

`live`, `replay`, and `synthetic` are separate. The synthetic minute is a labeled sample for the dashboard. It is not a live total and it is not a measurement.

## Null and zero

`null` means unavailable. A numeric zero is allowed only as a supported zero. Emissions rows with quality `unavailable` or `insufficient_evidence` cannot carry an estimate, including zero.

## Not in this package

Vision, factor-data and GPU implementations are documented in `worker/`, `emissions/` and `evaluation/`; their results are not implied by synthetic fixtures. Calibration for every camera is `missing`. Road-region geometry is null.

**Transport note (7 November 2026, 18:18 America/New_York / 23:18 UTC):** Mert added `WorkerBatch` and `parseWorkerBatch`: strict runtime validation of the existing 1.1 records, whole-batch rejection, explicit batch UUID/revision, and per-run mode isolation. This adds a transport envelope without changing core record fields. Capture UTC may be unavailable while an advancing-frame processing heartbeat is fresh. No live calibration or class mapping is silently enabled.

**Minute-time clarification (7 November 2026, 18:49 America/New_York / 23:49 UTC):** New worker runs marked `t:hls-min-anchor-v1` assign traffic minutes from a session-local estimated HLS media clock, `min(received_at - media_time) + media_time`. This is not verified capture UTC. Existing UTC fields and contract version 1.1 remain unchanged. A higher revision with an empty `traffic` array retracts that batch's prior minute rows; it is not a zero observation. Historical receipt-time rows remain unchanged, and mixed timing bases are disclosed in read-path notes.

**Documentation reconciliation (7 November 2026, 18:55 America/New_York / 23:55 UTC):** Mert updated the package status and implementation references. Record fields and contract version 1.1 are unchanged.
