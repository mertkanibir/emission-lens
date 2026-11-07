"use client";

import { useState } from "react";

/** Slider and number stay in sync; only the number is submitted. */
export function ReductionInput({ defaultValue, id }: { defaultValue: number; id: string }) {
  const [value, setValue] = useState(String(defaultValue));
  const numeric = Number(value);

  return (
    <div className="range-field">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Number.isFinite(numeric) ? Math.min(100, Math.max(0, numeric)) : 0}
        onChange={(event) => setValue(event.target.value)}
        aria-controls={id}
        aria-label="Stopped-time reduction slider"
      />
      <div className="range-number">
        <input
          id={id}
          name="reduce"
          type="number"
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <span aria-hidden="true">%</span>
      </div>
    </div>
  );
}
