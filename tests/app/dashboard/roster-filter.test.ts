import { describe, it, expect } from "vitest";
import {
  parseRosterFilter,
  parseSupervisorId,
} from "@/app/app/dashboard/roster/_roster-filter";

describe("parseRosterFilter", () => {
  it("accepts the three valid non-default filters", () => {
    expect(parseRosterFilter("at-risk")).toBe("at-risk");
    expect(parseRosterFilter("pending-signatures")).toBe("pending-signatures");
    expect(parseRosterFilter("on-track")).toBe("on-track");
  });

  it("falls back to 'all' for unknown / missing values", () => {
    expect(parseRosterFilter(undefined)).toBe("all");
    expect(parseRosterFilter("")).toBe("all");
    expect(parseRosterFilter("garbage")).toBe("all");
  });
});

describe("parseSupervisorId", () => {
  it("returns the UUID when valid", () => {
    expect(
      parseSupervisorId("11111111-1111-4111-8111-111111111111")
    ).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("returns null for missing or empty", () => {
    expect(parseSupervisorId(undefined)).toBeNull();
    expect(parseSupervisorId("")).toBeNull();
  });

  it("returns null for non-UUID strings", () => {
    expect(parseSupervisorId("not-a-uuid")).toBeNull();
    expect(parseSupervisorId("abc")).toBeNull();
    // Guard against SQL injection attempts via the searchParam.
    expect(parseSupervisorId("'; DROP TABLE users; --")).toBeNull();
  });

  it("is case-insensitive on hex digits", () => {
    expect(
      parseSupervisorId("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE")
    ).toBe("AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE");
  });
});
