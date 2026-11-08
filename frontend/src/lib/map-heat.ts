import type { FeatureCollection, Point } from "geojson";
import type { HeatmapLayerSpecification } from "maplibre-gl";
import type { MapEmissionEstimate } from "./map-emissions";

export const EMISSIONS_SOURCE = "supported-camera-emissions";
export const EMISSIONS_LAYER = "supported-camera-emissions-heat";

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
      if (!reading || !Number.isFinite(reading.co2_g) || reading.co2_g < 0) return [];
      return [{
        type: "Feature" as const,
        id: camera.id,
        geometry: { type: "Point" as const, coordinates: [camera.longitude, camera.latitude] },
        properties: { camera_id: camera.id, minute: reading.minute, co2_g: reading.co2_g },
      }];
    }),
  };
}

/** Camera-point display weights; the glow has no dispersion or exposure meaning. */
export const emissionsHeatLayer: HeatmapLayerSpecification = {
  id: EMISSIONS_LAYER,
  type: "heatmap",
  source: EMISSIONS_SOURCE,
  layout: { visibility: "none" },
  paint: {
    "heatmap-weight": ["interpolate", ["linear"], ["get", "co2_g"], 0, 0, 10, 0.3, 50, 0.7, 100, 1],
    "heatmap-intensity": 4,
    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 26, 13, 65, 16, 90],
    "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
      0, "rgba(74,156,96,0)", 0.1, "rgba(74,156,96,0.7)",
      0.3, "#a7bd60", 0.55, "#e4b65e", 0.8, "#d88639", 1, "#b85c32"],
    "heatmap-opacity": 0.75,
  },
};
