# Contracts

**Version:** 1.0  
**Owner:** Mert  
**Updated:** 7 November 2026, 14:40 America/New_York (19:40 UTC)

Typed records for the shared data contract in `Plan.md` §14. Fixtures and the backend read path use this package. There is no hosted database yet, so these fixtures are the current store.

## Clarification added with this package

`traffic_minute.traversal_time_s` is total traversal time for completed traversals, in vehicle-seconds, including stops. `Plan.md` §8 needs it to recover average speed. It is additive: older readers can ignore it. Queue count and queue length in metres stay separate. Queue count is a camera-minute observation and is stored on one class row so it is not summed per class.

## Modes

`live`, `replay`, and `synthetic` are separate. The synthetic minute is a labeled sample for the dashboard. It is not a live total and it is not a measurement.

## Null and zero

`null` means unavailable. A numeric zero is allowed only as a supported zero. Emissions rows with quality `unavailable` or `insufficient_evidence` cannot carry an estimate, including zero.

## Not in this package

Vision output, factor tables, and GPU runs are Carter’s packages and are not implied by these fixtures. Calibration for every camera is `missing`. Road-region geometry is null.
