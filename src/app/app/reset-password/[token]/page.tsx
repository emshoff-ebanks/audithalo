import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { hashAuthToken } from "@/lib/auth-tokens";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="mx-auto max-w-md px-6 py-20">
        <Badge variant="risk" className="mb-4">
          {expired ? "Expired" : "Invalid"}
        </Badge>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          {expired
            ? "This reset link has expired."
            : "This reset link is invalid."}
        </h1>
        <p className="mt-3 text-foreground/70">
          Request a fresh link — they expire after 1 hour for security.
        </p>
        <p className="mt-6 text-sm">
          <Link
            href="/forgot-password"
            className="text-secondary font-medium hover:underline"
          >
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <Badge variant="outline" className="mb-4">
        Set a new password
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Choose a new password
      </h1>
      <p className="mt-3 text-foreground/70">
        Pick something at least 8 characters long. You'll sign in with this from
        now on.
      </p>

      <Card className="mt-8">
        <CardContent className="p-6">
          <ResetPasswordForm token={token} />
        </CardContent>
      </Card>
    </div>
  );
}
