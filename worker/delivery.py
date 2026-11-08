"""Bounded background HTTP delivery of already-durable worker evidence.

No payload queue is held in memory: notifications coalesce into one wake flag.
The existing disk outboxes own capacity, exact bytes, revisions and recovery.
"""

import math
import threading
import time

from worker.publish import PublishError


class BackgroundDelivery:
    """One sender thread; dependent measurements wait for core observations.

    Producers keep enqueue/checkpoint operations on their own thread. Each
    measurement outbox's publication gate prevents an incomplete plan from
    being leased even when an earlier notification is already being handled.
    """

    def __init__(self, core, measurements=None, *, retry_interval_s=1.0):
        if not math.isfinite(retry_interval_s) or retry_interval_s <= 0:
            raise ValueError("Delivery retry interval must be positive and finite.")
        self.core = core
        self.measurements = dict(measurements or {})
        self.retry_interval_s = retry_interval_s
        self._wake = threading.Event()
        self._lock = threading.Lock()
        self._closing = False
        self._halt = False
        self._deadline = None
        self._error = None
        self._passes = 0
        self._http_wall_s = 0.0
        self._thread = threading.Thread(target=self._run, name="evidence-delivery", daemon=True)
        self._thread.start()

    def notify(self):
        self.raise_if_failed()
        with self._lock:
            if self._closing:
                raise PublishError("Delivery is closing; durable queues were retained.")
        self._wake.set()

    def raise_if_failed(self):
        with self._lock:
            failed = self._error is not None
        if failed:
            # Original errors can contain endpoint or credential details.
            raise PublishError("Background evidence delivery failed; queued batches retained.") from None

    def _should_halt(self):
        with self._lock:
            return self._halt or (self._deadline is not None and time.monotonic() >= self._deadline)

    def _pending(self):
        return bool(self.core.pending() or any(box.pending() for box in self.measurements.values()))

    def _pass(self):
        sent = 0
        # Freeze eligible measurement bytes BEFORE the core-empty check. A
        # producer can commit new core + measurement evidence just after that
        # check; the new measurement must wait for the next core drain.
        watermarks = {}
        for camera, box in self.measurements.items():
            pending = box.pending()
            watermarks[camera] = pending[-1].name if pending else None
        # A single request per turn bounds reaction to shutdown and avoids one
        # camera's eight-request batch monopolizing every other camera's turn.
        if not self._should_halt():
            sent += self.core.flush(limit=1)
        if self.core.pending():
            return sent
        for camera, box in self.measurements.items():
            if self._should_halt():
                break
            if watermarks[camera] is not None:
                sent += box.flush(limit=1, through=watermarks[camera])
        return sent

    def _run(self):
        try:
            while not self._should_halt():
                began = time.monotonic()
                sent = self._pass()
                with self._lock:
                    self._passes += 1
                    self._http_wall_s += time.monotonic() - began
                    closing = self._closing
                pending = self._pending()
                if closing and not pending:
                    return
                if sent and pending:
                    continue
                self._wake.wait(self.retry_interval_s)
                self._wake.clear()
        except Exception as error:
            with self._lock:
                self._error = type(error).__name__

    def close(self, timeout_s=30.0):
        """Drain within a wall bound, then retain every unacknowledged body.

        An already leased HTTP request may outlive the caller's wait. No new
        request starts after the deadline; its eventual acknowledgement may
        safely retire only that immutable previously committed body.
        """
        if not math.isfinite(timeout_s) or timeout_s < 0:
            raise ValueError("Delivery shutdown timeout must be finite and nonnegative.")
        with self._lock:
            if not self._closing:
                self._closing = True
                self._deadline = time.monotonic() + timeout_s
        self._wake.set()
        self._thread.join(timeout_s)
        if self._thread.is_alive():
            with self._lock:
                self._halt = True
            self._wake.set()
            return False
        return True

    def diagnostic(self):
        with self._lock:
            return {"enabled": True, "thread_alive": self._thread.is_alive(),
                    "failure_type": self._error, "passes": self._passes,
                    "delivery_wall_s": self._http_wall_s,
                    "retry_interval_s": self.retry_interval_s}
