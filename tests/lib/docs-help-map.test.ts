import { describe, it, expect } from "vitest";
import { helpLinkForRoute, DOCS_BASE_URL } from "@/lib/docs-help-map";

describe("helpLinkForRoute", () => {
  it("maps the rules admin route to the overrides article", () => {
    expect(helpLinkForRoute("/dashboard/team/rules")).toBe(
      `${DOCS_BASE_URL}/rules/creating-rule-overrides`
    );
  });

  it("matches the most specific prefix when routes are nested", () => {
    expect(helpLinkForRoute("/dashboard/team/import")).toBe(
      `${DOCS_BASE_URL}/team/bulk-csv-import`
    );
    expect(helpLinkForRoute("/dashboard/team")).toBe(
      `${DOCS_BASE_URL}/team/inviting-team-members`
    );
  });

  it("maps the settings integrations route ahead of plain settings", () => {
    expect(helpLinkForRoute("/dashboard/settings/integrations")).toBe(
      `${DOCS_BASE_URL}/integrations/connecting-paycor`
    );
    expect(helpLinkForRoute("/dashboard/settings")).toBe(
      `${DOCS_BASE_URL}/getting-started/hr-admin`
    );
  });

  it("matches dynamic segments by prefix", () => {
    expect(helpLinkForRoute("/sign/abc-123")).toBe(
      `${DOCS_BASE_URL}/sessions/log-and-sign-a-session`
    );
  });

  it("falls back to the docs index for unmapped routes", () => {
    expect(helpLinkForRoute("/dashboard/something-new")).toBe(DOCS_BASE_URL);
  });
});
