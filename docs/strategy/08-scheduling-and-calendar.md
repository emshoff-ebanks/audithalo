# Scheduling + Calendar integration

_Drafted 2026-06-11. Strategy-only — no code in this commit. Companion to `06-ms-integrations.md` (the MS Graph spec this depends on). This doc covers the full scheduling/calendar feature: scheduling a supervision, calendar event creation on both parties' calendars, Teams/Meet meeting link generation, in-app join, notifications, recurring series, cancel/reschedule, no-show handling, and the new at-a-glance calendar view. Implementation phasing is at the bottom._

## Why this exists

Today AuditHalo only **logs sessions after the fact**. A supervisor finishes a session, manually opens the supervisee detail page, fills out date/time/duration, and signs. The session existed somewhere else first — a Teams meeting set up in Outlook, a calendar event on both parties' phones, a Zoom link sent by email — and AuditHalo just records it afterward.

That's backwards from how clinicians actually run supervision. The supervisor's primary workflow is: (1) decide we need supervision, (2) put it on the calendar, (3) show up, (4) document. AuditHalo entering only at step 4 means supervisors are dual-entering in two systems (their calendar + AuditHalo) and praying the times line up.

This feature collapses 1-4 into a single AuditHalo workflow:

> Supervisor opens AuditHalo → "Schedule supervision" → picks supervisee + time + (optionally) sets recurrence → AuditHalo writes the calendar event on both parties' calendars + generates the meeting link + sends notifications. At meeting time, both parties tap "Join" inside AuditHalo. After the meeting, the transcript flows in (Teams auto-fetch, or pasted), AI structures the note, both parties sign, the session seals, the evidence package mints.

This is the entry point to the entire compliance loop. Every downstream feature (AI note, signing, evidence package) already exists; we're putting a real front door on the workflow.

## Locked decisions

These are the answers we're treating as settled. Don't re-litigate without explicit decision.

1. **One-off + recurring both ship.** RI International explicitly asked about recurring; one-off is the simpler primitive recurring builds on top of.
2. **Microsoft Teams + Outlook Calendar first (per `06-ms-integrations.md`).** Then Google (Calendar + Meet) as a second provider on the same architecture.
3. **AuditHalo is the source of truth for the SCHEDULE.** Calendar providers (Outlook, Google) get mirrors of our schedule. We do NOT read THEIR calendar as the source of truth — that's a different feature (conflict detection, below) and uses read scope.
4. **Group sessions supported.** N supervisees per session. Each must sign before seal. (Original AuditHalo had this; we keep it.)
5. **One-tap-to-join inside the app.** Provider join URL opens in browser (Teams web) or Teams native client (deep link). Same pattern for Meet.
6. **Notifications default**: in-app bell + email. SMS skipped until customer asks.
7. **Calendar UI lives at `/dashboard/calendar`** as a dedicated route. NOT a global header dropdown.

## Open decisions (need Caleb's input before code)

- **Reschedule semantics for recurring**: when a supervisor reschedules occurrence #5 of a weekly series, does it affect only that occurrence, all future, or all? Industry convention is the "this occurrence / this and all future / entire series" three-button modal (like Google Calendar). Adopting that unless objected.
- **No-show window**: how many hours after scheduled time without action does AuditHalo flag as no-show? Proposing 24h.
- **Hard limit on series length**: a "weekly forever" recurrence is bad data hygiene. Proposing cap at 52 occurrences / 1 year; HR Admin can renew.
- **Default reminder timing**: schedule + T-1h + T-15m, per Caleb's spec. User-customizable in `/dashboard/account#notifications` (proposing dropdown: "1 hr + 15 min" / "24 hr + 1 hr" / "Only at meeting time" / Custom).
- **Conflict detection scope**: just the supervisor's calendar, or both parties? Proposing supervisor-only for v1; both parties = nice-to-have post-launch.
- **Pre-launch verification gate**: who tests this end-to-end with a real Teams account before we ship?

## Information architecture — where features live

### Primary routes

