# RI + Paycor follow-up emails (drafted 2026-06-19)

> Three drafts for the post-2026-06-17-call follow-ups. Copy-paste
> ready. Update dates if/when re-sending. Canonical Wave 2 spec they
> back: `docs/strategy/13-paycor-integration.md`.

---

## Email 1 — To RI (shared thread)

**To:** Alicia Long, Bree Wolfgram, Joy Brunson-Nsubuga,
Christopher Reese, Tricia Lessard
**Subject:** AuditHalo + Paycor integration — items we need from your team to move forward

> Hi all,
>
> Good talking on Tuesday. Following up on what we discussed so we can keep momentum on the Paycor integration work. Five things from your side will unblock the engineering work on ours.
>
> **1. Supervision PDF template.** Damon mentioned you have a specific template for the supervision documentation that lands in Paycor's Documents folder. Anything you can share (current Word doc / PDF / a scan of what your supervisors fill out today) lets us program AuditHalo to generate exactly that shape, including the date-based naming convention so they sort cleanly in each employee's file.
>
> **2. Paycor admin contact.** Who on your team is the Paycor admin who can stand up the integration on Paycor's side? We'll need them to (a) add two small custom fields on the employee record — one for the AuditHalo role (HR admin / supervisor / supervisee / executive) and one for the on-leave status — and (b) help us coordinate the SFTP credentials with Paycor's partner support so the signed PDFs land in the Documents folder.
>
> **3. On-leave and PRN behavior in AuditHalo.** Bree mentioned you have folks who are on leave (still drawing a paycheck via short-term disability but not in clinical work) and PRN staff who might not work a given week. To make sure AuditHalo handles those cleanly, we want to confirm:
>
> - On-leave: pause their supervision hour clock entirely and stop reminders until they return?
> - PRN: keep them tracked, but no "needs supervision this week" reminders?
> - Return-to-active: should that flip automatically when Paycor reflects it, or does an HR admin confirm?
>
> I can send a short one-pager mapping each scenario if that's easier to react to than email.
>
> **4. Joint Commission source documents.** Tricia, you mentioned JC standards for behavioral health are usually stricter than state statutes and update frequently. To wire those into the same auto-update + alert system we're building for state rules, can you share the specific JC standards documents (or URLs) you audit against? Section numbers help us scope cleanly.
>
> **5. Sync timing.** When you said your Paycor data is "up to the minute" on your end — what timing matters most for you for AuditHalo to pick up Paycor changes? Sub-minute (we'd build to Paycor's webhooks), every few minutes (poll), or close-of-business is fine? Affects how we architect the two-way sync.
>
> Two more we'll need eventually but aren't blocking yet — happy to ask later:
>
> - The review period boundary you'd want the AI performance summaries to cover (calendar quarter, anniversary from Paycor, etc.).
> - Which team / site you'd like us to pilot the AI transcription flow with for the first two weeks before we roll it org-wide.
>
> Reply on this thread and whichever of you owns each area can pick it up. Thanks again — this is moving fast and we're glad you guys are along for the ride.
>
> — Caleb

---

## Email 2 — To Matt + Nick (Medipyxis internal)

**To:** Matt, Nick (Medipyxis executive devs)
**Subject:** AuditHalo Wave 2 — fresh eyes wanted

> Matt, Nick —
>
> Heads up on the next chunk of work at AuditHalo. We're standing up a Paycor ↔ AuditHalo daily roster sync + SFTP-based PDF delivery for our lead customer (Recovery Innovations — multi-site behavioral health, JC-accredited, biweekly hiring classes plus daily attrition). Full spec is in the repo at `docs/strategy/13-paycor-integration.md` (commit `32d21ff`).
>
> Nothing urgent here — just want a second set of eyes from senior devs as the design takes shape:
>
> 1. **Skim the spec when you've got a minute.** Catch anything that looks off — schema shape, phasing, dependencies, anything I'd benefit from someone with fresh perspective questioning.
> 2. **Patterns you've shipped** for any of: idempotent daily-cron syncs against external APIs, SFTP file delivery with retry + failure surfacing, audit-log shapes for external-sync events. Doesn't have to be Paycor — anything analogous helps.
> 3. **Code reviews** on the actual PRs as Wave 2 lands. First one is a small lifecycle-status schema migration (Phase 1.1) — would appreciate a glance before it goes in.
>
> No rush — reach me at `info@audithalo.com` or on whatever channel works.
>
> Thanks,
> Caleb

