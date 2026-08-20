# Admin Email Template Management — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Sixth of the 13-category admin survey. Scope confirmed tight: the 5 transactional-email files only (`recruiterEmails.ts`, `recruiterViewEmails.ts`, `paymentEmails.ts`, `referenceEmails.ts`, `app/api/contact/route.ts`), not marketing-site copy — that'd be a separate CMS project.

Verified current state: **6 distinct templates** across those 5 files (`RecruiterVerification`, `RecruiterViewedNotification`, `PaymentFailedAlert`, `RefereeInvite`, `RefereeReminder`, `ContactFormSubmission`), every one a hardcoded inline string in its sending function, every one sent via `Resend` (single provider, no other email path in the app), every one sending parallel `text` + `html` bodies. No existing template store, no shared template-rendering helper — `escapeHtml()` is duplicated three times inconsistently (present in 3 files, absent in 2).

**Decision: include all 6, not just the 4 candidate/recruiter-facing ones.** `PaymentFailedAlert` and `ContactFormSubmission` are internal-only, but they're the same mechanism at near-zero marginal cost — splitting into "2 systems" (DB-backed for 4, code-only for 2) would be more complex than just including all 6 in one system.

## Data model

New migration `0036_email_templates.sql`:

```sql
create table email_templates (
  key text primary key,          -- 'recruiter_verification', 'recruiter_viewed', 'payment_failed_alert',
                                  -- 'referee_invite', 'referee_reminder', 'contact_form_submission'
  subject text not null,
  body_text text not null,
  body_html text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);
```

Seed data = the current hardcoded strings verbatim (behavior unchanged on ship) — inserted in the same migration so there's no gap between deploy and content existing.

## Rendering

New `lib/emailTemplates.ts`:
- `getTemplate(key)` — fetch row, in-process cache (short TTL, e.g. 60s — these change rarely, avoids a DB round-trip on every send), **falls back to the current hardcoded string as a compiled-in default if the DB row is ever missing** (defensive — a template system should never be a single point of failure for sending email at all).
- `renderTemplate(key, values)` — `{{placeholder}}` substitution against `subject`/`body_text`/`body_html`, with **centralized `escapeHtml()`** applied to every interpolated value before substitution into `body_html` (fixes the inconsistent-escaping issue found during investigation — `recruiterEmails.ts`'s `url` placeholder currently isn't escaped at all).
- Each of the 5 sending files' functions changes from "build a literal template string" to "call `renderTemplate(key, { ...placeholders })`, pass the result to `resend.emails.send`" — the `Resend` call itself, `from`/`to`/`replyTo` resolution, and all URL-building logic (`getAbsoluteUrl`, token construction) **stay in code, not admin-editable** — only the copy/placeholder text moves to the table, per the investigation's own recommendation.

**Env-var content values stay in code, not migrated to placeholders.** `REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS` (appears inside `RefereeInvite`'s body) remains an env var passed in as a placeholder value by the sending function — it's a config number, not copy; folding it into DB-editable text would let an admin accidentally break the number format. Template edits change wording around it, not the number itself.

**`text` and `body_html` are edited as two separate fields, no auto-derivation.** Simpler than building a markdown-to-html renderer for a 6-template surface; matches how these already exist today (hand-written parallel content, not derived).

## Admin actions

- List all 6 templates (`app/admin/email-templates/page.tsx`).
- Edit a template (`app/admin/email-templates/[key]/page.tsx`) — three fields (subject, text body, html body), each shows the template's known placeholder list as a reference (e.g. `RefereeInvite` shows `{{refereeName}}`, `{{candidateName}}`, `{{url}}`, `{{validityDays}}`) so the admin doesn't need to read code to know what's available.
- **Send test email** — renders the template with sample placeholder values and sends to the logged-in admin's own email, before saving live. Catches broken `{{}}` syntax or obviously wrong copy before it reaches a real candidate/recruiter.

## API routes

- `GET /api/admin/email-templates` — list
- `GET /api/admin/email-templates/[key]` — detail
- `PATCH /api/admin/email-templates/[key]` `{ subject, bodyText, bodyHtml }`
- `POST /api/admin/email-templates/[key]/test`

All: `requireAdmin()`, Zod-validated, `try/catch` → structured error, `admin_audit_log` write on `PATCH` (prior/new value = full template diff, lets a bad edit be traced/reverted by reading the log even without a formal version-history table).

## Error handling

- `PATCH` validates that every `{{placeholder}}` the sending code actually requires for that `key` is still present in the submitted text (static known list per template, checked server-side) — rejects with `400` listing the missing placeholder(s) rather than silently shipping a template that'll render `{{candidateName}}` literally to a real recipient.
- Test-send failure (Resend API error) surfaces the raw provider error via `Toast`, doesn't silently swallow it — this is the one place an admin actively wants to see a delivery failure immediately.

## Testing

- `renderTemplate()`: placeholder substitution, `escapeHtml()` applied correctly to html body not text body, missing-DB-row fallback to hardcoded default.
- Each of the 5 sending files: existing tests updated to assert they now call `renderTemplate(key, ...)` with the correct placeholder values (behavior-equivalent to today's literal strings, not a new test category).
- Route tests: standard 401/400/404/happy-path, plus the missing-placeholder `400` case specifically.

## Explicitly out of scope

- Marketing-site copy / general CMS — separate, larger project if ever needed.
- Version history / rollback UI beyond what `admin_audit_log`'s prior/new value already gives (readable but not a one-click revert) — add a revert button later only if the log is actually used to manually restore something in practice.
- Multi-language templates — no evidence of a localization need anywhere in the current app.
- A visual/WYSIWYG html editor — plain textarea for `body_html` is enough at 6 templates; revisit only if template count grows substantially.