| Route | Who sees it | Purpose |
|---|---|---|
| `/dashboard/calendar` | Supervisor, HR Admin | Week / month / day / list view of all scheduled sessions. Default landing for supervisor's main view of their week. |
| `/dashboard/roster/[id]` | Supervisor, HR Admin (org-wide) | Existing supervisee detail page. Adds "Schedule supervision" button in the right rail. |
| `/dashboard` | Everyone | Existing dashboard. Adds a "Next session" card showing the next upcoming for the viewer + a quick "Schedule" CTA for supervisors. |
| `/sign/[sessionId]` | Supervisor, supervisee | Existing sign page. Becomes the **session detail page** — pre-meeting shows scheduled time + Join button + reschedule/cancel actions; post-meeting unchanged (transcript, AI note, sign). |
| `/dashboard/account#integrations` | Everyone | Existing settings page. Adds the Microsoft + Google connect/disconnect UI per `06-ms-integrations.md`. |
| `/dashboard/account#notifications` | Everyone | Existing settings page. Adds new notification categories with default-reminder-timing dropdown. |
| `/dashboard/team` | HR Admin | Existing team page. Adds an org-wide "Sessions this week" rollup card. |
| `/dashboard/executive` | Executive | Existing executive dashboard. Adds "Sessions scheduled this week" + "No-shows last 30 days" metrics. |

### Entry points to "Schedule a session"

A supervisor should be able to start scheduling from multiple places without thinking:

1. **`/dashboard/calendar`** — `+ New session` button top-right
2. **`/dashboard/roster/[id]`** — `Schedule supervision` button on the right rail (pre-fills supervisee)
3. **`/dashboard`** (supervisor view) — quick action card
4. **Click an empty slot on the calendar week view** — opens scheduler pre-filled with that time

### The schedule-session form

Single modal with two tabs (per a Lucide Tab pattern):

**Tab "One-off"** (default):
- Supervisee picker (multi-select for group; single-select default)
- Date + time + duration (number of minutes)
- Modality: Virtual / In-person
- If Virtual: provider picker (Microsoft Teams / Google Meet) — only shows providers the supervisor has connected; default = first connected
- If In-person: location text input
- Optional notes
- Reminder timing override (default per user setting)
- Submit → POST to `scheduleSessionAction`

**Tab "Recurring"**:
- Same fields as one-off, plus:
- Frequency: Weekly (default) / Bi-weekly / Every 3 weeks / Monthly
- End: After N occurrences (default 12) / On date / Never (capped 52)
- Submit → POST to `scheduleRecurringSeriesAction`

## The calendar view (`/dashboard/calendar`)

The at-a-glance view Caleb specifically asked for. Three layouts toggle via segmented control top-right:

### Week view (default for supervisor)

- 7 days, Mon-Sun by default (configurable to Sun-Sat per user)
- Hour rows 7am-9pm by default; events outside the window cause the grid to expand
- Each session renders as a colored block:
  - **Scheduled** (upcoming): blue, with supervisee initials + time
  - **Today, within 1hr**: amber border + "Join" badge
  - **Currently happening**: pulsing border
  - **Completed (awaiting sign)**: orange
  - **Signed/sealed**: green
  - **Canceled**: gray strikethrough
  - **No-show**: red dashed border
- Click a block → side drawer with details + actions (Join, Reschedule, Cancel, Open session page)
- Empty slot click → opens scheduler modal pre-filled with that time

### Month view

- Same color coding
- Each day cell shows up to 3 event chips + "+N more"
- Click day cell → list of that day's sessions

### List view

- Default for mobile
- Group by day with sticky headers
- Each row: time · supervisee name · duration · status badge · action chevron
- Filter bar persists across all 3 views: by supervisee, by status

### Side filters

- Supervisee multi-select (default: all)
- Status: scheduled / completed / signed / canceled / no-show (default: all except canceled)
- Date range jump: Today / This week / This month

### HR Admin view of the calendar

Same UI, but the supervisee filter defaults to "all org supervisees" and shows a supervisor column on each event (so HR Admin can see "Dr. Rivera ← → Jordan Reyes at 2pm").

## Data model additions

These additions to existing tables + new tables, sketched only. Migration to be authored when phase 1 starts.

### Extensions to `session_events`

```
scheduled_status     text            -- 'scheduled' | 'completed' | 'canceled' | 'no_show' | null (= post-fact log entry, legacy behavior)
recurring_series_id  uuid REFERENCES recurring_session_series(id) -- null for one-offs
meeting_provider     text            -- 'teams' | 'google_meet' | 'in_person' | null
meeting_join_url     text            -- the deep link for Join button
meeting_id           text            -- provider-specific id (e.g. Teams meeting id)
calendar_event_ids   jsonb           -- map of {userId: providerEventId} for cancel/reschedule
time_zone            text            -- IANA tz string (e.g. 'America/New_York')
canceled_at          timestamptz
canceled_by_user_id  uuid REFERENCES users(id)
```

