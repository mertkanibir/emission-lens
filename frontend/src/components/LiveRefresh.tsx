"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Mode } from "@emission-lens/contracts";

/** Re-read server records, retaining current navigation and local form state. */
export function LiveRefresh({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (mode === "synthetic") return;
    const refresh = () => {
      if (!pending && document.visibilityState === "visible" && !document.querySelector("form :focus")) {
        startTransition(() => router.refresh());
      }
    };
    const timer = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [mode, router, pending]);
  return null;
}
