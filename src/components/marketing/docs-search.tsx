"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { SearchEntry } from "@/lib/docs-nav";

export function DocsSearch({ index }: { index: SearchEntry[] }) {
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return [];
    return index.filter((e) => e.text.includes(q)).slice(0, 8);
  }, [index, q]);

  const open = q.length > 0;

  // Close the results on Escape or a click outside the search widget.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setQuery("");
    }
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setQuery("");
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the docs"
          aria-label="Search the docs"
          aria-expanded={open}
          aria-controls="docs-search-results"
          role="combobox"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground/40 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div
          id="docs-search-results"
          className="absolute z-40 mt-2 w-full rounded-sm border border-border bg-card shadow-md"
        >
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-foreground/60">
              No articles match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto py-1" role="listbox">
              {results.map((r) => (
                <li key={r.path} role="option" aria-selected={false}>
                  <Link
                    href={`/docs/${r.path}`}
                    className="block px-4 py-2.5 hover:bg-evidence-bg/60"
                    onClick={() => setQuery("")}
                  >
                    <span className="block text-sm font-medium text-foreground">
                      {r.title}
                    </span>
                    <span className="block text-xs text-foreground/60">
                      {r.categoryLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
