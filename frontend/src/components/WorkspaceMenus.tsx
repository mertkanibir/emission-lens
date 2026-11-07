"use client";

import { useEffect } from "react";

/** Small native menus: one open at a time, dismiss outside or with Escape. */
export function WorkspaceMenus() {
  useEffect(() => {
    const menus = () =>
      document.querySelectorAll<HTMLDetailsElement>("details[data-menu]");
    const outside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      for (const menu of menus())
        if (menu.open && !menu.contains(event.target)) menu.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const menu of menus())
        if (menu.open) {
          menu.open = false;
          menu.querySelector("summary")?.focus();
        }
    };
    const exclusive = (event: Event) => {
      if (
        !(event.target instanceof HTMLDetailsElement) ||
        !event.target.hasAttribute("data-menu") ||
        !event.target.open
      )
        return;
      for (const menu of menus()) if (menu !== event.target) menu.open = false;
    };
    document.addEventListener("click", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("toggle", exclusive, true);
    return () => {
      document.removeEventListener("click", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("toggle", exclusive, true);
    };
  }, []);
  return null;
}
