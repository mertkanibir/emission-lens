"use client";

import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowsOut } from "@phosphor-icons/react";

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
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
function softenStyle(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type === "background")
        return {
          ...layer,
          paint: { ...layer.paint, "background-color": "#f6f0e4" },
        };
      if (layer.type !== "fill") return layer;
      const color = /water/i.test(layer.id)
        ? "#d2e2dc"
        : /park|wood|grass|landcover/i.test(layer.id)
          ? "#d5e1bf"
          : null;
      if (!color) return layer;
      const paint = { ...layer.paint, "fill-color": color };
      delete paint["fill-pattern"];
      return { ...layer, paint };
    }),
  };
}
function boundsFor(cameras: MapCamera[]) {
  const bounds = new maplibregl.LngLatBounds();
  for (const camera of cameras)
    bounds.extend([camera.longitude, camera.latitude]);
  return bounds;
}
function motionAllowed() {
  return (
    document.documentElement.dataset.motion !== "off" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
export function CameraMap({
  cameras,
  selectedId,
}: {
  cameras: MapCamera[];
  selectedId: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const camerasRef = useRef(cameras);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const previous = useRef(selectedId);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const router = useRouter();
  camerasRef.current = cameras;
  const markerKey = JSON.stringify(cameras);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    // Emit the matching worker as a local asset; its default sibling URL is lost during bundling.
    maplibregl.setWorkerUrl(
      new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href,
    );
    const controller = new AbortController();
    let map: maplibregl.Map | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;
    fetch(STYLE_URL, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Map style unavailable");
        return response.json() as Promise<StyleSpecification>;
      })
      .then((style) => {
        if (cancelled) return;
        map = new maplibregl.Map({
          container: element,
          style: softenStyle(style),
          bounds: boundsFor(camerasRef.current),
          fitBoundsOptions: {
            padding: { top: 48, bottom: 48, left: 55, right: 140 },
            maxZoom: 13.5,
          },
          attributionControl: { compact: true },
          cooperativeGestures: true,
        });
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        map.addControl(
          new maplibregl.ScaleControl({ unit: "metric" }),
          "bottom-left",
        );
        map.on("error", () =>
          setProblem(
            "Some map tiles could not load. All camera records remain available in the table.",
          ),
        );
        observer = new ResizeObserver(() => {
          if (!map || element.clientWidth === 0 || element.clientHeight === 0)
            return;
          map.resize();
          map.fitBounds(boundsFor(camerasRef.current), {
            padding: {
              top: 48,
              bottom: 48,
              left: 55,
              right: Math.min(140, element.clientWidth / 3),
            },
            maxZoom: 13.5,
            duration: 0,
          });
        });
        observer.observe(element);
        mapRef.current = map;
        setReady(true);
      })
      .catch((error) => {
        if (!cancelled && error.name !== "AbortError")
          setProblem(
            "The map is unavailable. Use the camera table below to explore every intersection.",
          );
      });
    return () => {
      cancelled = true;
      controller.abort();
      observer?.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = camerasRef.current.map((camera) => {
      const anchor = document.createElement("a");
      anchor.className = "map-marker";
      anchor.href = camera.href;
      anchor.dataset.state = camera.state;
      anchor.dataset.selected = String(camera.id === selectedId);
      anchor.setAttribute(
        "aria-label",
        `Camera ${camera.id}, ${camera.name}, ${camera.stateLabel}, ${camera.valueLabel}`,
      );
      if (camera.id === selectedId) anchor.setAttribute("aria-current", "true");
      const number = document.createElement("span");
      number.className = "mm-number";
      number.textContent = camera.id;
      const detail = document.createElement("span");
      detail.className = "mm-detail";
      const street = document.createElement("span");
      street.className = "mm-street";
      street.textContent = camera.name.split(" at ").at(-1) ?? camera.name;
      const reading = document.createElement("strong");
      reading.textContent = camera.valueLabel;
      detail.append(street, reading);
      anchor.append(number, detail);
      anchor.addEventListener("click", (event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.button !== 0
        )
          return;
        event.preventDefault();
        router.push(camera.href, { scroll: false });
      });
      const marker = new maplibregl.Marker({
        element: anchor,
        anchor: "left",
        offset: [-20, 0],
      })
        .setLngLat([camera.longitude, camera.latitude])
        .addTo(map);
      anchor.removeAttribute("role");
      return marker;
    });
  }, [ready, markerKey, selectedId, router]);

  useEffect(() => {
    if (!ready || previous.current === selectedId) return;
    previous.current = selectedId;
    const camera = camerasRef.current.find((item) => item.id === selectedId);
    if (camera)
      mapRef.current?.easeTo({
        center: [camera.longitude, camera.latitude],
        duration: motionAllowed() ? 320 : 0,
      });
  }, [ready, selectedId]);

  function reset() {
    mapRef.current?.fitBounds(boundsFor(camerasRef.current), {
      padding: {
        top: 55,
        bottom: 55,
        left: 45,
        right: Math.min(160, (container.current?.clientWidth ?? 480) / 3),
      },
      maxZoom: 13.5,
      duration: motionAllowed() ? 320 : 0,
    });
  }
  return (
    <>
      <div
        className="map-canvas"
        ref={container}
        role="region"
        aria-label="Map of camera locations"
      />
      <button
        className="map-reset"
        type="button"
        disabled={!ready}
        onClick={reset}
      >
        <ArrowsOut size={15} /> Fit all cameras
      </button>
      {problem ? (
        <p className="map-problem" role="alert">
          {problem}
        </p>
      ) : null}
    </>
  );
}
