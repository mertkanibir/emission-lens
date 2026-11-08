"use client";

import { useEffect, useState } from "react";

/** A local motion preference that never overrides the operating-system setting. */
export function MotionControl() {
  const [enabled, setEnabled] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      let preference: string | null = null;
      try {
        preference = window.localStorage.getItem("emission-lens-motion");
      } catch {
        /* Storage is optional. */
      }
      const next = !media.matches && preference !== "off";
      setReduced(media.matches);
      setEnabled(next);
      document.documentElement.dataset.motion = next ? "on" : "off";
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function toggle() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const next = !enabled;
    setEnabled(next);
    document.documentElement.dataset.motion = next ? "on" : "off";
    try {
      window.localStorage.setItem("emission-lens-motion", next ? "on" : "off");
    } catch {
      /* Storage is optional. */
    }
  }

  return (
    <button
      className="motion-control"
      type="button"
      onClick={toggle}
      disabled={reduced}
      aria-pressed={enabled}
      aria-label="Ambient motion"
      title={
        reduced
          ? "Motion is disabled by your system’s reduced-motion setting."
          : undefined
      }
      style={reduced ? { cursor: "default" } : undefined}
    >
      <span className="motion-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>Motion {enabled ? "on" : "off"}</span>
    </button>
  );
}
