"""Optional wall-time playback of original live media; observation clocks stay intact."""
import math


class LiveMediaPacer:
    def __init__(self, buffer_s=4.0):
        if not math.isfinite(buffer_s) or buffer_s < 0 or buffer_s > 10:
            raise ValueError("Live playback buffer must be between zero and ten seconds.")
        self.buffer_s = buffer_s
        self._clocks = {}

    def delay(self, camera_id, session, media_time_s, monotonic_now):
        if not math.isfinite(media_time_s) or not math.isfinite(monotonic_now):
            raise ValueError("Playback needs finite original media and monotonic times.")
        clock = self._clocks.get(camera_id)
        if clock is None or session != clock[0]:
            clock = (session, media_time_s, monotonic_now + self.buffer_s, media_time_s)
            self._clocks[camera_id] = clock
        else:
            if media_time_s <= clock[3]:
                raise ValueError("Playback requires advancing media in each camera session.")
            self._clocks[camera_id] = (clock[0], clock[1], clock[2], media_time_s)
        return max(0.0, clock[2] + media_time_s - clock[1] - monotonic_now)
