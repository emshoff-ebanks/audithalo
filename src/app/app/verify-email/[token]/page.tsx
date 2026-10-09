import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/app/auth-shell";
import { verifyEmailToken } from "@/lib/verify-email";
import { ResendVerificationButton } from "./resend-button";

export const metadata = {
  title: "Verify email — AuditHalo",
};

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyEmailToken(token);
  const session = await auth();
  const isSignedIn = !!session?.user;

  if (result.ok) {
    return (
      <AuthShell>
        <span className="status-pill status-ok mb-3 inline-flex">Verified</span>
        <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
          Email verified
        </h1>
        <p className="text-sm text-[color:var(--text-secondary)] mt-2">
          Thanks — you&apos;ll now receive supervision notifications, evidence
          packages, and account alerts at this address.
        </p>
        <div className="mt-6">
          <Button asChild className="w-full">
            <Link href={isSignedIn ? "/dashboard" : "/login"}>
              {isSignedIn ? "Go to dashboard" : "Sign in"}
            </Link>
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <span className="status-pill status-risk mb-3 inline-flex">Link unusable</span>
      <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
        We couldn&apos;t verify your email
      </h1>
      <p className="text-sm text-[color:var(--text-secondary)] mt-2">{result.error}</p>
      <div className="mt-6 space-y-3">
        {isSignedIn ? (
          <ResendVerificationButton />
        ) : (
          <Button asChild className="w-full">
            <Link href="/login">Sign in to request a new link</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
