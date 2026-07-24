import type { NotificationKind } from "@/lib/db/schema";

/**
 * Which notification kinds each role should see in the preferences form.
 * Shared between the client component and server-side notification logic.
 */
export const ROLE_NOTIFICATION_KINDS: Record<string, Set<NotificationKind>> = {
  supervisor: new Set<NotificationKind>([
    "invite_accepted",
    "signature_needed",
    "evidence_sealed",
    "supervisor_rule_not_set",
    "attestation_overdue",
    "trial_ending_soon",
    "session_scheduled",
    "session_canceled",
    "session_rescheduled",
    "session_reminder_1hour",
    "session_reminder_15min",
    "session_no_show",
    "session_sign_reminder",
  ]),
  supervisee: new Set<NotificationKind>([
    "signature_needed",
    "rule_changed",
    "evidence_sealed",
    "session_scheduled",
    "session_canceled",
    "session_rescheduled",
    "session_reminder_1hour",
    "session_reminder_15min",
  ]),
  hr_admin: new Set<NotificationKind>([
    "invite_accepted",
    "supervisor_rule_not_set",
    "attestation_overdue",
    "trial_ending_soon",
  ]),
  executive: new Set<NotificationKind>(),
};
