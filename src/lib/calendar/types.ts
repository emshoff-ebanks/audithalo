/**
 * Shared types for the calendar provider abstraction. Concrete provider
 * adapters (Microsoft, Google) implement {@link CalendarProviderClient}.
 *
 * The scheduling action calls these methods without caring which provider
 * it has — the adapter handles all the per-API field mapping. Adding a
 * third provider later (Zoom, Cal.com) is just implementing this
 * interface.
 *
 * See docs/strategy/08-scheduling-and-calendar.md.
 */
import type { CalendarProvider } from "./oauth-config";

/**
 * Recurrence pattern for a series. The provider adapters translate this
 * to native recurrence (MS Graph `recurrence` object, Google Calendar
 * RRULE) so ONE provider event covers every occurrence and all attendees
 * see a single repeating series on their personal calendar.
 *
 * Materialized session_events rows in AuditHalo still get one row per
 * occurrence — the provider recurrence is purely a calendar-mirroring
 * optimization so we don't make N API calls.
 */
export type RecurrencePattern = {
  /** Days between occurrences mapped from the strategy doc:
   *   weekly       → 7
   *   biweekly     → 14
   *   every_3_weeks → 21
   *   monthly      → 30 (provider-native MONTHLY semantics, not exact 30d)
   */
  frequency: "weekly" | "biweekly" | "every_3_weeks" | "monthly";
  /** Total occurrences including the first. Capped at 52 by the locked
   *  decision in 08-scheduling-and-calendar.md §9. */
  occurrenceCount: number;
};

/** What the scheduler hands to a provider to create a session calendar event. */
export type CreateEventInput = {
  /** Visible title on the calendar, e.g. "Supervision: Dr. Rivera ↔ Jordan Reyes". */
  title: string;
  description?: string;
  /** Canonical UTC start. */
  startUtc: Date;
  /** Canonical UTC end. */
  endUtc: Date;
  /** IANA tz for display (e.g. 'America/New_York'). Stored on the row. */
  timeZone: string;
  /** All people who should appear on the calendar invite. */
  attendeeEmails: string[];
  /**
   * Whether to provision a meeting link (Teams / Meet). False for in-person.
   * When true, the provider response includes `joinUrl`.
   */
  withMeetingLink: boolean;
  /** Free-text location for in-person sessions. Ignored when withMeetingLink. */
  location?: string;
  /** Set when this event represents a recurring series. The provider
   *  will create ONE event with native recurrence covering every
   *  occurrence — joinUrl + eventId apply to all of them. */
  recurrence?: RecurrencePattern;
};

export type CreateEventOutput = {
  /** Provider-specific event id we persist to calendar_event_ids. */
  eventId: string;
  /** Deep link shown on the Join button, when a meeting link was requested. */
  joinUrl?: string;
  /** Provider-specific online-meeting id, when applicable. */
  conferenceId?: string;
};

export type UpdateEventInput = Partial<CreateEventInput> & {
  /** Provider event id returned from createEvent. */
  eventId: string;
};

export type CalendarEventSummary = {
  /** Provider event id. */
  id: string;
  /** Display title. */
  title: string;
  /** UTC start. */
  startUtc: Date;
  /** UTC end. */
  endUtc: Date;
  /** True for events AuditHalo wrote (we tag the description so conflict
   *  detection can ignore them). */
  isAuditHaloEvent: boolean;
};

export type CalendarProviderClient = {
  readonly name: CalendarProvider;
  /** Email address of the connected account. Used in audit log + UI. */
  readonly accountEmail: string | null;
  createEvent(input: CreateEventInput): Promise<CreateEventOutput>;
  updateEvent(input: UpdateEventInput): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  listEventsInWindow(
    startUtc: Date,
    endUtc: Date
  ): Promise<CalendarEventSummary[]>;
};

/**
 * Tag we drop into the event body so a later listEventsInWindow call can
 * tell which events AuditHalo wrote vs which are the user's other events.
 * Conflict detection ignores our own events.
 */
export const AUDITHALO_EVENT_TAG = "[AuditHalo]";
