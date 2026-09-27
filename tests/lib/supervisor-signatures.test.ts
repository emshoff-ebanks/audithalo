import { describe, it, expect } from "vitest";
import {
  filterPendingSignaturesForSupervisor,
  type SupervisorSignCandidate,
} from "@/lib/supervisor-signatures";
import type { SessionSignature } from "@/lib/db/schema";

const NOW = new Date("2026-06-18T18:00:00Z");
const SUP = "sup-1";

function sig(signerId: string): SessionSignature {
  return {
    signerId,
    signerName: "Someone",
    signerRole: "supervisor",
    signedAt: "2026-06-18T15:00:00Z",
    ipAddress: "0.0.0.0",
    intentConfirmed: true,
  };
}

function mk(
  overrides: Partial<SupervisorSignCandidate> = {}
): SupervisorSignCandidate {
  return {
    sessionId: "s1",
    superviseeId: "sve-1",
    superviseeName: "Ava Villareal",
    // ended 3h before NOW
    date: new Date("2026-06-18T14:00:00Z"),
    sessionType: "individual",
    durationHours: 1,
    kind: "supervision",
    loggedById: SUP,
    signatures: [],
    signedAt: null,
    scheduledStatus: null,
    ...overrides,
  };
}

describe("filterPendingSignaturesForSupervisor", () => {
  it("includes a past-end unsigned session this supervisor logged", () => {
    const rows = filterPendingSignaturesForSupervisor([mk()], SUP, new Set(), NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionId).toBe("s1");
    expect(rows[0].superviseeName).toBe("Ava Villareal");
  });

  it("includes a session for an assigned supervisee even when logged by someone else", () => {
    const c = mk({ loggedById: "other", superviseeId: "sve-9" });
    const rows = filterPendingSignaturesForSupervisor(
      [c],
      SUP,
      new Set(["sve-9"]),
      NOW
    );
    expect(rows).toHaveLength(1);
  });

  it("excludes sessions where this supervisor is neither logger nor assigned", () => {
    const c = mk({ loggedById: "other", superviseeId: "sve-9" });
    const rows = filterPendingSignaturesForSupervisor([c], SUP, new Set(), NOW);
    expect(rows).toHaveLength(0);
  });

  it("excludes sessions this supervisor already signed", () => {
    const c = mk({ signatures: [sig(SUP)] });
    const rows = filterPendingSignaturesForSupervisor([c], SUP, new Set(), NOW);
    expect(rows).toHaveLength(0);
  });

  it("counts a session signed only by the OTHER party as still pending for me", () => {
    const c = mk({ signatures: [sig("sve-1")] });
    const rows = filterPendingSignaturesForSupervisor([c], SUP, new Set(), NOW);
    expect(rows).toHaveLength(1);
  });

  it("excludes practice, canceled, no-show, and not-yet-ended sessions", () => {
    const practice = mk({ sessionId: "p", kind: "practice" });
    const canceled = mk({ sessionId: "c", scheduledStatus: "canceled" });
    const noShow = mk({ sessionId: "n", scheduledStatus: "no_show" });
    const future = mk({ sessionId: "f", date: NOW, durationHours: 1 });
    const rows = filterPendingSignaturesForSupervisor(
      [practice, canceled, noShow, future],
      SUP,
      new Set(),
      NOW
    );
    expect(rows).toHaveLength(0);
  });

  it("sorts oldest session first", () => {
    const newer = mk({
      sessionId: "newer",
      date: new Date("2026-06-18T14:00:00Z"),
    });
    const older = mk({
      sessionId: "older",
      date: new Date("2026-06-10T14:00:00Z"),
    });
    const rows = filterPendingSignaturesForSupervisor(
      [newer, older],
      SUP,
      new Set(),
      NOW
    );
    expect(rows.map((r) => r.sessionId)).toEqual(["older", "newer"]);
  });
});
