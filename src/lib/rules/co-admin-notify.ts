/**
 * Co-admin notification helper (Cycle 7).
 *
 * Sends a `sendOverrideChangedEmail` to every HR Admin in the org other
 * than the actor when a rule override or custom rule changes. Failure is
 * non-blocking — the originating action must NEVER fail because an email
 * couldn't go out.
 */

import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { sendOverrideChangedEmail } from "@/lib/email";

type Args = {
  orgId: string;
  actorUserId: string;
  action: "saved" | "deactivated" | "created";
  ruleLabel: string;
  diffSummary?: string;
};

export async function notifyOverrideCoAdmins(args: Args): Promise<void> {
  try {
    const appUrl = process.env.APP_URL ?? "https://app.audithalo.com";

    const [actor, coAdminMemberships] = await Promise.all([
      db.query.users.findFirst({
        where: eq(schema.users.id, args.actorUserId),
        columns: { name: true, email: true },
      }),
      db.query.orgMemberships.findMany({
        where: and(
          eq(schema.orgMemberships.orgId, args.orgId),
          eq(schema.orgMemberships.role, "hr_admin"),
          ne(schema.orgMemberships.userId, args.actorUserId)
        ),
      }),
    ]);
    if (coAdminMemberships.length === 0) return;

    const actorName = actor?.name ?? actor?.email ?? "Another HR Admin";
    const coAdminIds = coAdminMemberships.map((m) => m.userId);
    const coAdmins = await db.query.users.findMany({
      where: (u, { inArray }) => inArray(u.id, coAdminIds),
      columns: { id: true, name: true, email: true },
    });

    const dashboardUrl = `${appUrl}/dashboard/team/rules`;

    await Promise.all(
      coAdmins
        .filter((c) => c.email)
        .map((c) =>
          sendOverrideChangedEmail({
            to: c.email!,
            recipientName: c.name ?? c.email!,
            actorName,
            action: args.action,
            ruleLabel: args.ruleLabel,
            diffSummary: args.diffSummary,
            dashboardUrl,
          }).catch((err) => {
            console.error(
              `[co-admin-notify] send to ${c.email} failed:`,
              err
            );
          })
        )
    );
  } catch (err) {
    // Wrap the entire flow in catch so a DB hiccup never breaks the
    // upstream action.
    console.error("[co-admin-notify] failed:", err);
  }
}
