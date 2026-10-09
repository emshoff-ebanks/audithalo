import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/app/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata = {
  title: "Create account — AuditHalo",
};

export default async function RegisterPage() {
  // Already signed in → /dashboard. A logged-in user shouldn't be able to
  // accidentally double-register on a second account from this form.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <AuthShell
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[color:var(--text-primary)] underline">
            Sign in
          </Link>
        </>
      }
    >
      <p className="shell-eyebrow">Start free</p>
      <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
        Create your supervisor account
      </h1>
      <p className="text-sm text-[color:var(--text-secondary)] mt-2">
        Supervisees join later, by invite. They&apos;re always free.
      </p>
      <div className="mt-6">
        <RegisterForm />
      </div>
    </AuthShell>
  );
}
