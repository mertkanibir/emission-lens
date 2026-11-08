"use client";

import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./camera-map.css";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowsOut } from "@phosphor-icons/react";
import type { MapEmissionEstimate } from "@/lib/map-emissions";
import { cameraHeatData, EMISSIONS_SOURCE, emissionsHeatLayer, emissionsCoreLayer, emissionsRingLayer } from "@/lib/map-heat";
import { formatInstant, PACIFIC, type MapView } from "@/lib/format";
import { scenarioValue } from "@/lib/scenario-presentation";

export interface MapCamera {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  state: "live" | "degraded" | "offline";
  stateLabel: string;
  valueLabel: string;
  href: string;
  emissions: MapEmissionEstimate | null;
  secondaryValueLabel: string | null;
}
/** Raster imagery avoids a separate third-party style/font dependency. */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: "raster",
      tiles: ["https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener noreferrer">Esri</a>, Vantor, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [{ id: "satellite-imagery", type: "raster", source: "satellite", paint: { "raster-saturation": -0.2, "raster-brightness-max": 0.82 } }],
};
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
  view,
}: {
  cameras: MapCamera[];
  selectedId: string | null;
  view: MapView;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const camerasRef = useRef(cameras);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const previous = useRef(selectedId);
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [heatReady, setHeatReady] = useState(false);
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
    let map: maplibregl.Map | null = null;
    let observer: ResizeObserver | null = null;
    let cancelled = false;
    try {
      map = new maplibregl.Map({
        container: element,
        style: SATELLITE_STYLE,
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
      map.once("style.load", () => {
        if (!cancelled) setReady(true);
      });
    } catch {
      if (!cancelled) setProblem("The map is unavailable. Use the camera table below to explore every intersection.");
    }
    return () => {
      cancelled = true;
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
    let cancelled = false;
    const update = () => {
      try {
        if (!map.getSource(EMISSIONS_SOURCE))
          map.addSource(EMISSIONS_SOURCE, { type: "geojson", data: cameraHeatData(camerasRef.current) });
        for (const layer of [emissionsHeatLayer, emissionsRingLayer, emissionsCoreLayer]) {
          if (!map.getLayer(layer.id)) map.addLayer(layer);
          map.setLayoutProperty(layer.id, "visibility", view === "emissions" ? "visible" : "none");
        }
        const source = map.getSource(EMISSIONS_SOURCE) as maplibregl.GeoJSONSource;
        void source.setData(cameraHeatData(camerasRef.current)).then(() => {
          if (!cancelled) setHeatReady(true);
        }).catch(() => {
          if (!cancelled) {
            setHeatReady(false);
            setProblem("The emissions heat layer could not load. Camera records remain available below.");
          }
        });
      } catch {
        if (!cancelled) {
          setHeatReady(false);
          setProblem("The emissions heat layer could not load. Camera records remain available below.");
        }
      }
    };
    // Style readiness is independent of raster tile delivery. Later source loads
    // must not defer a mode change onto a one-time map load event.
    update();
    return () => {
      cancelled = true;
    };
  }, [ready, markerKey, view]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((marker) => marker.remove());
    // Keep nearby supported labels apart without moving their geographic pins.
    const supported = camerasRef.current.filter((camera) => camera.emissions !== null)
      .sort((a, b) => b.latitude - a.latitude);
    const labelPositions = new Map<string, "above" | "below">();
    if (supported.length === 2) {
      const [north, south] = supported;
      const a = map.project([north.longitude, north.latitude]);
      const b = map.project([south.longitude, south.latitude]);
      if (Math.abs(a.y - b.y) < 85 && Math.abs(a.x - b.x) < 260) {
        labelPositions.set(north.id, "above");
        labelPositions.set(south.id, "below");
      }
    }
    markersRef.current = camerasRef.current.map((camera) => {
      const anchor = document.createElement("a");
      anchor.className = "map-marker";
      anchor.href = camera.href;
      anchor.dataset.state = camera.state;
      anchor.dataset.view = view;
      anchor.dataset.labelPosition = labelPositions.get(camera.id) ?? "center";
      anchor.dataset.supported = String(camera.emissions !== null);
      anchor.dataset.selected = String(camera.id === selectedId);
      anchor.setAttribute(
        "aria-label",
        `Camera ${camera.id}, ${camera.name}, ${camera.stateLabel}, ${camera.valueLabel}${camera.secondaryValueLabel ? `, ${camera.secondaryValueLabel}` : ""}${view === "emissions" && camera.emissions ? `, latest supported minute ${formatInstant(camera.emissions.minute, PACIFIC)}` : ""}`,
      );
      anchor.title = anchor.getAttribute("aria-label")!;
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
      if (camera.secondaryValueLabel) {
        const secondary = document.createElement("small");
        secondary.textContent = camera.secondaryValueLabel;
        detail.append(secondary);
      }
      anchor.append(number, detail);
      if (view === "emissions" && camera.emissions) {
        const badge = document.createElement("span");
        badge.className = "mm-emission-reading";
        const label = document.createElement("span");
        label.className = "mm-emission-label";
        label.textContent = "Estimated CO₂";
        const amount = document.createElement("strong");
        amount.textContent = scenarioValue(camera.emissions.co2_g, "g", false, camera.emissions.co2_g >= 1 ? 1 : 6);
        const scope = document.createElement("small");
        scope.textContent = formatInstant(camera.emissions.minute, PACIFIC);
        badge.append(label, amount, scope);
        anchor.append(badge);
      }
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
  }, [ready, markerKey, selectedId, router, view]);

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
        aria-label={view === "emissions" ? "Heat map of latest supported camera emissions" : "Map of camera locations"}
        data-basemap="satellite"
        data-map-ready={ready}
        data-heat-layer-ready={heatReady}
        data-heat-points={cameraHeatData(cameras).features.length}
      />
      {view === "emissions" ? (
        <div className="map-heat-status" role="status">
          <span className="map-heat-status-dot" aria-hidden="true" />
          <strong>{cameraHeatData(cameras).features.length} / {cameras.length} supported stations</strong>
          <small>Completed movements · dated minute records</small>
        </div>
      ) : null}
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
