/**
 * Shared filter types + parser used by BOTH the server-side roster page (to
 * compute the active filter from searchParams) and the client-side FilterBar
 * (to build pill hrefs). Kept in its own file with no "use client" directive
 * so server components can import it without Next.js treating it as a client
 * function.
 */

export type RosterFilter =
  | "all"
  | "at-risk"
  | "pending-signatures"
  | "on-track";

export function parseRosterFilter(value: string | undefined): RosterFilter {
  if (
    value === "at-risk" ||
    value === "pending-signatures" ||
    value === "on-track"
  ) {
    return value;
  }
  return "all";
}
