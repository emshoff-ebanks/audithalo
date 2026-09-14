// Docs live on the marketing host; the app runs on app.audithalo.com. Use an
// absolute URL so contextual help links resolve across hosts, and open them in
// a new tab at the call site so dashboard state is preserved.
export const DOCS_BASE_URL = "https://audithalo.com/docs";

// Ordered most-specific-first. helpLinkForRoute picks the first prefix match,
// so nested routes (…/team/import, …/settings/integrations) must precede their
// parents (…/team, …/settings).
const ROUTE_HELP_MAP: { prefix: string; doc: string }[] = [
  { prefix: "/dashboard/team/rules", doc: "rules/creating-rule-overrides" },
  { prefix: "/dashboard/team/import", doc: "team/bulk-csv-import" },
  { prefix: "/dashboard/team", doc: "team/inviting-team-members" },
  { prefix: "/dashboard/roster", doc: "rules/understanding-compliance-status" },
  { prefix: "/dashboard/calendar", doc: "integrations/using-the-calendar" },
  { prefix: "/dashboard/settings/integrations", doc: "integrations/connecting-paycor" },
  { prefix: "/dashboard/settings", doc: "getting-started/hr-admin" },
  { prefix: "/dashboard/executive", doc: "getting-started/executive" },
  { prefix: "/dashboard/billing", doc: "billing/managing-your-subscription" },
  { prefix: "/dashboard/audit-log", doc: "audit-log/reading-the-audit-log" },
  { prefix: "/dashboard/account", doc: "account/two-factor-authentication" },
  { prefix: "/sign/", doc: "sessions/log-and-sign-a-session" },
];

export function helpLinkForRoute(pathname: string): string {
  const match = ROUTE_HELP_MAP.find((m) => pathname.startsWith(m.prefix));
  return match ? `${DOCS_BASE_URL}/${match.doc}` : DOCS_BASE_URL;
}
