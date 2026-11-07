# HLS minute alignment

**Owner:** Mert
**Updated:** 7 November 2026, 18:49 America/New_York / 23:49 UTC

Vehicle observations are assigned to a session-local estimated media clock:

```text
anchor = minimum(received_at - media_time) over that session's observed frames
estimated frame time = anchor + media_time
```

A running minimum alone is insufficient: every rapidly delivered startup frame may improve the anchor, leaving online-only assignments clustered at receipt time. The aggregator therefore keeps scalar per-class prefix sums and media offsets, then rebins all session observations against the latest anchor. It retains no images or temporary vehicle IDs. Binary searches split occupied minutes at exact integer-microsecond boundaries without repeatedly scanning every frame or filling source gaps with zeros. Each camera/reconnect has independent timing state.

Stable camera-minute batch UUIDs and higher revisions correct already-published windows. Retractions are sent before replacement counts. An empty batch revision removes the old minute rows from the retained ledger; it neither fabricates a zero nor poisons strict totals with an unavailable placeholder. FIFO outbox sequencing survives a backward wall-clock adjustment and process restart. During a multi-batch correction the display can temporarily have incomplete data; it does not add moved counts twice.

## Verification

- Controlled tests place a 30-second startup backlog across the correct estimated minute boundaries.
- A retained-ledger simulation checks every retraction/fill for count inflation, with an independent offline minimum-anchor reference across burst delivery, jitter, multiple sessions, classes and queues.
- Exact minute edges use the same microsecond rounding as datetime arithmetic.
- Backend tests verify that empty higher revisions remove old rows, retries remain idempotent, stale revisions conflict, and estimated/mixed timing bases are disclosed without changing synthetic provenance.
- The [live timing record](./hls-clock-20261107.json) observes camera 222 for 30 seconds: 204 advancing frames, no reader drops, one session, a **25.060645-second anchor improvement**, and clean reader shutdown. The check stores scalar timing metadata only. Receipt and estimated-frame bins happened to fall in the same UTC minute in this sample; boundary redistribution is verified by the controlled tests.

Run the focused Python checks from the repository root with Python 3.12:

```bash
python -m unittest discover -s tests -p test_timing.py -v
python -m unittest discover -s tests -p test_aggregate.py -v
python -m unittest discover -s tests -p test_publish.py -v
npm test
npm run typecheck
```

## Meaning and limits

The least-delayed observed frame still has an unknown minimum transport delay. The estimate does not establish source capture UTC, end-to-end latency or validated footage coverage; `last_source_timestamp` and capture-based `processing_delay_ms` remain null. Preview banners and heartbeats continue to describe receipt/processing progress. Replay alignment uses playback receipts rather than original recording UTC.

The method is supplied by Mert's timing handoff and validated here; no universal 30-second HLS backlog or latency guarantee is inferred. Prior receipt-based records are not retroactively moved without their source observations. Reconnects can replay overlapping source footage, so this timing correction alone does not prove cross-session deduplication or validated vehicle counts. Physical calibration, class mappings and emissions remain separate evidence requirements. This timing change enables no real measurement geometry.
