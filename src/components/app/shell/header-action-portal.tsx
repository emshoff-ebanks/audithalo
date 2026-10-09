"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Portals a page's primary action into the global top-bar slot
 * (`#app-header-action`, rendered by AppShell). Pages inject a header action
 * without the shell needing to know about it.
 *
 * Renders nothing on the server / before hydration (the slot only exists
 * client-side); once mounted it reads the slot and portals into it. Uses
 * useSyncExternalStore for the mount check so there's no setState-in-effect.
 */
const emptySubscribe = () => () => {};

export function HeaderActionPortal({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  if (!mounted) return null;
  const target = document.getElementById("app-header-action");
  if (!target) return null;
  return createPortal(children, target);
}
