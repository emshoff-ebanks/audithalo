import { test, expect } from "@playwright/test";
import {
  getUserIdByEmail,
  ensureSuperviseeRuleAssignment,
  seedSupervisionSessionEvent,
  findEvidencePackageBySessionEventId,
  getSessionEventSignatureState,
  deleteSessionEvent,
  closePool,
} from "../helpers/db";

// THE CORE PRODUCT FLOW.
//
// Supervisor + supervisee both sign a supervision session → on the second
// signature the session is sealed, an immutable evidence package is
// minted with a SHA-256 hash of the canonical JSON. This is the audit
// artifact that AuditHalo's entire pitch depends on.
//
// Multi-actor: the supervisor's browser context signs first, then the
// supervisee's browser context signs second. Pre-seeded session row
// bypasses the log-session UI to keep the test focused on the sign+seal
// path (the log-session form has its own validation surface; if it broke
// other tests would catch it).

const ORG_ID = process.env.E2E_ORG_ID;
const SUPERVISOR_EMAIL = process.env.E2E_SUPERVISOR_EMAIL;
const SUPERVISEE_EMAIL = process.env.E2E_SUPERVISEE_EMAIL;

test.describe("Sign session and seal evidence package", () => {
  let sessionEventId: string | null = null;

  test.beforeAll(async () => {
    test.skip(
      !ORG_ID || !SUPERVISOR_EMAIL || !SUPERVISEE_EMAIL,
      "E2E env vars not set"
    );
    const supervisorId = await getUserIdByEmail(SUPERVISOR_EMAIL!);
    const superviseeId = await getUserIdByEmail(SUPERVISEE_EMAIL!);
    if (!supervisorId || !superviseeId) {
      throw new Error("Could not find seeded supervisor or supervisee user");
    }
    // Evidence package generation requires the supervisee to have a rule
    // assignment — see src/lib/evidence.ts:43-46. Idempotent.
    await ensureSuperviseeRuleAssignment({
      orgId: ORG_ID!,
      superviseeId,
    });
    const seeded = await seedSupervisionSessionEvent({
      orgId: ORG_ID!,
      supervisorId,
      superviseeId,
    });
    sessionEventId = seeded.id;
  });

  test.afterAll(async () => {
    if (sessionEventId) {
      await deleteSessionEvent(sessionEventId);
    }
    await closePool();
  });

  test("both signatures seal the session and mint an evidence package", async ({
    browser,
  }) => {
    test.skip(!sessionEventId, "Session event not seeded");

    async function signAs(storagePath: string) {
      const ctx = await browser.newContext({ storageState: storagePath });
      const p = await ctx.newPage();
      const resp = await p.goto(`/sign/${sessionEventId}`);
      expect(resp?.status(), `page status for ${storagePath}`).toBeLessThan(400);
      await p.locator('input[name="intent"]').check();
      const responsePromise = p.waitForResponse(
        (r) => r.request().method() === "POST"
      );
      await p.getByRole("button", { name: /sign session/i }).click();
      const postResp = await responsePromise;
      expect(
        postResp.status(),
        `sign POST status for ${storagePath}`
      ).toBeLessThan(400);
      await p.waitForTimeout(2000); // server action revalidate + evidence gen
      await ctx.close();
    }

    // ── Supervisor signs first ──
    await signAs("playwright/.auth/supervisor.json");
    const afterSup = await getSessionEventSignatureState(sessionEventId!);
    expect(afterSup, "session state after supervisor sign").not.toBeNull();
    expect(afterSup!.sigCount, "supervisor signature should be recorded").toBe(1);
    expect(afterSup!.signedAt, "should not be sealed yet").toBeNull();

    const partial = await findEvidencePackageBySessionEventId(sessionEventId!);
    expect(partial).toBeNull();

    // ── Supervisee signs second → seal triggers ──
    await signAs("playwright/.auth/supervisee.json");
    const afterSve = await getSessionEventSignatureState(sessionEventId!);
    expect(afterSve!.sigCount, "should now have 2 signatures").toBe(2);
    expect(afterSve!.signedAt, "should be sealed now").not.toBeNull();

    // ── DB verifier: evidence package exists with a valid SHA-256 hash ──
    const pkg = await findEvidencePackageBySessionEventId(sessionEventId!);
    expect(pkg).not.toBeNull();
    expect(pkg?.documentHash).toMatch(/^[a-f0-9]{64}$/i);
  });
});
