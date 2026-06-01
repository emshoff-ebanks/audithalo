import Link from "next/link";

export const metadata = {
  title: "Create account — AuditHalo",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <p className="label-overline mb-4">Application</p>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Create account
      </h1>
      <p className="mt-3 text-foreground/70">
        Registration wiring lands with Auth.js in the next pass.
      </p>
      <p className="mt-8 text-sm text-foreground/60">
        Already have an account?{" "}
        <Link href="/login" className="text-secondary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
