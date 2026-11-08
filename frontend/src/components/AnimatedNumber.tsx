"use client";

import { useEffect, useMemo, useRef } from "react";

const FEEDBACK_MS = 160;

function stopAnimation(animation: { current: Animation | null }) {
  animation.current?.cancel();
  animation.current = null;
}

/** Exact record values, with brief visual feedback only when a visible value changes. */
export function AnimatedNumber({
  value,
  digits = 1,
}: {
  value: number;
  digits?: number;
}) {
  const visual = useRef<HTMLSpanElement>(null);
  const previousValue = useRef(value);
  const animation = useRef<Animation | null>(null);
  const formatter = useMemo(
    () => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }),
    [digits],
  );

  useEffect(() => {
    const changed = previousValue.current !== value;
    previousValue.current = value;
    stopAnimation(animation);
    const element = visual.current;
    if (
      !changed ||
      !element ||
      !Number.isFinite(value) ||
      document.visibilityState !== "visible" ||
      document.documentElement.dataset.motion === "off" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof element.animate !== "function"
    ) {
      return;
    }
    const bounds = element.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
    // No per-number global observers or subscriptions: only visible changed values animate.
    // The displayed number never changes during feedback; only its presentation does.
    const effect = element.animate(
      [
        { opacity: 0.65, transform: "translateY(2px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: FEEDBACK_MS, easing: "ease-out" },
    );
    animation.current = effect;
    effect.onfinish = () => {
      if (animation.current === effect) animation.current = null;
    };
    return () => stopAnimation(animation);
  }, [value]);

  const formatted = formatter.format(value);
  return (
    <>
      <span className="visually-hidden">{formatted}</span>
      <span
        ref={visual}
        className="animated-number"
        aria-hidden="true"
        style={{ display: "inline-block" }}
      >
        {formatted}
      </span>
    </>
  );
}