Existing `scheduled_for` column (or `date`) keeps holding the canonical UTC timestamp; we display via the new `time_zone`.

### New table — `recurring_session_series`

```
id                   uuid pk
org_id               uuid not null REFERENCES organizations(id) ON DELETE CASCADE
supervisor_id        uuid not null REFERENCES users(id)
supervisee_ids       jsonb not null  -- array of user_ids; group sessions = >1
start_date           date not null
time_of_day          time not null   -- HH:MM in the series's timezone
duration_minutes     int not null
time_zone            text not null
frequency            text not null    -- 'weekly' | 'biweekly' | 'every_3_weeks' | 'monthly'
end_type             text not null    -- 'count' | 'end_date' | 'never'
end_count            int              -- valid when end_type='count'
end_date             date             -- valid when end_type='end_date'
meeting_provider     text             -- 'teams' | 'google_meet' | 'in_person'
location             text             -- in-person only
notes                text
created_by_user_id   uuid not null REFERENCES users(id)
created_at           timestamptz not null default now()
canceled_at          timestamptz
canceled_by_user_id  uuid REFERENCES users(id)
```

Series ROW is the template; we materialize concrete `session_events` upfront (capped at the series end or 52 occurrences). Editing a series can either bulk-update all unstarted future occurrences, or just one.

### New table — `user_calendar_integrations`

```
id                       uuid pk
user_id                  uuid not null REFERENCES users(id) ON DELETE CASCADE
provider                 text not null    -- 'microsoft' | 'google'
account_email            text             -- for display in /dashboard/account
access_token             text             -- encrypted at rest
refresh_token            text             -- encrypted at rest
expires_at               timestamptz
scopes                   text[]
default_reminder_minutes int[] not null default '{60, 15}'
sync_supervision_sessions boolean not null default true
connected_at             timestamptz not null default now()
UNIQUE (user_id, provider)
```

One row per (user, provider). Tokens encrypted via `MS_TOKEN_ENCRYPTION_KEY` (existing per `06-ms-integrations.md`) for Microsoft, new `GOOGLE_TOKEN_ENCRYPTION_KEY` for Google. Reusing one key for both is fine in practice but separate makes rotation per-provider easier.

### Notification kinds (extend existing system)

Add to `NotificationKind` enum:
- `session_scheduled` — sent to all parties when a session is created
- `session_reminder_1hour` — fired by cron T-1h
- `session_reminder_15min` — fired by cron T-15m
- `session_canceled` — supervisor canceled or system marked no-show
- `session_rescheduled` — time changed; payload includes old + new times

User can toggle each via `notificationPrefs` jsonb (existing pattern).

## Provider integrations

Each provider gets a small abstraction layer so the rest of AuditHalo treats them uniformly.

### Microsoft (Teams + Outlook Calendar)

Per `06-ms-integrations.md`. Single Entra ID app, scopes already specified there. Blocking on Damon's Entra registration.

### Google (Calendar + Meet)

New OAuth client in Google Cloud Console:
- App: "AuditHalo"
- Scopes: `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.readonly` (for conflict detection)
- Redirect URI: `https://app.audithalo.com/api/auth/google/callback` (and `https://staging.app.audithalo.com/...` if/when staging exists)
- Google Meet links are auto-generated as part of `events.insert` with `conferenceData.createRequest`

### Provider abstraction layer (`src/lib/calendar/provider.ts`)

```ts
type CalendarProvider = {
  name: 'microsoft' | 'google';
  createEvent(opts): Promise<{ eventId, joinUrl, conferenceId? }>;
  updateEvent(eventId, opts): Promise<void>;
  deleteEvent(eventId): Promise<void>;
  listEventsInWindow(start, end): Promise<Event[]>;  // for conflict detection
};
```

Each provider implements this interface. The scheduling action calls `provider.createEvent` without caring which provider it is. Adding Zoom later = implement the same interface.

## Notifications + reminders

### When notifications fire

