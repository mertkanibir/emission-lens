"""Load and validate the per-camera config files in config/cameras/."""

from dataclasses import dataclass
from pathlib import Path

import yaml

DEFAULT_CAMERA_DIR = Path(__file__).resolve().parents[1] / "config" / "cameras"
REQUIRED_FIELDS = {"id", "name", "latitude", "longitude", "stream_url", "enabled"}


class CameraConfigError(ValueError):
    """A camera config file is missing data or holds an unusable value."""


@dataclass(frozen=True)
class CameraConfig:
    id: str
    name: str
    latitude: float
    longitude: float
    stream_url: str
    enabled: bool


def load_camera(path: Path) -> CameraConfig:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise CameraConfigError(f"{path.name}: expected a mapping of fields")

    missing = REQUIRED_FIELDS - raw.keys()
    if missing:
        raise CameraConfigError(f"{path.name}: missing {sorted(missing)}")

    camera = CameraConfig(**{field: raw[field] for field in REQUIRED_FIELDS})

    if not isinstance(camera.id, str) or camera.id != path.stem:
        raise CameraConfigError(f"{path.name}: id must be the string {path.stem!r}")
    if not -90 <= camera.latitude <= 90 or not -180 <= camera.longitude <= 180:
        raise CameraConfigError(f"{path.name}: coordinates out of range")
    # Chunklist URLs expire, so only the stable master playlist is accepted.
    if not camera.stream_url.endswith("/playlist.m3u8"):
        raise CameraConfigError(f"{path.name}: stream_url must be the master playlist")
    if not isinstance(camera.enabled, bool):
        raise CameraConfigError(f"{path.name}: enabled must be true or false")

    return camera


def load_cameras(directory: Path = DEFAULT_CAMERA_DIR) -> list[CameraConfig]:
    """Return the enabled cameras, sorted by id."""
    cameras = [load_camera(path) for path in sorted(directory.glob("*.yaml"))]
    return [camera for camera in cameras if camera.enabled]
