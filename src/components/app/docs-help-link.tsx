"use client";

import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { helpLinkForRoute } from "@/lib/docs-help-map";

// Renders the app-header help link. The target is contextual: it deep-links to
// the docs article most relevant to the current dashboard route (falling back
// to the docs index). Opens in a new tab so dashboard state is preserved.
export function DocsHelpLink() {
  const pathname = usePathname();
  const href = helpLinkForRoute(pathname);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Help and documentation"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 hover:text-foreground px-2 py-1"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline">Help</span>
    </a>
  );
}
