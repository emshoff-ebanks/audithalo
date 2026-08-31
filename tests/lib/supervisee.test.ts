import { describe, it, expect } from "vitest";
import { pendingSignaturesForUser } from "@/lib/supervisee";
import type { schema } from "@/lib/db";

type SessionEvent = typeof schema.sessionEvents.$inferSelect;

function mkSupervisionEvent(opts: {
  id: string;
  signedAt: Date | null;
  signatures: Array<{ signerId: string; signerRole?: string }>;
  date?: Date;
  scheduledStatus?: string | null;
  superviseeId?: string;
}): SessionEvent {
  return {
    id: opts.id,
    superviseeId: opts.superviseeId ?? "u1",
    orgId: "o1",
    kind: "supervision",
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
  // --- Supervisor viewer (userId !== superviseeId) ---

  it("returns unsigned sessions for a supervisor viewer", () => {
    const events = [
      mkSupervisionEvent({ id: "a", signedAt: null, signatures: [] }),
    ];
    const result = pendingSignaturesForUser(events, "supervisor-1");
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

  it("includes completed-but-unsigned sessions for supervisor", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "completed",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-10T12:00:00Z"),
        scheduledStatus: "completed",
      }),
      mkSupervisionEvent({
        id: "legacy",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-09T12:00:00Z"),
        scheduledStatus: null,
      }),
    ];
    expect(
      pendingSignaturesForUser(events, "supervisor-1", now).map((e) => e.id)
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

  it("includes past-end sessions still tagged scheduledStatus='scheduled' for supervisor", () => {
    const now = new Date("2026-06-12T18:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "stale-scheduled",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-12T14:00:00Z"),
        scheduledStatus: "scheduled",
      }),
    ];
    const result = pendingSignaturesForUser(events, "supervisor-1", now);
    expect(result.map((e) => e.id)).toEqual(["stale-scheduled"]);
  });

  it("excludes scheduledStatus='scheduled' rows whose end hasn't passed yet", () => {
    const now = new Date("2026-06-12T14:30:00Z");
    const events = [
      mkSupervisionEvent({
        id: "in-progress",
        signedAt: null,
        signatures: [],
        date: new Date("2026-06-12T14:00:00Z"),
        scheduledStatus: "scheduled",
      }),
    ];
    expect(pendingSignaturesForUser(events, "me", now)).toEqual([]);
  });

  // --- Supervisee viewer (userId === superviseeId) + signing order ---

  it("excludes sessions for the supervisee when supervisor has NOT signed yet", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "waiting",
        signedAt: null,
        signatures: [],
        superviseeId: "supervisee-1",
        date: new Date("2026-06-10T12:00:00Z"),
      }),
    ];
    expect(pendingSignaturesForUser(events, "supervisee-1", now)).toEqual([]);
  });

  it("includes sessions for the supervisee AFTER supervisor has signed", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "ready",
        signedAt: null,
        signatures: [{ signerId: "sup-1", signerRole: "supervisor" }],
        superviseeId: "supervisee-1",
        date: new Date("2026-06-10T12:00:00Z"),
      }),
    ];
    const result = pendingSignaturesForUser(events, "supervisee-1", now);
    expect(result.map((e) => e.id)).toEqual(["ready"]);
  });

  it("excludes sessions for the supervisee when only another supervisee has signed (no supervisor)", () => {
    const now = new Date("2026-06-12T12:00:00Z");
    const events = [
      mkSupervisionEvent({
        id: "no-sup",
        signedAt: null,
        signatures: [{ signerId: "other-supervisee", signerRole: "supervisee" }],
        superviseeId: "supervisee-1",
        date: new Date("2026-06-10T12:00:00Z"),
      }),
    ];
    expect(pendingSignaturesForUser(events, "supervisee-1", now)).toEqual([]);
  });
});
