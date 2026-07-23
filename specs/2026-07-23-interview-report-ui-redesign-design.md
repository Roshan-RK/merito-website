# AI Interview Report — UI Redesign — Design

## Why

The AI-interview report page (`/hub/account/interview`) currently renders as a plain stacked list (header line, one summary card, skill bars, two bullet lists, a link). The user compared it against the official report IntervueBox generates and exports as a PDF (`RoshanTest_HRBusinessPartner_v1.pdf`, live-tested 2026-07-23) and asked for a similar visual structure, but using Merito's own branding rather than IntervueBox's.

## Reference

The IntervueBox PDF has: a company/role header chip, a candidate info bar (contact + interview metadata), a "Parameters Score" grid of stat boxes, a circular "Overall Skill Score" gauge with a categorical band label, an "AI overview" paragraph, "Strengths" / "Areas of improvement" as two side-by-side columns, and an "Integrity Assessment" section (tab-change count, suspicious-activity flag/details).

## Scope decisions (confirmed with user)

1. **Cover core report + candidate info bar.** Skip Integrity Assessment entirely — showing a candidate their own "flagged suspicious" surveillance data was flagged as a questionable product decision, not just an engineering one, and is out of scope for this pass.
2. **Full PDF-style grid layout**, not a minimal re-skin and not a hybrid — the Parameters Score section becomes a stat-tile grid (not the horizontal bars used elsewhere in the Hub), matching the PDF's structure.
3. **Circular gauge for the overall score**, even though every other score display in the Hub (fitment score, skill breakdown) uses horizontal bars. This is a new component, deliberately chosen for PDF parity on this page only — the fitment report page's bar-based components are untouched.

## What data is actually available (live-verified 2026-07-23)

The PDF's candidate-info bar has fields we do **not** have a real source for: total years of experience, current/expected salary, expected joining date, phone, location. Confirmed by directly querying `GET /public/reports/interviews` (candidateDetails is just `{userId, email (masked), name}`) and re-reading `lib/intervuebox/reports.ts`'s `getCandidateResumeDetails` (returns skills/education/experience/certifications — no aggregate "years of experience" field, no salary, no phone/location).

Available and used:
- Candidate name — already fetched via `fitment_leads.name` (existing query in `page.tsx`)
- Current organisation — `getCandidateResumeDetails(appliedJobId).experience[0].company` (same helper + same `ib_applied_job_id` field the fitment report page already uses; requires extending the existing `fitment_leads` select to include `ib_applied_job_id`)
- Interview date — `fitment_interviews.updated_at` (already used)
- Interview duration — **approximate only**, derived from `sessionDetails.answers[last].timestamp` (e.g. `00:03:27`). Labeled "~4 min" (rounded up to nearest minute), never presented as exact, since it's a proxy (last-answer timestamp), not a true recording-length field.

Explicitly dropped, no real source: total years experience, salary, phone, location, expected joining date, interview language.

## Components

### `InterviewScoreGauge.tsx` (new)
Circular SVG ring (no new dependency), centered number (`{overallScore}/10`), band label below. Props: `{ score: number }`. Pure presentational, computes its own band/color from `score`.

Bands (0–10 scale — IntervueBox's own POOR/GOOD/etc. thresholds are undocumented and inaccessible to us, so these are Merito's own, reusing colors already established elsewhere in the Hub rather than introducing a new palette):

| Range | Label | Color |
|---|---|---|
| 7–10 | Strong | `#16803c` text / `#eefdf1` ring track (matches `ProgressRail`'s "done" state) |
| 4–6.9 | Developing | `#4b4b4d` (neutral, matches existing muted text color) |
| 0–3.9 | Needs work | `#ed1a24` (Merito primary red) |

### `ParameterScoreTile.tsx` (new)
Boxed grid tile: label + number, no bar. Replaces `InterviewSkillCard` **on this page only** — `InterviewSkillCard` and `ResumeMatchCategoryCard` (bar-style) are untouched, still used by the fitment report page. Props: `{ skill: string; score: number }`, same title-casing helper as the component it replaces.

### `page.tsx` (rewritten)
1. The existing `fitment_leads` query (currently selecting just `name`) extended to also select `ib_applied_job_id`. The `fitment_interviews` query is unchanged.
2. New: `getCandidateResumeDetails(ib_applied_job_id)` call (mirrors the fitment report page's existing pattern exactly — same error-tolerant `.catch(() => null)` wrapper, since this is a nice-to-have enhancement, not load-bearing).
3. Derive duration string from `report.answers`... — **note**: the raw `answers` array is not currently part of `InterviewReportReady` (only `overallScore`, `skillMetrics`, `overallSummary`, `strengths`, `areasOfImprovement`, `shareableReportLink` are stored). Storing an approximate duration requires either (a) extending `getInterviewReport`'s return type and the webhook's `report_raw` write to include a computed `approxDurationMinutes: number` field, or (b) computing it from the last answer at report-render time by re-fetching. **Decision: (a)** — compute once in `lib/intervuebox/interviewReports.ts` at webhook-ingestion time (cheaper, avoids a second live API call on every page view) and store the plain number in `report_raw`.
4. Layout: header (name + Merito logo, role as a red pill chip) → info bar (org · date · duration) → two-column row (Parameters Score grid | Overall Skill Score gauge) → AI overview card → two-column Strengths/Areas-to-improve → IntervueBox link.

## Data model change

`InterviewReportReady` (`lib/intervuebox/interviewReports.ts`) gains one field:
```ts
approxDurationMinutes: number | null; // ceil(last answer's timestamp / 60), null if no answers
```
`report_raw` jsonb gains the same field. No SQL migration needed (jsonb column, no schema change) — existing rows without it just render without a duration (handled as `null`, hidden in the info bar).

## Error handling / edge cases

- `getCandidateResumeDetails` failure → organisation silently omitted from the info bar (matches existing fitment-report-page tolerance for this same call).
- No `experience` entries → organisation omitted.
- `approxDurationMinutes` null (no answers, e.g. an interview ended before the first question) → duration omitted from info bar, rest of page renders normally.
- Score outside 0–10 (shouldn't happen, but defensively) → gauge clamps to the range before banding.

## Testing

- `InterviewScoreGauge`: unit test the band/color selection function for boundary values (0, 3.9, 4, 6.9, 7, 10).
- `interviewReports.ts`: extend the existing live-shape test to cover `approxDurationMinutes` derivation (including the "no answers" → `null` case).
- Webhook route test: assert `report_raw` includes `approxDurationMinutes`.
- Manual/live: re-verify against the real API once implemented (this integration's established pattern — see `feedback_verify_dont_assume` memory).
