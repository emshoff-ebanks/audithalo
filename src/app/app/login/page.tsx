import Link from "next/link";

export const metadata = {
  title: "Sign in — AuditHalo",
};

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <p className="label-overline mb-4">Application</p>
      <h1 className="font-display text-3xl font-semibold text-foreground">
        Sign in
      </h1>
      <p className="mt-3 text-foreground/70">
        Auth.js wiring lands in the next pass. For now this confirms{" "}
        <code className="font-mono text-sm bg-muted px-1.5 py-0.5 rounded-sm">
          app.audithalo.com
        </code>{" "}
        is correctly routed to the app namespace.
      </p>

      <form className="mt-8 space-y-4">
        <div>
          <label className="label-overline block mb-2" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            disabled
            placeholder="you@firm.com"
            className="w-full border border-input bg-white px-3 py-2 rounded-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
        </div>
        <div>
          <label className="label-overline block mb-2" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            disabled
            placeholder="••••••••"
            className="w-full border border-input bg-white px-3 py-2 rounded-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
        </div>
        <button
          type="button"
          disabled
          className="w-full h-11 rounded-sm bg-foreground text-background font-medium disabled:opacity-60"
        >
          Sign in (coming soon)
        </button>
      </form>

      <p className="mt-6 text-sm text-foreground/60">
        Need an account?{" "}
        <Link href="/register" className="text-secondary font-medium hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
