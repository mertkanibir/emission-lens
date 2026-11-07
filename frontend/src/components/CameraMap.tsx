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
  background: { "background-color": "#07141a" },
  water: { "fill-color": "#061016" },
  waterway: { "line-color": "#061016" },
  landuse_residential: { "fill-color": "#0b1b23" },
  landcover_wood: { "fill-color": "#0b2026" },
  landuse_park: { "fill-color": "#0b2026" },
  building: { "fill-color": "#102731" },
  "aeroway-area": { "fill-color": "#0f161c" },
  "aeroway-taxiway": { "line-color": "#151d24" },
  "aeroway-runway-casing": { "line-color": "#1f2933" },
  "aeroway-runway": { "line-color": "#234a59" },
  highway_path: { "line-color": "#141c23" },
  highway_minor: { "line-color": "#234a59" },
  highway_major_casing: { "line-color": "#2a3743" },
  highway_major_inner: { "line-color": "#1b3a46" },
  highway_major_subtle: { "line-color": "#234956" },
  highway_motorway_casing: { "line-color": "#477b89" },
  highway_motorway_inner: { "line-color": "#316171" },
  highway_motorway_subtle: { "line-color": "#234956" },
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
      if (!("paint" in layer)) return layer;
      const paint = { ...(layer.paint ?? {}), ...override } as Record<string, unknown>;
      // The dark style references an unavailable wood-pattern sprite. Solid fills
      // also keep the basemap quieter than the camera observations.
      delete paint["fill-pattern"];
      return { ...layer, paint } as typeof layer;
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
  const id = document.createElement("span");
  id.className = "mm-id";
  id.textContent = camera.id;
  const value = document.createElement("span");
  value.className = "mm-value";
  value.textContent = camera.stateLabel;
  anchor.title = `${camera.name} · ${camera.valueLabel}`;
  tag.append(id, value);

  anchor.append(pin, tag);
  return anchor;
}

export function CameraMap({ cameras, selectedId }: { cameras: MapCamera[]; selectedId: string | null }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const camerasRef = useRef(cameras);
  const previousSelection = useRef(selectedId);
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
    let resizeObserver: ResizeObserver | null = null;

    fetch(STYLE_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`Style request failed with ${response.status}`);
        return response.json() as Promise<StyleSpecification>;
      })
      .then((style) => {
        if (cancelled) return;
        const desktop = element.clientWidth > 760;
        const compact = element.clientWidth <= 1090;
        const padding = desktop
          ? { top: 245, bottom: 244, left: compact ? 290 : 330, right: compact ? 390 : 430 }
          : { top: 100, bottom: 92, left: 62, right: 110 };
        map = new maplibregl.Map({
          container: element,
          style: tintStyle(style),
          bounds: cameraBounds(camerasRef.current),
          fitBoundsOptions: { padding, maxZoom: 13.6 },
          pitch: desktop ? 28 : 0,
          bearing: desktop ? -12 : 0,
          attributionControl: { compact: true },
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");
        map.on("error", () => setProblem("Some map tiles did not load. The camera list is the record."));
        mapRef.current = map;
        resizeObserver = new ResizeObserver(() => {
          if (!map) return;
          const wide = element.clientWidth > 760;
          const narrow = element.clientWidth <= 1090;
          map.resize();
          map.fitBounds(cameraBounds(camerasRef.current), {
            padding: wide
              ? { top: 245, bottom: 244, left: narrow ? 290 : 330, right: narrow ? 390 : 430 }
              : { top: 100, bottom: 92, left: 62, right: 110 },
            pitch: wide ? 28 : 0,
            bearing: wide ? -12 : 0,
            duration: 0,
            maxZoom: 13.6,
          });
        });
        resizeObserver.observe(element);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setProblem("The basemap did not load. The camera list is the record.");
      });

    return () => {
      cancelled = true;
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
      resizeObserver?.disconnect();
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

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || previousSelection.current === selectedId) return;
    previousSelection.current = selectedId;
    const camera = camerasRef.current.find((item) => item.id === selectedId);
    if (!camera) return;
    const animate = document.documentElement.dataset.motion !== "off" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.easeTo({ center: [camera.longitude, camera.latitude], duration: animate ? 850 : 0 });
  }, [ready, selectedId]);

  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    const animate = document.documentElement.dataset.motion !== "off" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    map.fitBounds(cameraBounds(camerasRef.current), { duration: animate ? 900 : 0, maxZoom: 13.6 });
  }

  return (
    <>
      <div ref={container} className="map-canvas" role="region" aria-label="Map of camera locations" />
      <button className="map-reset" onClick={resetView} type="button" disabled={!ready}>Fit network <span aria-hidden="true">↗</span></button>
      {problem ? (
        <p className="map-overlay map-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </>
  );
}
