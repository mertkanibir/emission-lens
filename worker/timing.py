"""Estimate a session's media clock from its least-delayed received frame.

This removes burst delivery from relative frame placement. An unknown minimum
transport delay remains, so these estimates are never source capture UTC.
"""

from datetime import datetime, timedelta, timezone
import math

MEDIA_CLOCK_VERSION = "hls-min-anchor-v1"


def media_microseconds(seconds: float) -> int:
    if isinstance(seconds, bool) or not isinstance(seconds, (int, float)) or not math.isfinite(seconds) or not 0 <= seconds <= 10**12:
        raise ValueError("Media time must be finite and nonnegative.")
    return round(seconds * 1_000_000)


def duration_microseconds(delta: timedelta) -> int:
    return (delta.days * 86400 + delta.seconds) * 1_000_000 + delta.microseconds


class SessionMediaClock:
    """One camera session; never share an anchor across reconnects or cameras."""

    def __init__(self):
        self.anchor: datetime | None = None

    def observe(self, offset_us: int, received_at: datetime) -> None:
        if not isinstance(received_at, datetime) or received_at.tzinfo is None or received_at.utcoffset() is None:
            raise ValueError("An aware frame receipt timestamp is required.")
        try:
            candidate = received_at.astimezone(timezone.utc) - timedelta(microseconds=offset_us)
        except OverflowError:
            raise ValueError("Media time lies outside the supported UTC calendar.") from None
        self.anchor = min(self.anchor, candidate) if self.anchor is not None else candidate

    def at(self, offset_us: int) -> datetime:
        if self.anchor is None:
            raise ValueError("A received frame is required to anchor the media clock.")
        return self.anchor + timedelta(microseconds=offset_us)
