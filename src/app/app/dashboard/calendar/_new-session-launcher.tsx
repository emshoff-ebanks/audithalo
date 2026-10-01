"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewSessionModal } from "@/app/app/dashboard/roster/[superviseeId]/_new-session-modal";
import type { NewSessionModalContext } from "@/lib/supervisee-new-session-context";

type Props = NewSessionModalContext & {
  superviseeId: string;
  startUtcIso?: string;
};

/**
 * Calendar-side wrapper around the shared NewSessionModal. Mounted by the
 * calendar page when ?newSessionSuperviseeId=... is in the URL — sets the
 * #new-session hash so the modal auto-opens, and cleans up both the hash
 * AND the owning query params on close so the URL returns to a clean
 * /dashboard/calendar?view=... state.
 */
export function CalendarNewSessionLauncher({
  superviseeId,
  startUtcIso,
  viewerCanSupervise,
  viewerCanScheduleSession,
  connectedProviders,
  hostingSupervisorName,
  hasAssignedSupervisor,
  groupCandidates,
  supervisorCredentials,
  contractFiled,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Memoize the search-params key so the mount effect doesn't retrigger on
  // every navigation that touches other query params (view, date, etc).
  const hasOpenerParam = useMemo(
    () => searchParams?.get("newSessionSuperviseeId") === superviseeId,
    [searchParams, superviseeId]
  );

  useEffect(() => {
    if (!hasOpenerParam) return;
    if (typeof window === "undefined") return;
    if (window.location.hash === "#new-session") return;
    window.location.hash = "#new-session";
  }, [hasOpenerParam]);

  const handleClose = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("newSessionSuperviseeId");
    params.delete("start");
    const qs = params.toString();
    router.replace(qs ? `/dashboard/calendar?${qs}` : "/dashboard/calendar", {
      scroll: false,
    });
    router.refresh();
  }, [router, searchParams]);

  return (
    <NewSessionModal
      superviseeId={superviseeId}
      viewerCanSupervise={viewerCanSupervise}
      viewerCanScheduleSession={viewerCanScheduleSession}
      connectedProviders={connectedProviders}
      hostingSupervisorName={hostingSupervisorName}
      hasAssignedSupervisor={hasAssignedSupervisor}
      groupCandidates={groupCandidates}
      supervisorCredentials={supervisorCredentials}
      contractFiled={contractFiled}
      renderTrigger={false}
      initialStartUtcIso={startUtcIso}
      onClose={handleClose}
    />
  );
}
