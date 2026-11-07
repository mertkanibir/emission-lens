import pytest

from worker.config import CameraConfigError, load_camera, load_cameras

VALID = """\
id: "999"
name: Test Camera
latitude: 33.8
longitude: -118.3
stream_url: https://example.com/CCTV-999.stream/playlist.m3u8
enabled: true
"""


def write(tmp_path, text, name="999.yaml"):
    path = tmp_path / name
    path.write_text(text, encoding="utf-8")
    return path


def test_project_configs_load_all_four_cameras():
    assert [camera.id for camera in load_cameras()] == ["220", "222", "223", "228"]


def test_valid_camera_loads(tmp_path):
    camera = load_camera(write(tmp_path, VALID))
    assert camera.id == "999"
    assert camera.latitude == 33.8


def test_disabled_camera_is_skipped(tmp_path):
    write(tmp_path, VALID.replace("enabled: true", "enabled: false"))
    assert load_cameras(tmp_path) == []


@pytest.mark.parametrize(
    "text, message",
    [
        (VALID.replace("name: Test Camera\n", ""), "missing"),
        (VALID.replace('id: "999"', "id: 999"), "id must be"),
        (VALID.replace('id: "999"', 'id: "998"'), "id must be"),
        (VALID.replace("latitude: 33.8", "latitude: 133.8"), "coordinates"),
        (VALID.replace("playlist.m3u8", "chunklist_w123.m3u8"), "master playlist"),
        (VALID.replace("enabled: true", 'enabled: "yes"'), "enabled"),
        ("- not\n- a mapping\n", "mapping"),
    ],
)
def test_bad_camera_is_rejected(tmp_path, text, message):
    with pytest.raises(CameraConfigError, match=message):
        load_camera(write(tmp_path, text))
