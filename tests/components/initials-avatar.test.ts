import { describe, it, expect } from "vitest";
import { initialsFor } from "@/components/ui/initials-avatar";

describe("initialsFor", () => {
  it("returns first + last initial for a two-word name", () => {
    expect(initialsFor("Caleb Ebanks")).toBe("CE");
    expect(initialsFor("Damon Test HR Admin")).toBe("DA");
  });

  it("returns the first two letters for a single word", () => {
    expect(initialsFor("Damon")).toBe("DA");
    expect(initialsFor("X")).toBe("X");
  });

  it("uses the local part for email-style inputs", () => {
    expect(initialsFor("info@audithalo.com")).toBe("IN");
    expect(initialsFor("caleb.ebanks@example.com")).toBe("CE");
  });

  it("splits on dots, dashes, and underscores", () => {
    expect(initialsFor("caleb_ebanks")).toBe("CE");
    expect(initialsFor("damon-supervisor")).toBe("DS");
  });

  it("returns '?' for empty / whitespace-only input", () => {
    expect(initialsFor("")).toBe("?");
    expect(initialsFor("   ")).toBe("?");
  });

  it("uppercases regardless of input case", () => {
    expect(initialsFor("caleb ebanks")).toBe("CE");
    expect(initialsFor("a@example.com")).toBe("A");
  });
});
