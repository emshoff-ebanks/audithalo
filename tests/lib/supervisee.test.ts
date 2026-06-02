import { describe, it, expect } from "vitest";
import { pendingSignaturesForUser } from "@/lib/supervisee";
import type { schema } from "@/lib/db";

type SessionEvent = typeof schema.sessionEvents.$inferSelect;

function mkSupervisionEvent(opts: {
  id: string;
  signedAt: Date | null;
  signatures: Array<{ signerId: string }>;
}): SessionEvent {
  return {
    id: opts.id,
    superviseeId: "u1",
    orgId: "o1",
    kind: "supervision",
    date: new Date(),
    durationHours: 1,
    sessionType: "individual",
    supervisorCredentials: ["LCMHCS"],
    groupAttendees: null,
    loggedById: "u2",
    signatures: opts.signatures,
    signedAt: opts.signedAt,
    createdAt: new Date(),
  } as unknown as SessionEvent;
}

describe("pendingSignaturesForUser", () => {
  it("returns supervision sessions not signed by the user", () => {
    const events = [
      mkSupervisionEvent({ id: "a", signedAt: null, signatures: [] }),
    ];
    const result = pendingSignaturesForUser(events, "me");
    expect(result.map((e) => e.id)).toEqual(["a"]);
  });

  it("excludes sessions already signed by this user", () => {
    const events = [
      mkSupervisionEvent({
        id: "a",
        signedAt: null,
        signatures: [{ signerId: "me" }],
      }),
    ];
    expect(pendingSignaturesForUser(events, "me")).toEqual([]);
  });

  it("excludes fully-signed sessions", () => {
    const events = [
      mkSupervisionEvent({ id: "a", signedAt: new Date(), signatures: [] }),
    ];
    expect(pendingSignaturesForUser(events, "me")).toEqual([]);
  });

  it("excludes practice events", () => {
    const events = [
      {
        ...mkSupervisionEvent({ id: "a", signedAt: null, signatures: [] }),
        kind: "practice",
      },
    ] as SessionEvent[];
    expect(pendingSignaturesForUser(events, "me")).toEqual([]);
  });
});
