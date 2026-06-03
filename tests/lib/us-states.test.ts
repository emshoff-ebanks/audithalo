import { describe, it, expect } from "vitest";
import { US_STATES, isValidStateCode } from "@/lib/us-states";

describe("US_STATES", () => {
  it("includes 51 entries (50 states + DC)", () => {
    expect(US_STATES.length).toBe(51);
  });

  it("all codes are 2-character uppercase", () => {
    for (const s of US_STATES) {
      expect(s.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("includes all 5 launch states", () => {
    const codes = US_STATES.map((s) => s.code);
    expect(codes).toContain("NC");
    expect(codes).toContain("CA");
    expect(codes).toContain("TX");
    expect(codes).toContain("FL");
    expect(codes).toContain("NY");
  });
});

describe("isValidStateCode", () => {
  it("returns true for valid 2-char state codes", () => {
    expect(isValidStateCode("NC")).toBe(true);
    expect(isValidStateCode("CA")).toBe(true);
    expect(isValidStateCode("DC")).toBe(true);
  });

  it("returns false for unknown codes", () => {
    expect(isValidStateCode("ZZ")).toBe(false);
    expect(isValidStateCode("XX")).toBe(false);
  });

  it("is case-sensitive", () => {
    expect(isValidStateCode("nc")).toBe(false);
  });

  it("returns false for empty / too-long input", () => {
    expect(isValidStateCode("")).toBe(false);
    expect(isValidStateCode("NCC")).toBe(false);
    expect(isValidStateCode("N")).toBe(false);
  });
});
