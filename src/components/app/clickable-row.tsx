"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Drop-in <tr> wrapper that makes the whole row clickable. Click navigates
 * to `href`. Clicks landing on a nested anchor or button delegate to that
 * element's handler instead (so action buttons + sub-links inside the row
 * keep working without double-firing).
 *
 * Keep at least one real <Link> inside the row for accessibility — keyboard
 * focus, middle-click "open in new tab", and screen readers all rely on
 * a real anchor element being present.
 */
export function ClickableRow({
  href,
  className = "",
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className={`cursor-pointer transition-colors ${className}`}
      onClick={(ev) => {
        const target = ev.target as HTMLElement;
        if (target.closest("a, button, input, select, textarea, label")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
