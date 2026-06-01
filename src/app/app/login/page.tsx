import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in — AuditHalo",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <p className="label-overline mb-4">Welcome back</p>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Sign in
      </h1>
      <p className="mt-3 text-foreground/70">
        Pick up your roster where you left off.
      </p>

      <LoginForm />

      <p className="mt-6 text-sm text-foreground/60">
        Need an account?{" "}
        <Link href="/register" className="text-secondary font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
