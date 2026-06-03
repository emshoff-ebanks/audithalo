import { describe, it, expect } from "vitest";
import { scanForPhi, phiKindLabel } from "@/lib/ai/phi-scan";

describe("scanForPhi", () => {
  it("detects US phone numbers in (xxx) xxx-xxxx format", () => {
    const matches = scanForPhi("Call me at (555) 123-4567 tomorrow.");
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("phone");
    expect(matches[0].match).toBe("(555) 123-4567");
  });

  it("detects US phone numbers in xxx-xxx-xxxx format", () => {
    const matches = scanForPhi("My number is 555-123-4567.");
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("phone");
    expect(matches[0].match).toBe("555-123-4567");
  });

  it("detects US phone numbers in xxx.xxx.xxxx format", () => {
    const matches = scanForPhi("Reach me at 555.123.4567 please.");
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("phone");
    expect(matches[0].match).toBe("555.123.4567");
  });

  it("detects US phone numbers in xxx xxx xxxx format", () => {
    const matches = scanForPhi("Call 555 123 4567.");
    expect(matches).toHaveLength(1);
    expect(matches[0].kind).toBe("phone");
    expect(matches[0].match).toBe("555 123 4567");
  });

  it("detects SSN in xxx-xx-xxxx format", () => {
    const matches = scanForPhi("Her SSN is 123-45-6789.");
    const ssnHits = matches.filter((m) => m.kind === "ssn");
    expect(ssnHits).toHaveLength(1);
    expect(ssnHits[0].match).toBe("123-45-6789");
  });

  it("detects email addresses", () => {
    const matches = scanForPhi("Contact jane.doe+test@example.com about it.");
    const emailHits = matches.filter((m) => m.kind === "email");
    expect(emailHits).toHaveLength(1);
    expect(emailHits[0].match).toBe("jane.doe+test@example.com");
  });

  it("detects street addresses with common suffixes", () => {
    const m1 = scanForPhi("She lives at 123 Main Street.");
    expect(m1.some((m) => m.kind === "address" && /123 Main Street/.test(m.match))).toBe(true);

    const m2 = scanForPhi("Office at 456 Oak Ave");
    expect(m2.some((m) => m.kind === "address" && /456 Oak Ave/.test(m.match))).toBe(true);

    const m3 = scanForPhi("Met at 789 Pine Blvd today");
    expect(m3.some((m) => m.kind === "address" && /789 Pine Blvd/.test(m.match))).toBe(true);
  });

  it("detects credit card numbers", () => {
    const matches = scanForPhi("Card 4111 1111 1111 1111 charged.");
    const ccHits = matches.filter((m) => m.kind === "credit_card");
    expect(ccHits.length).toBeGreaterThanOrEqual(1);
    expect(ccHits[0].match).toBe("4111 1111 1111 1111");
  });

  it("returns ALL kinds when multiple PHI types appear in the same text", () => {
    const text =
      "Patient at 123 Main Street, phone (555) 123-4567, email patient@example.com, SSN 123-45-6789.";
    const matches = scanForPhi(text);
    const kinds = new Set(matches.map((m) => m.kind));
    expect(kinds.has("phone")).toBe(true);
    expect(kinds.has("email")).toBe(true);
    expect(kinds.has("ssn")).toBe(true);
    expect(kinds.has("address")).toBe(true);
  });

  it("returns empty array for clean clinical text", () => {
    const text =
      "We discussed the supervisee's case conceptualization framework and worked through transference dynamics observed in their last few client encounters. The supervisor recommended further reading on attachment theory and trauma-informed care.";
    const matches = scanForPhi(text);
    expect(matches).toEqual([]);
  });

  it("does NOT detect a bare 10-digit number with no separators (acceptable false-negative)", () => {
    const text = "The transaction id 5551234567 was logged.";
    const matches = scanForPhi(text);
    expect(matches.filter((m) => m.kind === "phone")).toEqual([]);
  });

  it("returns matches sorted by index for stable display", () => {
    const text = "Email a@b.com first then (555) 123-4567 second.";
    const matches = scanForPhi(text);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i].index).toBeGreaterThanOrEqual(matches[i - 1].index);
    }
  });
});

describe("phiKindLabel", () => {
  it("returns a human-readable label for every kind", () => {
    expect(phiKindLabel("phone")).toBe("phone number");
    expect(phiKindLabel("ssn")).toBe("Social Security number");
    expect(phiKindLabel("email")).toBe("email address");
    expect(phiKindLabel("address")).toBe("street address");
    expect(phiKindLabel("credit_card")).toBe("credit card number");
  });
});
