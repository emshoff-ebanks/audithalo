import Link from "next/link";
import { AuditHaloMark } from "@/components/brand/AuditHaloMark";

/**
 * Centered brand frame for the signed-out auth pages (login, register,
 * password reset, email verify, accept-invite). Renders the AuditHalo mark
 * over a single v2 panel; marketing/app dark-mode class is applied upstream
 * in app/layout. design-system-v2.md §3 (surfaces), §8 (forms).
 */
export function AuthShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          aria-label="AuditHalo home"
          className="inline-flex items-center gap-2 mb-8"
        >
          <AuditHaloMark className="h-6 w-6" />
          <span className="font-display text-lg font-bold tracking-tight text-[color:var(--text-primary)]">
            AuditHalo
          </span>
        </Link>
        <div className="panel">{children}</div>
        {footer && (
          <div className="mt-6 text-sm text-[color:var(--text-secondary)] text-center">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
