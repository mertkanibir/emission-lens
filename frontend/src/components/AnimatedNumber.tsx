"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DURATION_MS = 650;

/** Decorative interpolation; assistive technology always receives the exact record. */
export function AnimatedNumber({
  value,
  digits = 1,
}: {
  value: number;
  digits?: number;
}) {
  // The server and first client render both contain the real formatted value.
  const [displayed, setDisplayed] = useState(value);
  const previousValue = useRef<number | null>(null);
  const formatter = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }),
    [digits],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const root = document.documentElement;
    const from = previousValue.current ?? 0;
    previousValue.current = value;
    let frame: number | null = null;
    let cancelled = false;

    const allowed = () => !media.matches && root.dataset.motion !== "off";
    const snap = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      setDisplayed(value);
    };
    const preferenceChanged = () => {
      if (!allowed()) {
        cancelled = true;
        snap();
      }
    };
    const observer = new MutationObserver(preferenceChanged);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    media.addEventListener("change", preferenceChanged);

    if (
      !allowed() ||
      value === 0 ||
      from === value ||
      !Number.isFinite(value) ||
      !Number.isFinite(from)
    ) {
      snap();
    } else {
      const started = performance.now();
      const minimum = Math.min(from, value);
      const maximum = Math.max(from, value);
      setDisplayed(from);
      const tick = (now: number) => {
        if (cancelled || !allowed()) {
          snap();
          return;
        }
        const progress = Math.min(
          1,
          Math.max(0, (now - started) / DURATION_MS),
        );
        const eased = 1 - Math.pow(1 - progress, 3);
        const next = Math.min(
          maximum,
          Math.max(minimum, from + (value - from) * eased),
        );
        setDisplayed(progress === 1 ? value : next);
        frame = progress < 1 ? window.requestAnimationFrame(tick) : null;
      };
      frame = window.requestAnimationFrame(tick);
    }

    return () => {
      cancelled = true;
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", preferenceChanged);
    };
  }, [value]);

  return (
    <>
      <span className="visually-hidden">{formatter.format(value)}</span>
      <span className="animated-number" aria-hidden="true">
        {formatter.format(value === 0 ? 0 : displayed)}
      </span>
    </>
  );
}
