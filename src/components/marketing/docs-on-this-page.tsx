"use client";

import { useEffect, useState } from "react";
import type { DocHeading } from "@/lib/docs";

/**
 * The "On this page" rail (design-system marketing §09, `.mkt-docs-onthispage`).
 * Sticky right-column anchors to the article's h2/h3, with the currently
 * visible section highlighted in ink-900 (matching the mockup's `.active`).
 */
export function DocsOnThisPage({ headings }: { headings: DocHeading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");

  useEffect(() => {
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="sticky top-24 flex flex-col gap-2">
      <span className="label-overline">On this page</span>
      {headings.map((h) => {
        const active = h.id === activeId;
        return (
          <a
            key={h.id}
            href={`#${h.id}`}
            className={[
              "text-sm leading-snug transition-colors",
              h.level === 3 ? "pl-3" : "",
              active
                ? "font-medium text-[color:var(--ink-900)]"
                : "text-[color:var(--ink-500)] hover:text-[color:var(--ink-800)]",
            ].join(" ")}
          >
            {h.text}
          </a>
        );
      })}
    </nav>
  );
}
