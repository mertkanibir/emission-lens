"use client";

import { useEffect, useRef, useState } from "react";
import type { Mode } from "@emission-lens/contracts";
import { isNewPreview, medianPreviewInterval, parseSelectedPreview, PREVIEW_POLL_MS, PREVIEW_TTL_MS, type ProcessedPreview } from "@/lib/preview-cadence";
import "./camera-preview.css";

export function CameraPreview({ cameraId, mode, inferenceFps }: { cameraId: string; mode: Mode; inferenceFps?: number | null }) {
  const [frame, setFrame] = useState<ProcessedPreview | null>(null);
  const [now, setNow] = useState(Date.now());
  const [available, setAvailable] = useState(false);
  const [cadence, setCadence] = useState<number | null>(null);
  const frameRef = useRef<ProcessedPreview | null>(null);
  useEffect(() => {
    frameRef.current = null;
    setFrame(null);
    setAvailable(false);
    setCadence(null);
    if (mode === "synthetic") return;
    let cancelled = false;
    let inFlight = false;
    let activeRequest: AbortController | null = null;
    const intervals: number[] = [];
    const update = async () => {
      setNow(Date.now());
      if (cancelled || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      const controller = new AbortController();
      activeRequest = controller;
      const timeout = window.setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch(`/api/cameras/${cameraId}/frame?mode=${mode}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Frame unavailable");
        const next = parseSelectedPreview(await response.json(), cameraId, mode, Date.now());
        if (cancelled) return;
        const previous = frameRef.current;
        if (isNewPreview(next, previous)) {
          if (previous && next.run_id === previous.run_id && next.session === previous.session) {
            intervals.push((Date.parse(next.processed_at) - Date.parse(previous.processed_at)) / 1000);
            if (intervals.length > 6) intervals.shift();
          } else intervals.length = 0;
          frameRef.current = next;
          setFrame(next);
          setCadence(medianPreviewInterval(intervals));
        }
        setAvailable(true);
      } catch {
        if (!cancelled && document.visibilityState === "visible") setAvailable(false);
      } finally {
        window.clearTimeout(timeout);
        if (activeRequest === controller) activeRequest = null;
        inFlight = false;
      }
    };
    const visibilityChanged = () => {
      if (document.visibilityState !== "visible") activeRequest?.abort();
      else void update();
    };
    void update();
    const timer = window.setInterval(() => void update(), PREVIEW_POLL_MS);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => { cancelled = true; activeRequest?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", visibilityChanged); };
  }, [cameraId, mode]);
  const age = frame ? Math.max(0, (now - Date.parse(frame.received_at)) / 1000) : Infinity;
  const retained = frame !== null && age < PREVIEW_TTL_MS / 1000;
  const current = available && age <= 20;
  const validFps = inferenceFps !== null && inferenceFps !== undefined && Number.isFinite(inferenceFps) && inferenceFps >= 0;
  return (
    <>
      <div className="viewport">
        {retained ? (
          // The image and boxes are encoded together from one worker frame.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="camera-preview-image" src={frame.image_data_url} alt={`Camera ${cameraId}, ${mode} frame with vehicle detections, received ${frame.received_at}. Capture time unavailable.`} />
        ) : null}
        <span className="burn-in burn-in-tl">Camera {cameraId} · {mode.toUpperCase()}</span>
        <span className="burn-in burn-in-tr">{retained ? current ? "Processed snapshot" : "Delayed snapshot" : "Frame unavailable"}</span>
        {retained ? (
          <span className="preview-timestamp">Received {new Date(frame.received_at).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour12: false })} Pacific · capture UTC unavailable</span>
        ) : (
          <div className="viewport-msg">
            <span className="section-kicker">Evidence first</span>
            <strong>No synchronized video frame yet</strong>
            <span>{mode === "synthetic" ? "Synthetic records have no camera footage." : "Temporary processed snapshots include matching detection overlays and expire after 60 seconds."}</span>
          </div>
        )}
      </div>
      {mode !== "synthetic" ? <div className="preview-runtime" aria-label="Processing and preview cadence">
        <span><strong>Latest worker rate</strong>{validFps ? `${inferenceFps.toFixed(1)} frames/s` : "Unavailable"}</span>
        <span><strong>Observed snapshot spacing</strong>{cadence === null ? "Awaiting a second snapshot" : `${cadence.toFixed(1)} s`}</span>
        <span><strong>Frame received</strong>{retained ? `${Math.floor(age)} s ago` : "Unavailable"}</span>
        <p>Processed snapshots are separate from inference throughput. Visible-tab checks every 750 ms pick up new frames sooner; they do not create additional source frames.</p>
      </div> : null}
    </>
  );
}
