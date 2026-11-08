# Controlled delivery scheduling

**Owner:** Mert  
**Updated:** 8 November 2026, 03:33 America/New_York / 08:33 UTC  
**Status:** Controlled local I/O scheduling comparison passed. Live GPU runtime replacement remains separately reviewed.

The worker previously performed HTTP on its frame-processing thread. The new sender keeps durable disk publication and measurement checkpoints on that thread, then delivers immutable FIFO bodies on one background thread. A per-pass measurement watermark prevents a concurrently published dependent body from overtaking its core observations. Disk capacity, revisions, retries and fail-closed checkpoint recovery remain in the existing outboxes.

[Scalar results](./delivery-scheduling-20261108.json) record three alternating-order paired trials on the same machine. Each trial performed 80 synthetic two-millisecond work iterations and published ten identical bodies to a local HTTP endpoint that delayed every successful response by 40 milliseconds. Both schedules used the same durable `Outbox` and `HttpSender`; the baseline reproduces the old synchronous scheduling algorithm. This is an I/O experiment, not a replay of camera inference.

| Median across three trials | Synchronous HTTP | Background HTTP |
|---|---:|---:|
| Processing-loop wall time | 1.065 s | 0.249 s |
| End-to-end time including drain | 1.065 s | 0.819 s |
| Maximum producer publication time per trial | 132.5 ms | 1.41 ms |
| Delivered batches per trial | 10 | 10 |
| Pending batches after drain | 0 | 0 |

The processing-loop wall time was 76.6% lower in this controlled workload. All six runs delivered identical ordered bytes, with ten requests and no retained pending bodies. The report retains every trial, source hashes, Python/platform versions and settings; host scheduling and filesystem contention vary. End-to-end drain is explicitly included, and asynchronous delivery does not increase network capacity. Slow endpoints can still fill bounded disk queues and fail closed.

The full-runtime mocked-input test separately holds its first core HTTP call and proves another frame reaches tracking before release, then verifies both core and measurement queues drain and the sender stops. A scheduling-barrier test publishes new evidence immediately after an empty-core check and verifies the new dependent waits until core delivery. Other sender tests cover transient exact-byte retries, incomplete checkpoint publication, fatal rejection and bounded shutdown.

Reproduce from the repository root:

```bash
python -m unittest discover -s tests -p 'test_delivery_benchmark.py' -q
python -m evaluation.delivery_benchmark --output /tmp/delivery-scheduling.json
```

No GPU frame rate, capture-to-dashboard latency, traffic/count accuracy, field emissions accuracy or environmental benefit follows from these synthetic iterations. Durable fsync still blocks producers. The existing pretrained detector, 640 image size, requested 15 FPS, camera policies, calibration, factors and approval scopes are unchanged. No protected worker was restarted for this experiment.
