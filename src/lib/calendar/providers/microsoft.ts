/**
 * Microsoft Graph adapter for the calendar provider abstraction.
 *
 * Endpoints used (all under https://graph.microsoft.com/v1.0):
 *   - POST /me/events                — create
 *   - PATCH /me/events/{id}          — update
 *   - DELETE /me/events/{id}         — cancel + remove
 *   - GET /me/calendarView?...       — list events in a window for conflict
 *                                      detection (handles recurring expansion
 *                                      better than /me/events)
 *
 * Teams meetings: setting `isOnlineMeeting: true` +
 * `onlineMeetingProvider: "teamsForBusiness"` on event creation tells Graph
 * to provision a Teams meeting in the same call, and the response's
 * `onlineMeeting.joinUrl` is the deep link we surface on the Join button.
 */
import { AUDITHALO_EVENT_TAG } from "../types";
import type {
  CalendarEventSummary,
  CalendarProviderClient,
  CreateEventInput,
  CreateEventOutput,
  UpdateEventInput,
} from "../types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

type GraphErrorResponse = {
  error?: { code?: string; message?: string };
};

type GraphEvent = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  onlineMeeting?: { joinUrl?: string };
  onlineMeetingProvider?: string;
};

async function graphFetch(
  accessToken: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as GraphErrorResponse;
    throw new Error(
      `MS Graph ${res.status} ${res.statusText}: ${err.error?.code ?? ""} ${err.error?.message ?? ""}`.trim()
    );
  }
  return res;
}

function buildEventBody(input: CreateEventInput | UpdateEventInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.subject = input.title;
  if (input.startUtc !== undefined && input.timeZone !== undefined) {
    body.start = {
      // Graph expects ISO8601 without timezone suffix + a separate tz field.
      dateTime: input.startUtc.toISOString().replace(/Z$/, ""),
      timeZone: "UTC",
    };
  }
  if (input.endUtc !== undefined && input.timeZone !== undefined) {
    body.end = {
      dateTime: input.endUtc.toISOString().replace(/Z$/, ""),
      timeZone: "UTC",
    };
  }
  if (input.attendeeEmails !== undefined) {
    body.attendees = input.attendeeEmails.map((email) => ({
      type: "required",
      emailAddress: { address: email },
    }));
  }
  if (input.description !== undefined || "withMeetingLink" in input) {
    const descLines: string[] = [];
    descLines.push(AUDITHALO_EVENT_TAG);
    if (input.description) descLines.push("", input.description);
    body.body = { contentType: "text", content: descLines.join("\n") };
  }
  if ("withMeetingLink" in input && input.withMeetingLink) {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = "teamsForBusiness";
  }
  if ("location" in input && input.location && !("withMeetingLink" in input && input.withMeetingLink)) {
    body.location = { displayName: input.location };
  }
  if ("recurrence" in input && input.recurrence && "startUtc" in input && input.startUtc) {
    const r = input.recurrence;
    const start = input.startUtc;
    // Graph supports weekly + monthly natively. Biweekly + every-3-weeks
    // ride on weekly recurrence with interval=2 or 3.
    let pattern: Record<string, unknown>;
    if (r.frequency === "monthly") {
      pattern = {
        type: "absoluteMonthly",
        interval: 1,
        dayOfMonth: start.getDate(),
      };
    } else {
      const interval =
        r.frequency === "weekly"
          ? 1
          : r.frequency === "biweekly"
            ? 2
            : 3;
      pattern = {
        type: "weekly",
        interval,
        daysOfWeek: [GRAPH_WEEKDAY[start.getDay()]],
        firstDayOfWeek: "monday",
      };
    }
    const isoDate = start.toISOString().slice(0, 10);
    body.recurrence = {
      pattern,
      range: {
        type: "numbered",
        startDate: isoDate,
        numberOfOccurrences: r.occurrenceCount,
      },
    };
  }
  return body;
}

const GRAPH_WEEKDAY = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function createMicrosoftProvider(
  accessToken: string,
  accountEmail: string | null
): CalendarProviderClient {
  return {
    name: "microsoft",
    accountEmail,

    async createEvent(input: CreateEventInput): Promise<CreateEventOutput> {
      const res = await graphFetch(accessToken, "/me/events", {
        method: "POST",
        body: JSON.stringify(buildEventBody(input)),
      });
      const data = (await res.json()) as GraphEvent;
      return {
        eventId: data.id,
        joinUrl: data.onlineMeeting?.joinUrl,
        conferenceId: input.withMeetingLink ? data.id : undefined,
      };
    },

    async updateEvent(input: UpdateEventInput): Promise<void> {
      await graphFetch(accessToken, `/me/events/${encodeURIComponent(input.eventId)}`, {
        method: "PATCH",
        body: JSON.stringify(buildEventBody(input)),
      });
    },

    async deleteEvent(eventId: string): Promise<void> {
      await graphFetch(accessToken, `/me/events/${encodeURIComponent(eventId)}`, {
        method: "DELETE",
      });
    },

    async listEventsInWindow(
      startUtc: Date,
      endUtc: Date
    ): Promise<CalendarEventSummary[]> {
      // /me/calendarView returns expanded recurring instances, which is
      // what we want for conflict detection.
      const params = new URLSearchParams({
        startDateTime: startUtc.toISOString(),
        endDateTime: endUtc.toISOString(),
        $select: "id,subject,bodyPreview,start,end",
        $top: "200",
      });
      const res = await graphFetch(
        accessToken,
        `/me/calendarView?${params.toString()}`
      );
      const data = (await res.json()) as { value: GraphEvent[] };
      return (data.value ?? []).map((e) => ({
        id: e.id,
        title: e.subject ?? "(no title)",
        startUtc: e.start ? graphTimeToUtc(e.start) : startUtc,
        endUtc: e.end ? graphTimeToUtc(e.end) : endUtc,
        isAuditHaloEvent: (e.bodyPreview ?? "").includes(AUDITHALO_EVENT_TAG),
      }));
    },
  };
}

function graphTimeToUtc(t: { dateTime: string; timeZone: string }): Date {
  // Graph returns a tz-less ISO string + a separate timeZone field.
  // When timeZone is "UTC" (what we send), append Z and parse. For other
  // tz values (rare on read-back after our writes, but possible), Graph
  // does the math for us when we query with Prefer: outlook.timezone -
  // for now, treat the string as UTC since that matches everything we wrote.
  const raw = t.dateTime.endsWith("Z") ? t.dateTime : `${t.dateTime}Z`;
  return new Date(raw);
}
