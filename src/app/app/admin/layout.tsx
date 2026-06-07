import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/authz";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Admin — AuditHalo" };

const adminNavLinks = [
  { href: "/admin/rule-drift", label: "Rule drift" },
  { href: "/admin/founding-supervisors", label: "Founding Supervisors" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link href="/dashboard">
          <ArrowLeft />
          Back to dashboard
        </Link>
      </Button>
      <Badge variant="outline" className="mb-3">
        Admin
      </Badge>
      <nav
        aria-label="Admin sections"
        className="mb-6 flex flex-wrap gap-x-2 gap-y-1.5 text-xs"
      >
        {adminNavLinks.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
