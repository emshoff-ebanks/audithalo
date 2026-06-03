import { describe, it, expect, beforeAll } from "vitest";

// Set env vars BEFORE the dynamic import so PRICES picks them up at module load.
// We avoid top-level static import of stripe.ts for the same reason — the module
// reads process.env on first load.
beforeAll(() => {
  process.env.STRIPE_PRICE_SOLO_MONTHLY = "price_test_solo_monthly";
  process.env.STRIPE_PRICE_SOLO_YEARLY = "price_test_solo_yearly";
  process.env.STRIPE_PRICE_PRACTICE_BASE = "price_test_practice_base";
  process.env.STRIPE_PRICE_PRACTICE_SEAT = "price_test_practice_seat";
});

describe("tierFromPriceId", () => {
  it("returns 'solo' for the solo monthly price", async () => {
    const { tierFromPriceId } = await import("@/lib/stripe");
    expect(tierFromPriceId("price_test_solo_monthly")).toBe("solo");
  });

  it("returns 'solo' for the solo yearly price", async () => {
    const { tierFromPriceId } = await import("@/lib/stripe");
    expect(tierFromPriceId("price_test_solo_yearly")).toBe("solo");
  });

  it("returns 'practice' for the practice base price", async () => {
    const { tierFromPriceId } = await import("@/lib/stripe");
    expect(tierFromPriceId("price_test_practice_base")).toBe("practice");
  });

  it("returns 'practice' for the practice seat price", async () => {
    const { tierFromPriceId } = await import("@/lib/stripe");
    expect(tierFromPriceId("price_test_practice_seat")).toBe("practice");
  });

  it("returns null for an unknown price ID", async () => {
    const { tierFromPriceId } = await import("@/lib/stripe");
    expect(tierFromPriceId("price_unknown_xyz")).toBeNull();
  });

  it("returns null for empty string", async () => {
    const { tierFromPriceId } = await import("@/lib/stripe");
    expect(tierFromPriceId("")).toBeNull();
  });

  // Sweep test: every configured PRICES entry must resolve to a known tier.
  // If someone adds a new price to PRICES without updating tierFromPriceId,
  // this test fails — loudly surfacing the gap before a customer hits it.
  it("every configured PRICES entry maps to a known tier (no silent gaps)", async () => {
    const { PRICES, tierFromPriceId } = await import("@/lib/stripe");
    const unmapped: string[] = [];
    for (const [name, id] of Object.entries(PRICES)) {
      if (!id) continue; // skip unset env-driven prices
      if (tierFromPriceId(id) === null) {
        unmapped.push(`${name} (${id})`);
      }
    }
    expect(
      unmapped,
      `Unmapped PRICES entries (will silently fail in production): ${unmapped.join(", ")}`
    ).toEqual([]);
  });
});
