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
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing)
        return;
      let returnFocus: HTMLElement | null = null;
      for (const menu of menus()) {
        if (!menu.open) continue;
        if (menu.contains(document.activeElement)) {
          returnFocus = menu.querySelector<HTMLElement>(":scope > summary");
        }
        menu.open = false;
      }
      if (returnFocus) {
        event.preventDefault();
        returnFocus.focus({ preventScroll: true });
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
