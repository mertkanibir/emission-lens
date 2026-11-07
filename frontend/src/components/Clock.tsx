"use client";

import { useEffect, useState } from "react";
import { formatClock, PACIFIC, zoneAbbreviation } from "@/lib/format";

/** Wall clock. It is not the data clock; pages show that separately as "data as of". */
export function Clock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date().toISOString());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="clock" role="timer" aria-label="Current time in Torrance and UTC">
      <span>
        {now ? formatClock(now, PACIFIC) : "--:--:--"}
        <small>{now ? zoneAbbreviation(now, PACIFIC) : "PT"}</small>
      </span>
      <span>
        {now ? formatClock(now, "UTC") : "--:--:--"}
        <small>UTC</small>
      </span>
    </div>
  );
}
