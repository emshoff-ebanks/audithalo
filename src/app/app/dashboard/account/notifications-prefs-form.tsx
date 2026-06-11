"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { NotificationKind, NotificationPrefs } from "@/lib/db/schema";
import { updateNotificationPrefsAction } from "@/app/actions/notifications";

const DEFAULTS: Record<NotificationKind, boolean> = {
  invite_accepted: true,
  signature_needed: true,
  rule_changed: true,
  evidence_sealed: true,
  supervisor_rule_not_set: false,
  attestation_overdue: true,
  trial_ending_soon: true,
  session_scheduled: true,
  session_canceled: true,
  session_rescheduled: true,
};

const KIND_META: Record<
  NotificationKind,
  { label: string; description: string }
> = {
  invite_accepted: {
    label: "Supervisee accepted invite",
    description:
      "You sent an invite, and the supervisee created their account.",
  },
  signature_needed: {
    label: "Supervision session needs signature",
    description:
      "A logged supervision session is awaiting one of your signatures.",
  },
  rule_changed: {
    label: "State rule version changed",
    description:
      "Your supervisee's rule was bumped to a new version. Existing hours remain valid.",
  },
  evidence_sealed: {
    label: "Evidence package sealed",
    description:
      "A supervision session was fully signed and sealed into an audit-ready PDF.",
  },
  supervisor_rule_not_set: {
    label: "Supervisee missing a state rule (daily)",
    description:
      "Accepted invite older than 24h with no assigned state rule. Daily reminder.",
  },
  attestation_overdue: {
    label: "Overdue compliance attestation (daily)",
    description:
      "A blocker-severity gap is over 7 days old and still unresolved.",
  },
  trial_ending_soon: {
    label: "Trial ending soon",
    description:
      "Heads-up 3 days before your free trial ends so you can add a payment method.",
  },
  session_scheduled: {
    label: "Supervision scheduled",
    description:
      "A supervision session was put on the calendar. Includes the join link.",
  },
  session_canceled: {
    label: "Supervision canceled",
    description:
      "A scheduled supervision session was canceled. The calendar invite is withdrawn.",
  },
  session_rescheduled: {
    label: "Supervision rescheduled",
    description:
      "A scheduled supervision session moved to a new time. The calendar invite updates.",
  },
};

const ORDER: NotificationKind[] = [
  "invite_accepted",
  "signature_needed",
  "session_scheduled",
  "session_rescheduled",
  "session_canceled",
  "rule_changed",
  "evidence_sealed",
  "supervisor_rule_not_set",
  "attestation_overdue",
  "trial_ending_soon",
];

export function NotificationsPrefsForm({
  initialPrefs,
}: {
  initialPrefs: NotificationPrefs | null;
}) {
  const [pending, startTransition] = useTransition();

  function effective(kind: NotificationKind): boolean {
    const v = initialPrefs?.email?.[kind];
    return typeof v === "boolean" ? v : DEFAULTS[kind];
  }

  function handleToggle(kind: NotificationKind, current: boolean) {
    startTransition(async () => {
      await updateNotificationPrefsAction({ kind, email: !current });
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-foreground/60 uppercase tracking-wider font-semibold">
        Email
      </p>
      <ul className="space-y-2">
        {ORDER.map((kind) => {
          const meta = KIND_META[kind];
          const enabled = effective(kind);
          return (
            <li
              key={kind}
              className="flex items-start justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground font-medium">
                  {meta.label}
                </p>
                <p className="mt-0.5 text-xs text-foreground/60">
                  {meta.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                disabled={pending}
                onClick={() => handleToggle(kind, enabled)}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors mt-1 ${
                  enabled
                    ? "bg-[color:var(--color-secondary)]"
                    : "bg-muted"
                } disabled:opacity-60`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                    enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
                {pending && (
                  <Loader2 className="absolute inset-0 m-auto h-3.5 w-3.5 animate-spin text-white/80" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
