"use client";

import { Moon, Sun } from "lucide-react";

/**
 * App-only dark-mode toggle (design-system-v2.md §3.2 — marketing stays
 * light). The actual theme state + persistence lives in AppShell so the
 * server can seed the initial class from the `ah-theme` cookie with no flash.
 */
export function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const goingDark = theme === "light";
  return (
    <button
      type="button"
      className="shell-icon-btn"
      onClick={onToggle}
      aria-label={goingDark ? "Switch to dark mode" : "Switch to light mode"}
      title={goingDark ? "Dark mode" : "Light mode"}
    >
      {goingDark ? <Moon /> : <Sun />}
    </button>
  );
}
