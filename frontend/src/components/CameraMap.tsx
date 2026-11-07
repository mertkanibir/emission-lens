"use client";

import maplibregl, { type StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export interface MapCamera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  state: "live" | "degraded" | "offline";
  stateLabel: string;
  valueLabel: string;
  href: string;
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

const PAINT_OVERRIDES: Record<string, Record<string, unknown>> = {
  background: { "background-color": "#0a0f14" },
  water: { "fill-color": "#0d1822" },
  waterway: { "line-color": "#0d1822" },
  landuse_residential: { "fill-color": "#0d1318" },
  landcover_wood: { "fill-color": "#0e1714" },
  landuse_park: { "fill-color": "#0e1714" },
  building: { "fill-color": "#111920" },
  "aeroway-area": { "fill-color": "#0f161c" },
  "aeroway-taxiway": { "line-color": "#151d24" },
  "aeroway-runway-casing": { "line-color": "#1f2933" },
  "aeroway-runway": { "line-color": "#18212a" },
  highway_path: { "line-color": "#141c23" },
  highway_minor: { "line-color": "#18212a" },
  highway_major_casing: { "line-color": "#2a3743" },
  highway_major_inner: { "line-color": "#1c2730" },
  highway_major_subtle: { "line-color": "#24303b" },
  highway_motorway_casing: { "line-color": "#3a4856" },
  highway_motorway_inner: { "line-color": "#2c3945" },
  highway_motorway_subtle: { "line-color": "#24303b" },
  railway: { "line-color": "#1d262e" },
  railway_minor: { "line-color": "#1d262e" },
  railway_transit: { "line-color": "#1d262e" },
  highway_name_other: { "text-color": "#5d6b78" },
  highway_name_motorway: { "text-color": "#7b8996" },
};

function tintStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      const override = PAINT_OVERRIDES[layer.id];
      if (!override || !("paint" in layer)) return layer;
      return { ...layer, paint: { ...(layer.paint ?? {}), ...override } } as typeof layer;
    }),
  };
}

function cameraBounds(cameras: MapCamera[]): maplibregl.LngLatBoundsLike {
  const bounds = new maplibregl.LngLatBounds();
  for (const camera of cameras) bounds.extend([camera.longitude, camera.latitude]);
  return bounds;
}

function markerElement(camera: MapCamera, selected: boolean): HTMLAnchorElement {
  const anchor = document.createElement("a");
  anchor.className = "map-marker";
  anchor.href = camera.href;
  anchor.dataset.state = camera.state;
  anchor.dataset.selected = String(selected);
  anchor.style.zIndex = selected ? "3" : "1";
  anchor.setAttribute("aria-label", `Camera ${camera.id}, ${camera.name}, ${camera.stateLabel}, ${camera.valueLabel}`);
  if (selected) anchor.setAttribute("aria-current", "true");

  const pin = document.createElement("span");
  pin.className = "mm-pin";

  const tag = document.createElement("span");
  tag.className = "mm-tag";
  const signal = document.createElement("span");
  signal.className = "signal";
  signal.dataset.state = camera.state;
  signal.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
  const id = document.createElement("span");
  id.className = "mm-id";
  id.textContent = camera.id;
  const value = document.createElement("span");
  value.className = "mm-value";
  value.textContent = `${camera.stateLabel} / ${camera.valueLabel}`;
  tag.append(signal, id, value);

  anchor.append(pin, tag);
  return anchor;
}

export function CameraMap({ cameras, selectedId }: { cameras: MapCamera[]; selectedId: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const camerasRef = useRef(cameras);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const router = useRouter();

  camerasRef.current = cameras;
  const boundsKey = cameras.map((camera) => `${camera.id}:${camera.latitude},${camera.longitude}`).join("|");
  const markerKey = `${selectedId}|${cameras.map((camera) => `${camera.id}:${camera.state}:${camera.valueLabel}:${camera.href}`).join("|")}`;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let cancelled = false;
    let map: maplibregl.Map | null = null;

    fetch(STYLE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Style request failed with ${response.status}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .then((style) => {
        if (cancelled) return;
        const pad = Math.max(40, Math.min(110, Math.round(Math.min(element.clientWidth, element.clientHeight) / 5)));
        map = new maplibregl.Map({
          container: element,
          style: tintStyle(style),
          bounds: cameraBounds(camerasRef.current),
          fitBoundsOptions: { padding: pad, maxZoom: 14 },
          attributionControl: { compact: true },
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
        map.on("error", () => setProblem("Some map tiles did not load. The camera list is the record."));
        mapRef.current = map;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setProblem("The basemap did not load. The camera list is the record.");
      });

    return () => {
      cancelled = true;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [boundsKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = camerasRef.current.map((camera) => {
      const element = markerElement(camera, camera.id === selectedId);
      element.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        router.push(camera.href, { scroll: false });
      });
      const marker = new maplibregl.Marker({ element, anchor: "left", offset: [-6, 0] })
        .setLngLat([camera.longitude, camera.latitude])
        .addTo(map);
      element.removeAttribute("role");
      return marker;
    });
  }, [ready, markerKey, selectedId, router]);

  return (
    <>
      <div ref={container} className="map-canvas" role="region" aria-label="Map of camera locations" />
      {problem ? (
        <p className="map-overlay map-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </>
  );
}
