import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/authz";

export const metadata = { title: "Admin — AuditHalo" };

const adminNavLinks = [
  { href: "/admin/orgs", label: "Orgs" },
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
    <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <p className="shell-eyebrow">Workspace admin</p>
      </div>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-1.5">
        {adminNavLinks.map((l) => (
          <Link key={l.href} href={l.href} className="chip">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
