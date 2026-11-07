"use client";

import { useEffect, useState } from "react";

/** An explicit motion preference, with the operating-system setting as the default. */
export function MotionControl() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      let preference: string | null = null;
      try { preference = window.localStorage.getItem("emission-lens-motion"); } catch { /* Storage is optional. */ }
      const next = preference === null ? !media.matches : preference === "on";
      setEnabled(next);
      document.documentElement.dataset.motion = next ? "on" : "off";
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    document.documentElement.dataset.motion = next ? "on" : "off";
    try { window.localStorage.setItem("emission-lens-motion", next ? "on" : "off"); } catch { /* Storage is optional. */ }
  }

  return (
    <button className="motion-control" type="button" onClick={toggle} aria-pressed={enabled} aria-label="Ambient motion">
      <span className="motion-bars" aria-hidden="true"><i /><i /><i /></span>
      <span>Motion {enabled ? "on" : "off"}</span>
    </button>
  );
}
