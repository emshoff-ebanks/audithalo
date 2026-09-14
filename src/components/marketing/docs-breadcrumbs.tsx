import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  name: string;
  href?: string; // last crumb has no href (current page)
}

export function DocsBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-foreground/60">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3 w-3 text-foreground/30" />}
            {c.href ? (
              <Link href={c.href} className="hover:text-foreground transition-colors">
                {c.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground/80">
                {c.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
