import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashAuthToken } from "@/lib/auth-tokens";
import { AuthShell } from "@/components/app/auth-shell";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Reset password — AuditHalo",
};

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tokenHash = hashAuthToken(token);

  const row = await db.query.authTokens.findFirst({
    where: and(
      eq(schema.authTokens.tokenHash, tokenHash),
      eq(schema.authTokens.kind, "password_reset"),
      isNull(schema.authTokens.usedAt)
    ),
  });

  const expired = !!row && row.expiresAt.getTime() < Date.now();

  if (!row || expired) {
    return (
      <AuthShell>
        <span className="status-pill status-risk mb-3 inline-flex">
          {expired ? "Expired" : "Invalid"}
        </span>
        <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
          {expired ? "This reset link has expired." : "This reset link is invalid."}
        </h1>
        <p className="text-sm text-[color:var(--text-secondary)] mt-2">
          Request a fresh link — they expire after 1 hour for security.
        </p>
        <p className="mt-6 text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-[color:var(--text-primary)] underline"
          >
            Request a new reset link
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="shell-eyebrow">Set a new password</p>
      <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
        Choose a new password
      </h1>
      <p className="text-sm text-[color:var(--text-secondary)] mt-2">
        Pick something at least 8 characters long. You&apos;ll sign in with this from
        now on.
      </p>
      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </AuthShell>
  );
}
