# Six-hour local runtime capacity

**Owner:** Mert

**Proposed and implemented scope (8 November 2026, 11:10 America/New_York / 16:10 UTC):** Mert requests maximum available GPU/CPU resources and runtime. Use the course account's six-hour allocation bound and two MIG devices; one reserved node supports at most96 CPU cores. Preserve the approved222/223 profiles, pretrained model,15FPS sampling and existing independent state. Larger reservations may queue; verified scheduling is distinct from availability.

The current measurement ledger contains roughly600 camera-minute snapshots. Another six hours on two cameras can add approximately720, exceeding the old1000-entry bound. Increase the shared read/write ceiling to2000; retain the32MiB byte cap,24-hour retention, validation, exact retries and all scientific/transport semantics. Core1.1 and measurement1.0 schemas are unchanged. Install matching writer and consumer builds before allowing the larger ledger. This is a bounded persistence-capacity change, not a scientific contract change.

Fresh worker bridges use the existing validated configurable limits of100000 events and480 minutes, rather than the default10000/240. Fresh outboxes and a canonical-minute floor prevent overlap with the drained predecessor and retained pending evidence. The worker deadline must leave startup/shutdown margin inside the scheduler bound. No guaranteed six-hour source availability, loss-free playback or accuracy follows. Acceptance and actual allocation end will be recorded after deployment.

**Source checkpoint (8 November 2026, 11:12 America/New_York / 16:12 UTC) — Mert:** All143 backend tests and contracts/backend/frontend TypeScript checks pass. The new boundary regression reloads2000 retained receipts, retries an exact original at capacity, rejects an additional receipt without changing existing bytes, and rejects over-capacity reload. Its initial fixture incorrectly replaced the original pre-privacy source digest and was corrected before the passing run. Production build, cutover and larger-allocation evidence follow separately.
