import { describe, it, expect } from "vitest";
import { pendingSignaturesForUser } from "@/lib/supervisee";
import type { schema } from "@/lib/db";

type SessionEvent = typeof schema.sessionEvents.$inferSelect;

function mkSupervisionEvent(opts: {
  id: string;
  signedAt: Date | null;
  signatures: Array<{ signerId: string }>;
  date?: Date;
  scheduledStatus?: string | null;
}): SessionEvent {
  return {
    id: opts.id,
    superviseeId: "u1",
    orgId: "o1",
    kind: "supervision",
    // Default to a comfortably past time so the end-time filter doesn't
    // exclude rows that the test didn't explicitly date.
    date: opts.date ?? new Date(Date.now() - 24 * 60 * 60_000),
    durationHours: 1,
    sessionType: "individual",
    supervisorCredentials: ["LCMHCS"],
    groupAttendees: null,
    loggedById: "u2",
    signatures: opts.signatures,
    signedAt: opts.signedAt,
    scheduledStatus: opts.scheduledStatus ?? null,
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

  // Cycle 8: future scheduled sessions are not signable yet — they
  // shouldn't appear under "Needs your signature" on the supervisee
  // dashboard. The previous behavior was actively misleading because the
  // supervisee couldn't dismiss them.
  it("excludes future scheduled supervision sessions", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "future",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-20T12:00:00Z"),
        scheduledStatus: "scheduled",
      }),
    ];
    expect(pendingSignaturesForUser(events, "me", now)).toEqual([]);
  });

  it("excludes canceled and no_show sessions", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "canceled",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-10T12:00:00Z"),
        scheduledStatus: "canceled",
      }),
      mkSupervisionEvent({
        id: "no-show",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-10T12:00:00Z"),
        scheduledStatus: "no_show",
      }),
    ];
    expect(pendingSignaturesForUser(events, "me", now)).toEqual([]);
  });

  it("includes completed-but-unsigned sessions", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "completed",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-10T12:00:00Z"),
        scheduledStatus: "completed",
      }),
      // Null status + past date — legacy logged-after-the-fact event.
      mkSupervisionEvent({
        id: "legacy",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-09T12:00:00Z"),
        scheduledStatus: null,
      }),
    ];
    expect(
      pendingSignaturesForUser(events, "me", now).map((e) => e.id)
    ).toEqual(["completed", "legacy"]);
  });

  it("excludes future events with null scheduledStatus (defensive)", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "future-null",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-20T12:00:00Z"),
        scheduledStatus: null,
      }),
    ];
    expect(pendingSignaturesForUser(events, "me", now)).toEqual([]);
  });

  // Regression for the post-no-show-removal bug: a row whose meeting
  // ended hours ago can carry scheduledStatus='scheduled' forever
  // (nothing flips it now). The filter must include those — the
  // supervisee still needs to sign.
  it("includes past-end sessions still tagged scheduledStatus='scheduled'", () => {
    const now = new Date("2026-06-12T18:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "stale-scheduled",
        signedAt: null,
        signatures: [],
        // Started 4 hours ago, 1h long — ended 3 hours ago.
        date: new Date("2026-06-12T14:00:00Z"),
        scheduledStatus: "scheduled",
      }),
    ];
    const result = pendingSignaturesForUser(events, "me", now);
    expect(result.map((e) => e.id)).toEqual(["stale-scheduled"]);
  });

  it("excludes scheduledStatus='scheduled' rows whose end hasn't passed yet", () => {
    const now = new Date("2026-06-12T14:30:00Z");
    const events = [
      mkSupervisionEvent({
        id: "in-progress",
        signedAt: null,
        signatures: [],
        // Started 30 min ago, 1h long — ends 30 min from now.
        date: new Date("2026-06-12T14:00:00Z"),
        scheduledStatus: "scheduled",
      }),
    ];
    expect(pendingSignaturesForUser(events, "me", now)).toEqual([]);
  });
});
