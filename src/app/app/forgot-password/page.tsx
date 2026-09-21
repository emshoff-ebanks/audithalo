import Link from "next/link";
import { AuthShell } from "@/components/app/auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Forgot your password? — AuditHalo",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-[color:var(--text-primary)] underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <p className="shell-eyebrow">Account recovery</p>
      <h1 className="font-display text-2xl font-semibold text-[color:var(--text-primary)] mt-1">
        Reset your password
      </h1>
      <p className="text-sm text-[color:var(--text-secondary)] mt-2">
        Enter the email on your AuditHalo account and we&apos;ll send you a link to
        choose a new password. The link expires in 1 hour.
      </p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
    </AuthShell>
  );
}
