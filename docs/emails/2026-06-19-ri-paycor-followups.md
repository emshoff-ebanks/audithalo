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
**Subject:** RI Paycor auto-provisioning — picking your brain

> Matt, Nick —
>
> Damon flagged you guys as the experts on auto-provisioning / deep provisioning. We're standing up a Paycor ↔ AuditHalo real-time roster sync for Recovery Innovations (multi-site, JC-accredited customer, ~biweekly hiring classes + daily attrition).
>
> A few specific asks from your prior work, in priority order:
>
> 1. **Event payload shape** for hire / terminate / leave-status changes — what schema did you normalize to between Paycor and your downstream? Saves us re-deriving it.
> 2. **Manager vs clinical supervisor** — Paycor surfaces a manager reference, but in healthcare ops the HR manager often isn't the clinical supervisor. How did you handle that distinction for auto-assignment, or did you punt to a human-in-the-loop step?
> 3. **Idempotency + retry model** — what's your dedupe key for a Paycor change event, and how do you handle replay safety if the webhook fires twice?
> 4. **Paycor webhook vs polling** — did you go webhook-first, polling-first, or both? Any rate-limit gotchas?
> 5. **SFTP credential pattern** — if you've done SFTP-to-Paycor anywhere, what's your key-pair management approach (per-customer, per-env, KMS)?
>
> No rush — even a 15-min call when you've got time would be huge. We're on the AuditHalo side at `info@audithalo.com`.
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
