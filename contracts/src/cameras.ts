import type { Camera, CameraCalibration } from "./types.ts";

/** Verified 7 November 2026. Road regions and gates are not configured yet. */
export const CAMERAS: Camera[] = [
  {
    id: "222",
    name: "SR-107 at Carson Boulevard",
    latitude: 33.83135,
    longitude: -118.35286,
    stream_url: "https://wzmedia.dot.ca.gov/D7/CCTV-222.stream/playlist.m3u8",
    road_region: null,
    enabled: true,
  },
  {
    id: "223",
    name: "SR-107 at Torrance Boulevard",
    latitude: 33.83777,
    longitude: -118.35391,
    stream_url: "https://wzmedia.dot.ca.gov/D7/CCTV-223.stream/playlist.m3u8",
    road_region: null,
    enabled: true,
  },
  {
    id: "228",
    name: "SR-107 at 182nd Street",
    latitude: 33.865469,
    longitude: -118.352406,
    stream_url: "https://wzmedia.dot.ca.gov/D7/CCTV-228.stream/playlist.m3u8",
    road_region: null,
    enabled: true,
  },
  {
    id: "220",
    name: "SR-1 at Crenshaw Boulevard",
    latitude: 33.79214,
    longitude: -118.3335,
    stream_url: "https://wzmedia.dot.ca.gov/D7/CCTV-220.stream/playlist.m3u8",
    road_region: null,
    enabled: true,
  },
];

export const CALIBRATIONS: CameraCalibration[] = CAMERAS.map((camera) => ({
  camera_id: camera.id,
  version: "unconfigured",
  gates: null,
  reference_measurements: null,
  transform: null,
  validation_status: "missing",
}));

export function cameraById(id: string): Camera | undefined {
  return CAMERAS.find((camera) => camera.id === id);
}

export function calibrationFor(cameraId: string): CameraCalibration {
  return (
    CALIBRATIONS.find((row) => row.camera_id === cameraId) ?? {
      camera_id: cameraId,
      version: "unconfigured",
      gates: null,
      reference_measurements: null,
      transform: null,
      validation_status: "missing",
    }
  );
}
