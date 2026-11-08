import type { FeatureCollection, Point } from "geojson";
import type { CircleLayerSpecification, HeatmapLayerSpecification } from "maplibre-gl";
import type { MapEmissionEstimate } from "./map-emissions";

export const EMISSIONS_SOURCE = "supported-camera-emissions";
export const EMISSIONS_LAYER = "supported-camera-emissions-heat";
export const EMISSIONS_RING_LAYER = "supported-camera-emissions-ring";
export const EMISSIONS_CORE_LAYER = "supported-camera-emissions-core";

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
    "heatmap-intensity": 1.8,
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 50, 13, 96, 16, 130],
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
      0, "rgba(40,210,165,0)", 0.12, "rgba(40,210,165,0.22)",
      0.3, "rgba(105,225,143,0.65)", 0.5, "#e8e777", 0.75, "#ffb451", 1, "#f37042"],
    "heatmap-opacity": 0.9,
  },
};

export const emissionsRingLayer: CircleLayerSpecification = {
  id: EMISSIONS_RING_LAYER,
  type: "circle",
  source: EMISSIONS_SOURCE,
  filter: [">", ["get", "co2_g"], 0],
  layout: { visibility: "none" },
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 22, 13, 38, 16, 52],
    "circle-color": "rgba(21,54,41,0.12)",
    "circle-stroke-color": "rgba(236,255,226,0.8)",
    "circle-stroke-width": 1.5,
  },
};

export const emissionsCoreLayer: CircleLayerSpecification = {
  id: EMISSIONS_CORE_LAYER,
  type: "circle",
  source: EMISSIONS_SOURCE,
  filter: [">", ["get", "co2_g"], 0],
  layout: { visibility: "none" },
  paint: {
    "circle-radius": 20,
    "circle-color": ["interpolate", ["linear"], ["get", "co2_g"], 0, "#40d6a4", 25, "#ddeb81", 50, "#ffbd61", 100, "#f37042"],
    "circle-stroke-color": "#fffce9",
    "circle-stroke-width": 2,
    "circle-opacity": 0.95,
  },
};
