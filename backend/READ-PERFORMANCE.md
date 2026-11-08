# Query responsiveness

**Owner:** Mert
**Updated:** 8 November 2026, 09:20 America/New_York / 8 November 2026, 14:20 UTC

Repeated measurement reads previously parsed/validated the full retained ledger and materialized all measurements on every call. Query-only reads now share a deeply immutable validated snapshot keyed by device/inode/size/nanosecond modification and change times. Atomic replacements, corruption, disappearance and recreation invalidate it. Writer transactions still call the original fresh mutable read. Immutable materialization is reused only while the snapshot identity and current registry digest match; registry revocations are not hidden by the cache.

The isolated four-camera benchmark retains identical complete output hashes across all four baseline and candidate batches. Warm median is975.83ms before versus50.45ms after; cold sample1314.20ms versus382.63ms. This is a local captured-ledger read benchmark, not GPU inference, sustained network latency or field accuracy. [Scalar receipt](../evaluation/read-performance-20261108.json).

All130 existing backend tests plus four targeted view/writer/invalidation tests pass, as does backend TypeScript. Frontend link canonicalization preserves explicit reporting-hour resets. Per-number global observers/subscriptions were removed; changed visible numbers retain brief motion without changing their values. Final web/browser acceptance is separate.
