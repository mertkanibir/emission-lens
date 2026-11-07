import json
from datetime import datetime, timezone

import pytest

from worker.config import CameraConfig
from worker.record_clips import CameraRecording, child_playlist_url, parse_segments

MASTER_URL = "https://example.com/CCTV-999.stream/playlist.m3u8"
CHILD_URL = "https://example.com/CCTV-999.stream/chunklist_w1.m3u8"
CAMERA = CameraConfig("999", "Test", 33.8, -118.3, MASTER_URL, True)
MASTER = "#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nchunklist_w1.m3u8\n"


def child(first, count):
    lines = ["#EXTM3U", "#EXT-X-TARGETDURATION:13", f"#EXT-X-MEDIA-SEQUENCE:{first}"]
    for sequence in range(first, first + count):
        lines += ["#EXTINF:10.0,", f"media_w1_{sequence}.ts"]
    return "\n".join(lines) + "\n"


class FakeServer:
    def __init__(self, playlists):
        self.playlists = list(playlists)
        self.downloads = []
        self.fail_text = False

    def fetch_text(self, url):
        if self.fail_text:
            raise OSError("down")
        if url == MASTER_URL:
            return MASTER
        return self.playlists[0] if len(self.playlists) == 1 else self.playlists.pop(0)

    def fetch_bytes(self, url):
        self.downloads.append(url)
        return url.rsplit("_", 1)[1].encode()


def recording(tmp_path, server):
    return CameraRecording(
        CAMERA, tmp_path, datetime(2026, 11, 7, 22, 0, tzinfo=timezone.utc),
        fetch_text=server.fetch_text, fetch_bytes=server.fetch_bytes,
    )


def test_child_playlist_url_resolves_relative_to_master():
    assert child_playlist_url(MASTER_URL, MASTER) == CHILD_URL


def test_parse_segments_numbers_from_media_sequence():
    segments = parse_segments(CHILD_URL, child(25, 3))
    assert [s.sequence for s in segments] == [25, 26, 27]
    assert segments[0].url == "https://example.com/CCTV-999.stream/media_w1_25.ts"
    assert segments[0].duration_s == 10.0


def test_parse_segments_rejects_a_playlist_without_a_sequence():
    with pytest.raises(ValueError):
        parse_segments(CHILD_URL, "#EXTM3U\n#EXTINF:10.0,\nmedia.ts\n")


def test_each_segment_is_saved_once_in_order(tmp_path):
    server = FakeServer([child(1, 3), child(2, 3), child(3, 3)])
    clip = recording(tmp_path, server)
    assert [clip.poll(), clip.poll(), clip.poll()] == [3, 1, 1]
    assert clip.clip_path.read_bytes() == b"1.ts2.ts3.ts4.ts5.ts"
    assert clip.record["gaps"] == 0


def test_expired_segments_are_counted_as_a_gap(tmp_path):
    server = FakeServer([child(1, 2), child(10, 2)])
    clip = recording(tmp_path, server)
    clip.poll()
    clip.poll()
    assert clip.record["gaps"] == 1
    assert [s["sequence"] for s in clip.record["segments"]] == [1, 2, 10, 11]


def test_a_failed_playlist_fetch_is_retried_on_the_next_poll(tmp_path):
    server = FakeServer([child(1, 2)])
    clip = recording(tmp_path, server)
    server.fail_text = True
    assert clip.poll() == 0
    server.fail_text = False
    assert clip.poll() == 2
    assert clip.record["errors"] == 1


def test_record_file_keeps_source_and_replay_label(tmp_path):
    clip = recording(tmp_path, FakeServer([child(1, 2)]))
    clip.poll()
    clip.save_record()
    saved = json.loads(clip.record_path.read_text(encoding="utf-8"))
    assert saved["mode"] == "replay"
    assert saved["source_url"] == MASTER_URL
    assert saved["seconds"] == 20.0
    assert clip.clip_path.name == "999_20261107T220000Z.ts"