| Trigger | What | Who |
|---|---|---|
| `scheduleSessionAction` succeeds | `session_scheduled` | all attendees + supervisor |
| Cron `daily-checks` (extended) every minute | `session_reminder_1hour` for sessions starting in 60-61 min | each attendee whose pref is enabled |
| Same cron | `session_reminder_15min` for sessions starting in 15-16 min | each attendee whose pref is enabled |
| `cancelSessionAction` succeeds | `session_canceled` | all attendees + supervisor (minus the canceler) |
| `rescheduleSessionAction` succeeds | `session_rescheduled` | all attendees + supervisor (minus the rescheduler) |
| Cron at T+24h after scheduled | (no notification) → flag `scheduled_status = 'no_show'`; `session_no_show` notification to supervisor only |

### User-configurable defaults

`/dashboard/account#notifications` adds a "Session reminders" section:

- **When**: dropdown (1hr + 15min — default / 24hr + 1hr / Only at meeting time / Custom: pick any combination)
- **How**: checkboxes for bell + email; both on by default

### Cron extension

We already have `daily-checks` cron at `/api/cron/daily-checks` running daily. The reminder timing needs minute-granularity. Two options:

1. **Reuse the daily cron, fire reminders for the next 24h batch each night**: low resolution, reminders come the night before instead of 1hr/15min before. Not great UX.
2. **Add a new minutely cron** at `/api/cron/scheduled-session-reminders` running every 5 minutes. Vercel cron supports 5-min minimum on Pro plans. **Recommended.**

## Cancel + reschedule

### Cancel a one-off

1. Supervisor or HR Admin clicks Cancel on the side drawer
2. Confirmation modal
3. Server action:
   - Sets `session_events.scheduled_status = 'canceled'`, `canceled_at`, `canceled_by_user_id`
   - Calls `provider.deleteEvent(eventId)` on each attendee's connected provider (for the events on their calendars)
   - Sends `session_canceled` notification to all attendees minus canceler
   - Audit log entry: `session.canceled`
4. The session_event row stays — it's part of the historical record (canceled sessions don't seal but they DO show in the audit log)

### Reschedule a one-off

1. Drawer → Reschedule → date/time picker
2. Server action:
   - Updates `session_events.scheduled_at`
   - Calls `provider.updateEvent` on each attendee's calendar
   - Sends `session_rescheduled` notification with old + new times
   - Audit log entry: `session.rescheduled` with details

### Cancel/reschedule a recurring occurrence

Modal: "This occurrence only / This and all future / Entire series." Per locked decision pattern.

- **This occurrence only**: marks the single `session_events` row, leaves the series intact, leaves future occurrences alone
- **This and all future**: walks future `session_events` for the series, marks all canceled OR updates time on all
- **Entire series**: marks the series canceled, marks ALL session_events (past included) where scheduled_status='scheduled'

## Time zones

- Storage: `session_events.scheduled_at` is `timestamptz` (UTC under the hood). Never store local times.
- Display: client-side via `Intl.DateTimeFormat(undefined, { timeZone: ... })`. Each session row carries its own `time_zone` from the series or, for one-offs, defaults to the supervisor's browser timezone at creation.
- Cross-zone notifications: email + bell payload includes BOTH "Your time: 3pm EDT" and "Supervisee time: 2pm CDT" when they differ.
- Form input: pick local time; we convert to UTC on submit.

## No-show handling

- Cron at T+24h flags any `session_events` row where `scheduled_status='scheduled'` AND the session's `scheduled_at + duration` is more than 24h in the past.
- Flag transitions row to `scheduled_status='no_show'`. Does NOT delete it.
- Sends `session_no_show` notification to supervisor.
- No-shows do NOT count toward compliance hours (the evaluator skips them).
- HR Admin sees "No-shows last 30 days" metric in `/dashboard/executive`.

## Conflict detection

When the supervisor clicks Schedule and they have read scope to their connected calendar:

