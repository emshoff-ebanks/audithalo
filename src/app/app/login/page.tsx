import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/app/auth-shell";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — AuditHalo",
};

export default async function LoginPage() {
  // Already authenticated → straight to the dashboard. Otherwise an
  // already-signed-in user landing here from the marketing site sees an
  // empty sign-in form they don't need to fill out.
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <AuthShell
      footer={
        <>
          Need an account?{" "}
          <Link href="/register" className="font-medium text-[color:var(--text-primary)] underline">
            Create one
          </Link>
        </>
      }
    >
      <p className="shell-eyebrow">Welcome back</p>
      <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
        Sign in
      </h1>
      <p className="text-sm text-[color:var(--text-secondary)] mt-2">
        Pick up your roster where you left off.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </AuthShell>
  );
}