---

## Email 3 — To Paycor partner support

**Send AFTER** RI confirms which Paycor account / admin contact we route through (Email 1, ask #2). Until then this is a holding draft.

**To:** TBD (Paycor partner support)
**Subject:** AuditHalo integration on behalf of Recovery Innovations — SFTP + custom fields + webhooks

> Hi,
>
> AuditHalo is a supervision-compliance SaaS standing up an integration with Recovery Innovations, a Paycor customer. RI's Paycor admin will introduce us separately. We'd like to confirm a handful of capabilities before we finalize architecture on our side.
>
> 1. **SFTP capability.** Host endpoint, auth (key-pair preferred over password), file size limit per PDF, max simultaneous connections per customer.
> 2. **Folder convention** under each employee's profile → Documents — what's the actual SFTP path? Is it `{employeeId}/documents/`, `documents/{employeeId}/`, or something else?
> 3. **Post-upload tagging** — can we tag files via REST API after the SFTP push so they're filterable inside Paycor's UI?
> 4. **Webhook support** for hire / terminate / employment-status changes, or are we polling? If polling, rate limits.
> 5. **Custom field setup** — can custom fields on the employee record be created via API, or only via Paycor UI? If UI, what role does the customer's Paycor admin need?
> 6. **Sandbox / test account** access — we need to validate the SFTP and custom-field flows before pushing real RI clinician data.
>
> Happy to share more about AuditHalo's compliance posture (we're SOC-2 readiness work in progress, HIPAA covered-entity work scheduled per RI's clinical-data needs) if useful for your partner review.
>
> Thanks,
> Caleb Ebanks
> AuditHalo
> info@audithalo.com

---

## Email 1a — Reply to Bree's 2026-06-25 partial response

**To:** Bree Wolfgram (reply on existing shared thread, full group still cc'd)
**Subject:** Re: AuditHalo + Paycor integration — items we need from your team to move forward

> Hi Bree,
>
> Thanks — this is super helpful. Locking in:
>
> - **On-leave** pauses the supervision hour clock and the reminders until Paycor flips them back. ✓
> - **PRN** keeps the standard reminders going so a clinician picks up the supervision the next time they work. ✓ (Good catch — I'd had this one slightly different in my head.)
> - **Return-to-active** flips automatically as soon as Paycor reflects it. Paycor is the source of truth for status; we'll mirror, not override. ✓
> - **Sync timing** — daily at end-of-business is our v1 default. We'll architect for that and revisit if Alicia or Joy needs something tighter on their side.
>
> Three asks from the original list still open — flagging the likely owner for each so it's easy to delegate:
>
> 1. **Supervision PDF template** — Bree / Alicia, anything you can share (Word doc, PDF, scanned form) lets us program AuditHalo to match what currently lands in Paycor Documents.
> 2. **Paycor admin contact** — Alicia, you mentioned the API limitations on the call; whoever your Paycor admin is, that's the person we'd need to coordinate with on the two custom fields (AuditHalo role + on-leave flag) and the SFTP credentials. Once we have that, we can reach Paycor's partner support directly.
> 3. **Joint Commission source documents** — Tricia, the specific JC standards docs / URLs your team audits against. Section numbers help us scope what we wire into our state-rules auto-update.
>
> Two more we'll need eventually but not blocking yet — happy to circle back later:
> - Performance review period boundary (calendar quarter, anniversary date, etc.)
> - Pilot team / site for the AI transcription rollout
>
> Thanks again — really helpful.
>
> — Caleb

---

## Notes for re-sending

- If RI hasn't replied within ~7-10 days of the initial send, polite
  re-poke on the same thread is the next step.
- If Email 1 ask #2 (Paycor admin contact) is the only piece that
  comes back, send Email 3 immediately — most workstreams remain
  blocked without partner-support confirmation, and Paycor's response
  time is unknown.
- Email 2 (Matt/Nick) is internal and shouldn't need follow-up
  pressure — Damon can nudge them directly if needed.
