import type { FeatureCollection, Point } from "geojson";
import type { CircleLayerSpecification, HeatmapLayerSpecification, ExpressionSpecification } from "maplibre-gl";
import type { MapEmissionEstimate } from "./map-emissions";

export const EMISSIONS_SOURCE = "supported-camera-emissions";
export const EMISSIONS_LAYER = "supported-camera-emissions-heat";
export const EMISSIONS_RING_LAYER = "supported-camera-emissions-ring";
export const EMISSIONS_CORE_LAYER = "supported-camera-emissions-core";
/** Shared by the point layer and legend; fixed display scale, not a risk scale. */
export const EMISSIONS_COLOR_SCALE = [
  { value: 0, color: "#c8e1d0" },
  { value: 25, color: "#91b18d" },
  { value: 50, color: "#899260" },
  { value: 100, color: "#8f653f" },
] as const;

export function cameraHeatData(cameras: readonly {
  id: string;
  latitude: number;
  longitude: number;
  emissions: MapEmissionEstimate | null;
}[]): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: cameras.flatMap((camera) => {
      const reading = camera.emissions;
      if (!reading || !Number.isFinite(reading.co2_g) || reading.co2_g < 0
        || !Number.isFinite(camera.latitude) || !Number.isFinite(camera.longitude)) return [];
      return [{
        type: "Feature" as const,
        id: camera.id,
        geometry: { type: "Point" as const, coordinates: [camera.longitude, camera.latitude] },
        properties: { camera_id: camera.id, minute: reading.minute, co2_g: reading.co2_g },
      }];
    }),
  };
}

/** Screen-space camera glyphs only. Radius/color do not represent geographic coverage or risk. */
export const emissionsHeatLayer: HeatmapLayerSpecification = {
  id: EMISSIONS_LAYER,
  type: "heatmap",
  source: EMISSIONS_SOURCE,
  layout: { visibility: "none" },
  paint: {
    "heatmap-weight": ["interpolate", ["linear"], ["get", "co2_g"], 0, 0, 0.001, 0.22, 10, 0.4, 50, 0.75, 100, 1],
    "heatmap-intensity": 1.4,
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 38, 13, 68, 16, 96],
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
      0, "rgba(128,182,151,0)", 0.2, "rgba(128,182,151,0.18)",
      0.5, "rgba(170,192,141,0.38)", 0.75, "rgba(211,196,145,0.5)", 1, "rgba(173,135,83,0.65)"],
    "heatmap-opacity": 0.78,
  },
};

export const emissionsRingLayer: CircleLayerSpecification = {
  id: EMISSIONS_RING_LAYER,
  type: "circle",
  source: EMISSIONS_SOURCE,
  filter: [">", ["get", "co2_g"], 0],
  layout: { visibility: "none" },
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 21, 13, 30, 16, 42],
    "circle-color": "rgba(21,54,41,0.06)",
    "circle-stroke-color": "rgba(235,243,221,0.65)",
    "circle-stroke-width": 1,
  },
};

export const emissionsCoreLayer: CircleLayerSpecification = {
  id: EMISSIONS_CORE_LAYER,
  type: "circle",
  source: EMISSIONS_SOURCE,
  filter: [">", ["get", "co2_g"], 0],
  layout: { visibility: "none" },
  paint: {
    "circle-radius": 19,
    "circle-color": ["interpolate", ["linear"], ["get", "co2_g"], ...EMISSIONS_COLOR_SCALE.flatMap(({ value, color }) => [value, color])] as ExpressionSpecification,
    "circle-stroke-color": "#fffce9",
    "circle-stroke-width": 2,
    "circle-opacity": 0.95,
  },
};
