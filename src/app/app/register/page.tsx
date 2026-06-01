import Link from "next/link";
import { RegisterForm } from "./register-form";

export const metadata = {
  title: "Create account — AuditHalo",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <p className="label-overline mb-4">Start free</p>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Create your supervisor account
      </h1>
      <p className="mt-3 text-foreground/70">
        Supervisees join later, by invite. They're always free.
      </p>

      <RegisterForm />

      <p className="mt-6 text-sm text-foreground/60">
        Already have an account?{" "}
        <Link href="/login" className="text-secondary font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