1. Schedule modal calls `provider.listEventsInWindow(start, end)` against the supervisor's calendar
2. If any non-AuditHalo event overlaps, show a soft warning: *"You have 'Team standup' at this time. Schedule anyway?"*
3. Allow override (warning, not block — sometimes the supervisor knows it's resolvable)

## Group sessions

Existing `session_events` supports group via `supervisee_id` being... actually, looking at the current schema, `supervisee_id` is a single FK. For group sessions, we either:

- **Option A (lightweight)**: keep `session_events.supervisee_id` as the primary attendee + add a `session_attendees` table for additional supervisees
- **Option B (heavier)**: make `supervisee_id` nullable + add `session_attendees` always

**Recommendation: Option A.** Most sessions are 1-on-1; group is the exception. Primary attendee stays in `supervisee_id` for backward compat with existing queries. Additional attendees join via the new table. Decide at migration time.

For group: signing requires ALL attendees to sign, not just primary. Existing `signSessionAction` needs an update to check the full attendee set.

## Phase delivery plan

Aiming to land in 5 chunks. Each chunk ships as one PR + bulk-merge to main, no rolling deploys.

### Phase 1 — One-off scheduling, Teams only (1-2 weeks)

- `scheduleSessionAction` server action
- Schedule modal UI on `/dashboard/roster/[id]` (one entry point first)
- Microsoft OAuth + token refresh (per `06-ms-integrations.md`)
- Teams meeting creation + Outlook calendar event on supervisor + supervisee
- `session_scheduled` notification
- Pre-meeting state on `/sign/[id]` with Join button when within window
- Time-zone storage + local display

Out of scope for Phase 1: calendar view, recurring, Google, conflict detection, reschedule (cancel is in).

### Phase 2 — Calendar view (1 week)

- `/dashboard/calendar` page with Week + Month + List
- Filter bar (supervisee, status)
- Click event → side drawer
- Empty-slot click → pre-filled schedule modal
- Supervisor + HR Admin variants

### Phase 3 — Recurring (1 week)

- `recurring_session_series` table + migration
- Recurring tab in schedule modal
- `scheduleRecurringSeriesAction` materializes N session_events
- Edit/cancel: "this / this+future / entire series" pattern

### Phase 4 — Google Calendar + Meet (1 week)

- Google OAuth client + connect UI in `/dashboard/account#integrations`
- `GoogleCalendarProvider` implementing the abstraction layer
- Provider picker in schedule modal becomes useful (Teams OR Meet)

### Phase 5 — Polish + edge cases (3-5 days)

- Reschedule with provider sync
- Conflict detection
- No-show cron + flag + notification
- Reminder cron (T-1h, T-15m)
- Group session signing flow update
- Account page reminder-timing customization
- Executive dashboard metrics

### Phase 6 (later, post-launch) — Teams transcript auto-fetch

Per `06-ms-integrations.md`. Hooks Teams meeting → AI note pipeline. Eliminates the manual paste step. Separate effort — not strictly a scheduling feature.

## Open questions for stakeholders

Before Phase 1 ships, need answers on:

1. **Damon: Entra ID app registration done?** (`06-ms-integrations.md` blocker, also Phase 1 blocker)
2. **Damon: Google Cloud project created?** (Phase 4 blocker; can defer)
3. **Caleb: 24h no-show window OK, or different threshold?**
4. **Caleb: 52-occurrence cap on recurring series OK, or different?**
5. **Caleb: Reminder defaults (1hr + 15min) match what we want as out-of-box?** (Damon's email asked for them; confirming.)
6. **Caleb: Provider picker on schedule modal — show all attached providers and let user pick, or default to the supervisor's preferred provider?**
7. **Caleb: Conflict detection v1 — supervisor's calendar only, or both parties?**

## Pre-merge gate (template for each phase)

When implementation begins, every phase merges with:

- [ ] vitest green
- [ ] Playwright e2e green (need new specs for schedule/cancel/reschedule)
- [ ] forbidden-pattern grep gate clean
- [ ] Damon-verified smoke test on prod with a real Teams account
- [ ] Caleb-verified UI walkthrough on `audihalosupervisor@gmail.com` + Damon Test Org
- [ ] Migration applied to prod Neon via `repair-migrations.ts` (additive only — no destructive ops)

## Cross-references

- `06-ms-integrations.md` — Microsoft OAuth + transcript-fetch spec. Phase 1 depends on the OAuth half.
- `04-enterprise-rbac.md` — RBAC matrix. HR Admin can schedule/reschedule org-wide; Supervisor scheduled-roster-only; Supervisee read-only on their own sessions.
- `01-launch-plan.md` §11 — Phase 4 in the roadmap is "AI docs + Teams import." Scheduling sits between Phase 3 and Phase 4 in temporal order.
