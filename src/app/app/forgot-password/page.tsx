import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Forgot your password? — AuditHalo",
};

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <p className="label-overline mb-4">Account recovery</p>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Reset your password
      </h1>
      <p className="mt-3 text-foreground/70">
        Enter the email on your AuditHalo account and we&apos;ll send you a link to
        choose a new password. The link expires in 1 hour.
      </p>

      <ForgotPasswordForm />

      <p className="mt-6 text-sm text-foreground/60">
        Remembered it?{" "}
        <Link href="/login" className="text-secondary font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
