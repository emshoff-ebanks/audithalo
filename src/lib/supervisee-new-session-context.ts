import { and, eq, isNull } from "drizzle-orm";
import { canSupervise, isHrAdmin } from "@/lib/authz";
import { db, schema } from "@/lib/db";

type Provider = "microsoft" | "google";
export type ConnectedProvider = {
  name: Provider;
  accountEmail: string | null;
  isPreferred: boolean;
};

export type NewSessionModalContext = {
  viewerCanSupervise: boolean;
  viewerCanScheduleSession: boolean;
  connectedProviders: ConnectedProvider[];
  hostingSupervisorName: string | null;
  hasAssignedSupervisor: boolean;
  groupCandidates: { id: string; name: string }[];
  supervisorCredentials: string[] | null;
  contractFiled: boolean;
};

/**
 * Resolve everything NewSessionModal needs to render for a given supervisee.
 * Shared by the supervisee detail page (its primary caller) and the calendar
 * page's query-param-driven launcher so both open the exact same modal.
 *
 * Returns null when the supervisee has no org_memberships row in the viewer's
 * org — the caller should treat that as "cannot schedule here" (notFound or
 * ignore). Any other precondition failure returns a context object with
 * sensible empty-state defaults so the modal can render its own guard copy.
 */
export async function getNewSessionModalContext(opts: {
  superviseeId: string;
  viewerUserId: string;
  viewerRole: string | undefined | null;
  orgId: string;
}): Promise<NewSessionModalContext | null> {
  const { superviseeId, viewerUserId, viewerRole, orgId } = opts;

  const viewerCanSupervise = canSupervise(viewerRole);
  const viewerIsHrAdmin = isHrAdmin(viewerRole);
  const viewerCanScheduleSession = viewerCanSupervise || viewerIsHrAdmin;

  const targetMembership = await db.query.orgMemberships.findFirst({
    where: and(
      eq(schema.orgMemberships.userId, superviseeId),
      eq(schema.orgMemberships.orgId, orgId)
    ),
  });
  if (!targetMembership) return null;

  // Resolve the hosting supervisor. Supervisor viewer → themselves.
  // HR Admin viewer → the supervisee's currently-assigned supervisor.
  let hostingSupervisorId: string | null = null;
  let hostingSupervisorName: string | null = null;
  if (viewerCanSupervise) {
    hostingSupervisorId = viewerUserId;
  } else if (viewerIsHrAdmin) {
    const activeAssignment = await db.query.supervisorAssignments.findFirst({
      where: and(
        eq(schema.supervisorAssignments.superviseeId, superviseeId),
        eq(schema.supervisorAssignments.orgId, orgId),
        isNull(schema.supervisorAssignments.endedAt)
      ),
    });
    if (activeAssignment) {
      hostingSupervisorId = activeAssignment.supervisorId ?? null;
      const sup = hostingSupervisorId
        ? await db.query.users.findFirst({
            where: eq(schema.users.id, hostingSupervisorId),
            columns: { name: true, email: true },
          })
        : null;
      hostingSupervisorName = sup?.name ?? sup?.email ?? null;
    }
  }

  // Group-session candidates — same org, same role scope as the detail page.
  let groupCandidates: { id: string; name: string }[] = [];
  if (viewerCanScheduleSession) {
    if (viewerCanSupervise) {
      const assignmentRows = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.supervisorAssignments)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.supervisorAssignments.superviseeId)
        )
        .where(
          and(
            eq(schema.supervisorAssignments.supervisorId, viewerUserId),
            eq(schema.supervisorAssignments.orgId, orgId),
            isNull(schema.supervisorAssignments.endedAt)
          )
        );
      groupCandidates = assignmentRows
        .filter((r) => r.id !== superviseeId)
        .map((r) => ({ id: r.id, name: r.name ?? r.email }));
    } else if (viewerIsHrAdmin) {
      const orgSupervisees = await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
        })
        .from(schema.orgMemberships)
        .innerJoin(schema.users, eq(schema.users.id, schema.orgMemberships.userId))
        .where(
          and(
            eq(schema.orgMemberships.orgId, orgId),
            eq(schema.orgMemberships.role, "supervisee"),
            isNull(schema.orgMemberships.deactivatedAt)
          )
        );
      groupCandidates = orgSupervisees
        .filter((r) => r.id !== superviseeId)
        .map((r) => ({ id: r.id, name: r.name ?? r.email }));
    }
  }

  // Calendar integrations for the hosting supervisor.
  const connectedProviders: ConnectedProvider[] =
    viewerCanScheduleSession && hostingSupervisorId
      ? (
          await db
            .select({
              name: schema.userCalendarIntegrations.provider,
              accountEmail: schema.userCalendarIntegrations.accountEmail,
              isPreferred: schema.userCalendarIntegrations.isPreferred,
            })
            .from(schema.userCalendarIntegrations)
            .where(
              and(
                eq(
                  schema.userCalendarIntegrations.userId,
                  hostingSupervisorId
                ),
                isNull(schema.userCalendarIntegrations.disconnectedAt)
              )
            )
        ).filter(
          (
            r
          ): r is {
            name: "microsoft" | "google";
            accountEmail: string | null;
            isPreferred: boolean;
          } => r.name === "microsoft" || r.name === "google"
        )
      : [];

  // Viewer's own professional credentials (feeds the log-session form).
  const supervisorCredentials = viewerCanSupervise
    ? ((
        await db.query.users.findFirst({
          where: eq(schema.users.id, viewerUserId),
          columns: { credentials: true },
        })
      )?.credentials as string[] | null) ?? null
    : null;

  // contractFiled drives the log-past form's enablement — safe for the
  // modal to always know, so load it here even for callers that don't
  // otherwise fetch the assignment row.
  const assignment = await db.query.superviseeRuleAssignments.findFirst({
    where: and(
      eq(schema.superviseeRuleAssignments.superviseeId, superviseeId),
      eq(schema.superviseeRuleAssignments.orgId, orgId)
    ),
    columns: { supervisionContractFiledAt: true },
  });

  return {
    viewerCanSupervise,
    viewerCanScheduleSession,
    connectedProviders,
    // Supervisor viewing a supervisee is scheduling as themselves — no
    // "on behalf of" copy. HR Admin viewing surfaces the hosting
    // supervisor's name.
    hostingSupervisorName: viewerCanSupervise ? null : hostingSupervisorName,
    hasAssignedSupervisor: !!hostingSupervisorId || viewerCanSupervise,
    groupCandidates,
    supervisorCredentials,
    contractFiled: !!assignment?.supervisionContractFiledAt,
  };
}
