"""Deliver aggregate-only worker batches with a bounded, restartable outbox.

The outbox contains no credentials or frames. Each request keeps its batch ID
across retries so an interrupted HTTP response cannot duplicate observations.
"""

import json
import os
import tempfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


class PublishError(RuntimeError):
    """Delivery failed without exposing endpoint or credential details."""


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        # A misconfigured endpoint must never forward a bearer token elsewhere.
        return None


class HttpSender:
    def __init__(self, url: str, token: str, timeout_s: float = 3.0):
        parsed = urlsplit(url)
        if parsed.username or parsed.password or parsed.fragment:
            raise ValueError("The ingest endpoint must not contain credentials or fragments.")
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            raise ValueError("The ingest endpoint must be an HTTP(S) URL.")
        if parsed.scheme == "http" and parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
            if os.environ.get("EMISSION_LENS_ALLOW_HTTP") != "1":
                raise ValueError("Use HTTPS or a loopback tunnel; private HTTP requires EMISSION_LENS_ALLOW_HTTP=1.")
        if not token or "\n" in token or "\r" in token:
            raise ValueError("A nonempty worker token is required.")
        self._url = url
        self._token = token
        self._timeout_s = timeout_s
        self._opener = build_opener(_NoRedirect())

    def __call__(self, body: bytes) -> bool:
        request = Request(
            self._url,
            data=body,
            headers={"Authorization": "Bearer " + self._token, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with self._opener.open(request, timeout=self._timeout_s) as response:
                return 200 <= response.status < 300
        except HTTPError as error:
            if error.code in {408, 425, 429} or error.code >= 500:
                return False
            raise PublishError(f"Worker batch rejected with HTTP {error.code}; queued batch retained.") from None
        except (URLError, TimeoutError, OSError):
            return False


class Outbox:
    """One runtime owns an outbox directory; disk capacity fails closed."""

    def __init__(self, directory: Path, sender, max_batches: int = 256, max_bytes: int = 8_000_000):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.sender = sender
        self.max_batches = max_batches
        self.max_bytes = max_bytes
        self.delivered = 0
        self.attempts = 0

    def pending(self) -> list[Path]:
        return sorted(self.directory.glob("*.json"))

    def enqueue(self, envelope: dict) -> None:
        # JSON encoding also rejects NaN/Infinity before anything reaches disk.
        body = (json.dumps(envelope, allow_nan=False, separators=(",", ":")) + "\n").encode()
        batch_id = envelope["batch_id"]
        if not isinstance(batch_id, str) or any(c not in "0123456789abcdef-" for c in batch_id) or len(batch_id) != 36:
            raise ValueError("Expected a UUID batch ID.")
        # Time prefix provides FIFO order even when requests use random UUIDs.
        existing = list(self.directory.glob("*-" + batch_id + ".json"))
        if existing:
            if existing[0].read_bytes() != body:
                raise PublishError("A queued batch ID cannot be reused with different content.")
            return
        queued = self.pending()
        if len(queued) >= self.max_batches or sum(p.stat().st_size for p in queued) + len(body) > self.max_bytes:
            raise PublishError("Worker outbox is full; undelivered batches were preserved.")
        import time

        path = self.directory / f"{time.time_ns():020d}-{batch_id}.json"
        fd, temporary = tempfile.mkstemp(prefix=".batch-", dir=self.directory)
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(body)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def flush(self, limit: int = 8) -> int:
        sent = 0
        for path in self.pending()[:limit]:
            self.attempts += 1
            if not self.sender(path.read_bytes()):
                break
            path.unlink()
            sent += 1
            self.delivered += 1
        return sent
