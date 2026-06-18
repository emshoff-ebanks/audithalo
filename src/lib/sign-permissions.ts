/**
 * Single source of truth for the affordances on /sign/[sessionId] and the
 * server actions that back them. Eliminates the UI/server authz drift
 * inventoried in docs/strategy/12-wave-1-implementation-plan.md Pass 4
 * (peer supervisors saw Sign/Cancel/Reschedule/No-show buttons that the
 * server rejected; HR Admin saw none of those buttons even though the
 * server allowed them).
 *
 * Pure function — callers resolve the relationship facts (role,
 * isOriginalLogger, isAssignedSupervisor) themselves because they already
 * need that data for the surrounding DB writes. The helper just decides.
 */

export type SignPermissionRole =
  | "supervisee"
  | "supervisor"
  | "hr_admin"
  | "executive"
  | string;

export type SignPermissionContext = {
  /** Viewer's org membership role. */
  role: SignPermissionRole | null | undefined;
  /** Viewer is the supervisee whose record this is. */
  isSelfSupervisee: boolean;
  /** Viewer is the user who logged the row (originally scheduled, or
   *  logged after-the-fact). */
  isOriginalLogger: boolean;
  /** Viewer has an active supervisorAssignments row for this supervisee. */
  isAssignedSupervisor: boolean;
};

export type SignPermissions = {
  /** Can cancel a still-scheduled session. */
  canCancel: boolean;
  /** Can reschedule a still-scheduled session (caller layers !recurring on top). */
  canReschedule: boolean;
  /** Can flag a still-scheduled session as no-show. */
  canMarkNoShow: boolean;
  /** Is a required signer for this session (server enforces — UI gates
   *  the SignForm on this so non-signers see View-only instead of a
   *  dead-end button). */
  canSign: boolean;
  /** Can paste a transcript and generate / edit the AI session note.
   *  HR Admin is intentionally excluded — clinical-adjacent content is
   *  authored by the credentialed supervisor only. */
  canGenerateAiNote: boolean;
};

function isHrAdminRole(role: string | null | undefined): boolean {
  return role === "hr_admin";
}

function isSupervisorRole(role: string | null | undefined): boolean {
  return role === "supervisor";
}

export function signPermissions(ctx: SignPermissionContext): SignPermissions {
  const { role, isSelfSupervisee, isOriginalLogger, isAssignedSupervisor } = ctx;
  const isHr = isHrAdminRole(role);
  const isSupervisor = isSupervisorRole(role);

  // Mirror of cancelScheduledSessionAction / rescheduleSessionAction /
  // markSessionNoShowAction server-side authz: HR Admin org-wide, the
  // currently-assigned supervisor, or the original scheduler.
  const canCancel =
    isHr ||
    isOriginalLogger ||
    (isSupervisor && isAssignedSupervisor);

  const canReschedule = canCancel;

  // markSessionNoShowAction also lets the supervisee flag their own row
  // — they need a path to record "the meeting time came and went and
  // nobody attended" without escalating off-platform.
  const canMarkNoShow = canCancel || isSelfSupervisee;

  // signSessionAction: signer is the supervisee on their own row, or a
  // supervisor who's either the original logger or the active assigned
  // supervisor for this supervisee. HR Admin and executive never sign.
  const canSign =
    isSelfSupervisee ||
    (isSupervisor && (isOriginalLogger || isAssignedSupervisor));

  // AI-note authoring is the supervisor's job. Tighten to assigned OR
  // original logger so a peer supervisor in a multi-supervisor practice
  // can't paste transcripts on another supervisor's roster. HR Admin
  // stays excluded (see field comment).
  const canGenerateAiNote =
    isSupervisor && (isOriginalLogger || isAssignedSupervisor);

  return {
    canCancel,
    canReschedule,
    canMarkNoShow,
    canSign,
    canGenerateAiNote,
  };
}
