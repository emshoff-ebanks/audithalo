import Link from "next/link";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { verifyEmailAction } from "@/app/actions/account";
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
  const result = await verifyEmailAction(token);
  const session = await auth();
  const isSignedIn = !!session?.user;

  if (result.ok) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <Badge variant="success" className="mb-4">
          Verified
        </Badge>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Email verified
        </h1>
        <p className="mt-3 text-foreground/70">
          Thanks — you&apos;ll now receive supervision notifications, evidence
          packages, and account alerts at this address.
        </p>
        <div className="mt-8">
          <Button asChild className="w-full">
            <Link href={isSignedIn ? "/dashboard" : "/login"}>
              {isSignedIn ? "Go to dashboard" : "Sign in"}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <Badge variant="risk" className="mb-4">
        Link unusable
      </Badge>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        We couldn&apos;t verify your email
      </h1>
      <p className="mt-3 text-foreground/70">{result.error}</p>

      <div className="mt-8 space-y-3">
        {isSignedIn ? (
          <ResendVerificationButton />
        ) : (
          <Button asChild className="w-full">
            <Link href="/login">Sign in to request a new link</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
