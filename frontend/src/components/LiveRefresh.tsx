"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Mode } from "@emission-lens/contracts";

/** Re-read server records, retaining current navigation and local form state. */
export function LiveRefresh({ mode }: { mode: Mode }) {
  const router = useRouter();
  useEffect(() => {
    if (mode === "synthetic") return;
    const refresh = () => {
      if (document.visibilityState === "visible" && !document.querySelector("form :focus")) {
        router.refresh();
      }
    };
    const timer = window.setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [mode, router]);
  return null;
}
