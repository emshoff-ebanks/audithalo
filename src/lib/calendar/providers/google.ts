/**
 * Google Calendar adapter for the calendar provider abstraction.
 *
 * Endpoints used (all under https://www.googleapis.com/calendar/v3):
 *   - POST   /calendars/primary/events?conferenceDataVersion=1  — create,
 *            with conferenceData.createRequest to auto-mint a Meet link
 *   - PATCH  /calendars/primary/events/{id}?conferenceDataVersion=1
 *   - DELETE /calendars/primary/events/{id}
 *   - GET    /calendars/primary/events?timeMin=...&timeMax=...&singleEvents=true
 *            (singleEvents=true expands recurring instances for conflict detection)
 *
 * Meet links: passing `conferenceData.createRequest` with a fresh
 * requestId on insert tells Calendar to provision a Meet meeting. The
 * response's `hangoutLink` is the user-friendly join URL.
 */
import { randomUUID } from "node:crypto";
import { AUDITHALO_EVENT_TAG } from "../types";
import type {
  CalendarEventSummary,
  CalendarProviderClient,
  CreateEventInput,
  CreateEventOutput,
  UpdateEventInput,
} from "../types";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  hangoutLink?: string;
  conferenceData?: { conferenceId?: string };
};

type GoogleErrorResponse = {
  error?: { code?: number; message?: string };
};

async function calFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${CALENDAR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as GoogleErrorResponse;
    throw new Error(
      `Google Calendar ${res.status} ${res.statusText}: ${err.error?.message ?? ""}`.trim()
    );
  }
  return res;
}

