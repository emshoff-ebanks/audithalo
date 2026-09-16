import { auth } from "@/auth";
import { PostHogIdentify } from "@/components/observability/posthog-identify";
import { SentryUserContext } from "./_sentry-user-context";

/**
 * App-side root layout. Observability + the warm ground only. The
 * authenticated chrome (sidebar nav, header, notifications, profile) now
 * lives in the /dashboard shell (src/app/app/dashboard/layout.tsx). Routes
 * outside the shell (login, register, /sign, /accept-invite, /admin) render
 * their own surface on this ground.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">
      {session?.user?.id && session.user.email ? (
        <>
          <PostHogIdentify
            userId={session.user.id}
            email={session.user.email}
            role={session.user.role}
          />
          <SentryUserContext
            userId={session.user.id}
            email={session.user.email}
            role={session.user.role}
          />
        </>
      ) : null}
      {children}
    </div>
  );
}
