"use client";

import { useEffect, useState } from "react";
import type { Mode } from "@emission-lens/contracts";

interface Preview {
  received_at: string;
  processed_at: string;
  image_data_url: string;
}

export function CameraPreview({ cameraId, mode }: { cameraId: string; mode: Mode }) {
  const [frame, setFrame] = useState<Preview | null>(null);
  const [now, setNow] = useState(Date.now());
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setFrame(null);
    setAvailable(false);
    if (mode === "synthetic") return;
    let cancelled = false;
    let inFlight = false;
    const controller = new AbortController();
    const update = async () => {
      setNow(Date.now());
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch(`/api/cameras/${cameraId}/frame?mode=${mode}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Frame unavailable");
        const value = await response.json() as Preview;
        if (!cancelled) { setFrame(value); setAvailable(true); }
      } catch {
        if (!cancelled) setAvailable(false);
      } finally { inFlight = false; }
    };
    void update();
    const timer = window.setInterval(() => void update(), 3000);
    document.addEventListener("visibilitychange", update);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [cameraId, mode]);
  const age = frame ? Math.max(0, (now - Date.parse(frame.received_at)) / 1000) : Infinity;
  const retained = frame !== null && age < 60;
  const current = available && age <= 20;
  return (
    <div className="viewport">
      {retained ? (
        // The image and boxes are encoded together from one worker frame.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="camera-preview-image" src={frame.image_data_url} alt={`Camera ${cameraId}, ${mode} frame with vehicle detections, received ${frame.received_at}. Capture time unavailable.`} />
      ) : null}
      <span className="burn-in burn-in-tl">Camera {cameraId} · {mode.toUpperCase()}</span>
      <span className="burn-in burn-in-tr">{retained ? current ? "Processed frame" : "Delayed frame" : "Frame unavailable"}</span>
      {retained ? (
        <span className="preview-timestamp">Received {new Date(frame.received_at).toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour12: false })} Pacific · capture UTC unavailable</span>
      ) : (
        <div className="viewport-msg">
          <span className="section-kicker">Evidence first</span>
          <strong>No synchronized video frame yet</strong>
          <span>{mode === "synthetic" ? "Synthetic records have no camera footage." : "The worker can send temporary frames with their matching detection overlays. Frames expire after 60 seconds."}</span>
        </div>
      )}
    </div>
  );
}
