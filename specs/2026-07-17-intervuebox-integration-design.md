# IntervueBox Integration — Design

## Context

Merito HUB's fitment flow is currently 100% in-house:
- Landing widget (`FitmentChecker.tsx`) → `POST /api/hub/fitment-check` → `scoreFitment.ts` (Claude, instant 0–10 score) → row in `fitment_leads`.
- Dashboard unlock → `POST /api/hub/unlock-report` → `generateFitmentReport.ts` (Claude, detailed category breakdown + action plan) → row in `fitment_reports` → rendered by `app/hub/account/report/page.tsx`.

This replaces both Claude calls with IntervueBox (https://intervuebox.ai), a hiring-platform API that provides:
1. **Resume-match report** — async score of a candidate's resume against a job (`GET /reports/applicants/:appliedJobId/resume-match`).
2. **AI interview report** — a real AI-conducted interview the candidate takes on IntervueBox's own platform, whose report we pull after the fact (`GET /reports/interviews`).

These are two distinct products, not one — the design treats them as two sequential phases, not a single swap.

## Decisions locked in

| Decision | Choice | Reasoning |
|---|---|---|
| Scope | Replace both landing score AND unlocked report | Confirmed by user — resume-match report replaces the instant Claude score; AI interview report replaces the detailed Claude report |
| Step mapping | `report` step (₹299 unlock) = resume-match. `interview` step = new, separate build-out | `app/hub/account/ProgressRail.tsx` already models these as two separate steps in the roadmap (`report` unlocked today via Claude; `interview` currently "Coming soon", no CTA yet). IntervueBox's resume-match report naturally fills the `report` step (score + detailed breakdown, same underlying call gated free-vs-paid like today); the real AI interview naturally fills the previously-unbuilt `interview` step, with its own CTA independent of the `report` paywall |
| Job-to-JD mapping | One IntervueBox Job per submission | Matches current no-dedup semantics (every fitment-check submission already creates a fresh `fitment_leads` row); avoids correctness risk of merging unrelated JDs by hash |
| Landing wait UX | Deferred — build first, decide after latency spike | Real resume-match turnaround time is undocumented; decide polling-vs-email once measured against a real key |
| Interview UX | Redirect + webhook | No embed/iframe/SDK is documented anywhere in IntervueBox's docs (checked overview, quickstart, invitations, openapi.yaml) — the AI interview only runs on IntervueBox's own hosted product. Candidate leaves Merito, IntervueBox notifies us via webhook when the report is ready |
| Credentials | Not yet available | Build against the documented contract behind an env var gate; cannot live-test until a key exists |

## Architecture

New module `lib/intervuebox/`:
- `client.ts` — thin fetch wrapper: injects `Authorization: Bearer ${INTERVUEBOX_API_KEY}`, base URL from `INTERVUEBOX_BASE_URL` env (prod/staging), normalizes IntervueBox's `{code, message, status, details}` error shape into a typed `IntervueBoxError`.
- `jobs.ts` — `createJob(roleTitle, jdText)` → `ib_job_id`.
- `resumes.ts` — `uploadResume(file, { jobId })` → `ib_resume_id`. Forwards the raw uploaded file directly (multipart) — no text extraction needed anymore.
- `applicants.ts` — `addApplicant(jobId, resumeId, candidateMeta)` → `ib_applied_job_id`.
- `agents.ts` — `getOrCreateInterviewAgent(jobId)` → `ib_agent_id` (backs the AI interview invitation).
- `invitations.ts` — `sendInterviewInvitation(agentId, candidateIds)`.
- `reports.ts` — `getResumeMatchReport(appliedJobId)`, `getInterviewReport(interviewSessionId)`.

### Why `parseCvFile.ts` / `pdf-parse` / `mammoth` go away from this flow
Today the CV is parsed to plain text purely to feed Claude's prompt. IntervueBox's Resumes API takes the original file bytes (multipart), so once Claude scoring is removed there's no reason to extract text at all — the raw `File` is forwarded as-is. (Leave `parseCvFile.ts` in the repo only if something else still depends on it — grep before deleting.)

## Data flow

### Phase A — landing free check (replaces `scoreFitment`)
1. `FitmentChecker.tsx` submits form (unchanged fields) with the raw CV file.
2. `POST /api/hub/fitment-check`:
   - Same validation as today (recaptcha, rate limits, file size/type — already PDF/DOCX/5MB, compatible).
   - `createJob(role, jdText)` → `ib_job_id`.
   - `uploadResume(file, { jobId })` → `ib_resume_id`.
   - `addApplicant(jobId, resumeId, { name, email })` → `ib_applied_job_id`.
   - `getResumeMatchReport(appliedJobId)` — likely `PENDING` on first call.
   - Insert `fitment_leads` row with the new `ib_*` columns and `resume_match_status`.
   - Respond `{ status: "pending", leadId }` if not `READY` yet, or `{ score, verdict }` if it resolved inline.
3. New lightweight endpoint `GET /api/hub/fitment-check/status?leadId=...` — re-fetches the resume-match report and flips `fitment_leads.resume_match_status` to `READY` once available. Widget polls this on a short interval with a bounded timeout (exact interval/timeout set after the latency spike below).
4. **Spike required before finalizing UX**: once a key exists, hit `getResumeMatchReport` end-to-end and measure real PENDING→READY latency. If it's seconds, keep in-widget polling. If it's minutes+, add an email-when-ready fallback instead of leaving the user staring at a spinner.

### Phase B — `report` step unlock (₹299), replaces `generateFitmentReport`
This is the existing paywall unlock — it stays a paywall, it just now reveals the resume-match report's full detail instead of Claude's category breakdown. **No interview is triggered here.**
1. `POST /api/hub/unlock-report` (unchanged trigger: paywall unlock click):
   - Look up the lead's `ib_applied_job_id` (already stored from Phase A).
   - Re-fetch `getResumeMatchReport(appliedJobId)` for the full (non-truncated) detail.
   - Mark `report_unlocks` as today (unchanged — `lib/reportUnlocks.ts` doesn't care what generates the report).
   - Respond `{ status: "unlocked", report: <resume-match detail> }`.
2. `app/hub/account/report/page.tsx` renders the resume-match detail instead of `fitment_reports` categories/action-plan. Exact field mapping depends on the resume-match JSON shape — see Open Items (#4).

### Phase C — `interview` step (new build-out, separate from Phase B)
Fills in `ProgressRail`'s existing "Mock AI interview — Coming soon" step with a real flow, gated by its own CTA, independent of the `report` paywall.
1. New CTA on the `interview` step triggers `POST /api/hub/start-ai-interview` (new route):
   - Look up the lead's `ib_job_id`.
   - `getOrCreateInterviewAgent(jobId)` → `ib_agent_id`.
   - `sendInterviewInvitation(agentId, [candidatePublicId])`.
   - Insert/upsert a `fitment_interviews` row: `status = "invited"`.
   - Respond `{ status: "invited" }` — UI shows an "AI interview invited" state. Exact next-step copy ("check your email" vs. a direct link button) is an **open item** — depends on whether the invitation response or IntervueBox's own email carries a candidate-facing link (undocumented; see Open Items #1).
2. Candidate takes the interview on IntervueBox's platform (outside Merito).
3. **Webhook** `app/api/webhooks/intervuebox/route.ts`:
   - Verify `HMAC-SHA256` signature per IntervueBox's webhook doc.
   - On `ApplicantAIInterviewStatusChanged` → update `fitment_interviews.status`.
   - On `AIInterviewReportGenerated` → call `getInterviewReport(...)`, store the raw JSON in `fitment_interviews.report_raw`, set `status = "ready"`.
   - Exact payload shape (which public IDs it carries, how we match it back to our row) is undocumented — see Open Items (#2).
4. A new interview-report view (own section, not `app/hub/account/report/page.tsx`) renders `fitment_interviews.report_raw` once ready. Exact UI mapping depends on the interview-report JSON shape — see Open Items (#3).

**Build sequencing implication:** Phase A and Phase B are fully specifiable now (documented field names throughout) and ship first. Phase C's webhook parsing and report UI cannot be responsibly coded until IntervueBox supplies a sandbox key and sample payloads — it becomes a separate follow-up plan.

## Data model changes (Supabase)

Extend rather than replace where possible, since `fitment_leads` already models "one row per submission":

**`fitment_leads`** — add columns:
- `ib_job_id text`
- `ib_resume_id text`
- `ib_applied_job_id text`
- `resume_match_status text` (`PENDING` / `READY`)
- `resume_match_score numeric`
- `resume_match_raw jsonb`

**New table `fitment_interviews`** (replaces `fitment_reports`):
- `user_id`, `role_title` (existing keying pattern)
- `ib_agent_id text`
- `ib_interview_session_id text`
- `status text` (`invited` / `in_progress` / `completed` / `ready`)
- `report_raw jsonb`
- `created_at`, `updated_at`

`report_unlocks` stays as-is — it already gates access; it doesn't care what generates the report.

## Error handling
- IntervueBox's `{code, message, status, details}` error shape gets wrapped into a typed error in `client.ts`, so route handlers can pattern-match on `code` the same way they already check `UnsupportedCvFileError` today.
- `429` → surface the existing "try again later" UX, but honor IntervueBox's `retry_after` instead of our own rate limiter windows where applicable.
- If Job/Resume/Applicant creation partially succeeds then a later step fails (e.g. resume upload OK, applicant-add fails), log enough (`ib_job_id`, `ib_resume_id`) to manually reconcile or retry rather than silently orphaning IntervueBox-side records.
- Webhook signature failures → `401`, no retry encouragement (matches IntervueBox's own "4xx not retried" behavior).

## Open items — resolved vs. still open

The first design pass here relied on WebFetch's AI-summarized docs, which turned out to paraphrase over exact field names. Re-fetched the raw markdown source (`curl` + direct read) for jobs/resumes/reports/invitations/webhooks and got verbatim request/response schemas. Most items below are now resolved:

1. ~~Invitation response / candidate link~~ **RESOLVED**: `POST /invitations/interviews/:id` returns only `{success, invited, failed, results: [{candidateId, success}], errors}` — no link field. Docs state: "Candidates will receive an email invitation with a link to start the interview" — IntervueBox emails the candidate directly. Dashboard copy after triggering the interview step is simply "check your email," no button/link needed on our side.
2. **Webhook payload body shape — partially open.** Signing/verification is fully documented (HMAC-SHA256 over `{timestamp}.{raw_body}`, `X-IB-Timestamp` / `X-IB-Signature: t=...,v1=...` headers, reference Node.js verify code given verbatim). The event *names* are documented (`AIInterviewReportGenerated`, `ApplicantAIInterviewStatusChanged`, etc.) but the exact JSON body delivered per event is not shown. Mitigation: the webhook handler doesn't need to trust body field names — we already hold `ib_agent_id` (=`interviewId`) and `candidateId` from our own `fitment_interviews` row (captured at invitation time), so on any validly-signed webhook hit we re-fetch `GET /reports/interviews` for every row of ours in `invited`/`in_progress` status using our own stored IDs, rather than parsing the delivery body for identifiers. This sidesteps the unknown shape entirely.
3. ~~Interview report JSON shape~~ **RESOLVED**: `GET /reports/interviews` returns `sessionDetails.overallSkillScore`, `sessionDetails.skillReport` (technical/communication/problemSolving numbers), `sessionDetails.overallReport` (narrative), `sessionDetails.answers[]`, `shareableReportLink`, etc. — full verbatim schema now in hand.
4. ~~Resume-match report JSON shape~~ **RESOLVED**: `GET /reports/applicants/:appliedJobId/resume-match` returns (once `status: "READY"`) `resumeMatch.overallScore` (0–100), `resumeMatch.rank`, six category breakdowns (`skillsMatch`, `educationMatch`, `experienceMatch`, `locationMatch`, `domainMatch`, `roleRelevance`, each `{score, comment}`), `summary`, `strongPoints[]`, `weakPoints[]`. This maps directly onto the existing report page's category-breakdown UI shape.
5. **Real resume-match latency — still open.** Genuinely requires a live key to measure; no amount of doc-reading resolves this. Decide landing-widget polling interval/timeout after a real spike call.

## New gap found during re-verification: required applicant fields Merito doesn't collect

`POST /jobs/:jobId/applicants` requires `currentCtc`, `expectedCtc`, `willingToRelocate`, `hearAboutUs`, `noticePeriod`, `phoneNumber`, `name` — all required. Merito's landing form (`FitmentChecker.tsx`) collects only name, email, target role, JD, and CV. Two ways to close this gap:
- **(a)** Add a phone number field to the landing form (the one field IntervueBox can't reasonably default) and send placeholder/generic values for the rest (`currentCtc`/`expectedCtc`: `"Not specified"`, `willingToRelocate`: `"Not specified"`, `hearAboutUs`: `"Merito HUB"`, `noticePeriod`: `"Not specified"`) since these are free-text `string` fields with no documented enum constraint.
- **(b)** Skip the dedicated Add-Applicant endpoint and instead pass applicant metadata directly on the Resume upload call (`POST /resumes` accepts the same fields optionally when `jobId` is set) — but the doc's own wording ("if you send jobId and a *complete set* of these fields, the resume is linked...") suggests partial fields may not reliably create the link, so this doesn't actually avoid needing the same data.

**Confirmed by user: option (a).** Add a phone number input to `FitmentChecker.tsx` (single required field); placeholder the rest (`currentCtc`/`expectedCtc`: `"Not specified"`, `willingToRelocate`: `"Not specified"`, `hearAboutUs`: `"Merito HUB"`, `noticePeriod`: `"Not specified"`).

## Job-creation field defaults (Merito doesn't collect these either)

`POST /jobs` requires `title`, `location[]`, `jobType`, `industry`, `designation`, `openings`, `department`, `jobDescription` — Merito's form only supplies a role title and JD text. Defaults used: `location: ["Remote"]`, `jobType: "Full-time"`, `industry: "General"`, `designation: <role title>`, `department: "General"`, `openings: 1`. These are free-text/no-enum fields per the docs, so generic defaults are safe to ship; flagged here since they're inferred, not user-provided.

## Testing
- Unit tests per `lib/intervuebox/*` module with mocked `fetch` (mirrors existing `lib/__tests__/generateFitmentReport.test.ts` pattern).
- Route tests for `fitment-check` and `unlock-report` mock the IntervueBox client the same way current tests mock `scoreFitment`/`generateFitmentReport`.
- Webhook route test: valid signature → row updated; invalid signature → 401; unknown event type → 200 no-op (don't fail on future event types).
