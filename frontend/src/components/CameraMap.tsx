"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

export interface MapCamera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  stateLabel: string;
  href: string;
}

export function CameraMap({ cameras }: { cameras: MapCamera[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (!container.current) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-118.343, 33.83],
        zoom: 10.2,
      });
    } catch {
      setProblem("The map did not start. The camera list below is the record.");
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.on("error", () => {
      setProblem("Map tiles did not load. The camera list below is the record.");
    });
    for (const camera of cameras) {
      const marker = document.createElement("a");
      marker.className = `map-pin map-pin-${camera.stateLabel}`;
      marker.href = camera.href;
      marker.textContent = camera.stateLabel;
      marker.setAttribute("aria-label", `${camera.name}, ${camera.stateLabel}`);
      new maplibregl.Marker({ element: marker })
        .setLngLat([camera.longitude, camera.latitude])
        .addTo(map);
    }
    return () => map.remove();
  }, [cameras]);

  return (
    <div className="map-shell">
      <div ref={container} className="map-canvas" />
      {problem ? <p className="map-problem">{problem}</p> : null}
      <p className="map-note">Unconfigured road regions are not drawn. Marker text repeats the status.</p>
    </div>
  );
}
