"use client";

export default function VerifyEmailError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-foreground/60">
        We couldn&apos;t verify your email. The link may have expired.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