function buildEventBody(input: CreateEventInput | UpdateEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.summary = input.title;
  if (input.startUtc !== undefined && input.timeZone !== undefined) {
    body.start = {
      dateTime: input.startUtc.toISOString(),
      timeZone: input.timeZone,
    };
  }
  if (input.endUtc !== undefined && input.timeZone !== undefined) {
    body.end = {
      dateTime: input.endUtc.toISOString(),
      timeZone: input.timeZone,
    };
  }
  if (input.attendeeEmails !== undefined) {
    body.attendees = input.attendeeEmails.map((email) => ({ email }));
  }
  if (input.description !== undefined || "withMeetingLink" in input) {
    const descLines = [AUDITHALO_EVENT_TAG];
    if (input.description) descLines.push("", input.description);
    body.description = descLines.join("\n");
  }
  if ("withMeetingLink" in input && input.withMeetingLink) {
    body.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  if ("location" in input && input.location && !("withMeetingLink" in input && input.withMeetingLink)) {
    body.location = input.location;
  }
  if ("recurrence" in input && input.recurrence) {
    const r = input.recurrence;
    if (r.frequency === "monthly") {
      body.recurrence = [`RRULE:FREQ=MONTHLY;COUNT=${r.occurrenceCount}`];
    } else {
      const interval =
        r.frequency === "weekly"
          ? 1
          : r.frequency === "biweekly"
            ? 2
            : 3;
      body.recurrence = [
        `RRULE:FREQ=WEEKLY;INTERVAL=${interval};COUNT=${r.occurrenceCount}`,
      ];
    }
  }
  return body;
}

export function createGoogleProvider(
  accessToken: string,
  accountEmail: string | null
): CalendarProviderClient {
  return {
    name: "google",
    accountEmail,

    async createEvent(input: CreateEventInput): Promise<CreateEventOutput> {
      const params = new URLSearchParams();
      if (input.withMeetingLink) params.set("conferenceDataVersion", "1");
      // sendUpdates=all so Google emails each attendee an invite.
      params.set("sendUpdates", "all");
      const res = await calFetch(
        accessToken,
        `/calendars/primary/events?${params.toString()}`,
        {
          method: "POST",
          body: JSON.stringify(buildEventBody(input)),
        }
      );
      const data = (await res.json()) as GoogleEvent;
      return {
        eventId: data.id,
        joinUrl: data.hangoutLink,
        conferenceId: data.conferenceData?.conferenceId,
      };
    },

    async updateEvent(input: UpdateEventInput): Promise<void> {
      const params = new URLSearchParams({ sendUpdates: "all" });
      await calFetch(
        accessToken,
        `/calendars/primary/events/${encodeURIComponent(input.eventId)}?${params.toString()}`,
        {
          method: "PATCH",
          body: JSON.stringify(buildEventBody(input)),
        }
      );
    },

    async deleteEvent(eventId: string): Promise<void> {
      const params = new URLSearchParams({ sendUpdates: "all" });
      await calFetch(
        accessToken,
        `/calendars/primary/events/${encodeURIComponent(eventId)}?${params.toString()}`,
        { method: "DELETE" }
      );
    },

    async listEventsInWindow(
      startUtc: Date,
      endUtc: Date
    ): Promise<CalendarEventSummary[]> {
      const params = new URLSearchParams({
        timeMin: startUtc.toISOString(),
        timeMax: endUtc.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });
      const res = await calFetch(
        accessToken,
        `/calendars/primary/events?${params.toString()}`
      );
      const data = (await res.json()) as { items?: GoogleEvent[] };
      return (data.items ?? []).map((e) => ({
        id: e.id,
        title: e.summary ?? "(no title)",
        startUtc: parseGoogleTime(e.start, startUtc),
        endUtc: parseGoogleTime(e.end, endUtc),
        isAuditHaloEvent: (e.description ?? "").includes(AUDITHALO_EVENT_TAG),
      }));
    },

    async getTranscript(
      _meetingId: string,
      _joinUrl: string
    ): Promise<string | null> {
      // Google Meet transcripts land in Drive as a Google Doc named
      // "Meeting transcript - {event title}". We search by mime type
      // and the AuditHalo event tag to find our transcript.

      // First, get the calendar event to know the meeting title.
      let eventTitle: string | undefined;
      if (_meetingId) {
        try {
          const eventRes = await calFetch(
            accessToken,
            `/calendars/primary/events/${encodeURIComponent(_meetingId)}?fields=summary`
          );
          const eventData = (await eventRes.json()) as { summary?: string };
          eventTitle = eventData.summary;
        } catch {
          // Event might have been deleted — fall through to broader search
        }
      }

      const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
      async function driveFetch(path: string, init: RequestInit = {}): Promise<Response> {
        const res = await fetch(`${DRIVE_BASE}${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            ...(init.headers ?? {}),
          },
        });
        if (!res.ok) {
          throw new Error(`Google Drive ${res.status}: ${await res.text().catch(() => "")}`);
        }
        return res;
      }

      // Search Drive for transcript docs. Google names them
      // "Meeting transcript - <title>" or just "Meeting transcript"
      // for untitled meetings.
      const queryParts = [
        "mimeType='application/vnd.google-apps.document'",
        "name contains 'Meeting transcript'",
      ];
      if (eventTitle) {
        const escaped = eventTitle.replace(/'/g, "\\'");
        queryParts.push(`name contains '${escaped}'`);
      }
      const q = queryParts.join(" and ");
      const searchParams = new URLSearchParams({
        q,
        fields: "files(id,name,createdTime)",
        orderBy: "createdTime desc",
        pageSize: "5",
      });

      let fileId: string | undefined;
      try {
        const searchRes = await driveFetch(`/files?${searchParams.toString()}`);
        const files = (await searchRes.json()) as {
          files?: Array<{ id: string; name: string }>;
        };
        fileId = files.files?.[0]?.id;
      } catch {
        return null;
      }

      if (!fileId) return null;

      // Export the Google Doc as plain text
      try {
        const exportRes = await driveFetch(
          `/files/${encodeURIComponent(fileId)}/export?mimeType=text/plain`
        );
        const text = await exportRes.text();
        return text.trim() || null;
      } catch {
        return null;
      }
    },
  };
}

function parseGoogleTime(
  t: { dateTime?: string; date?: string } | undefined,
  fallback: Date
): Date {
  if (!t) return fallback;
  if (t.dateTime) return new Date(t.dateTime);
  if (t.date) return new Date(`${t.date}T00:00:00Z`);
  return fallback;
}
