# Export Reports (PDF) — Design

## Why

Original scope for the Merito HUB test pass included "all reports should be exportable" — currently zero export/download code exists anywhere in the app for the fitment report, personality report, or AI-interview report.

## Approach (confirmed with user)

**`@react-pdf/renderer`**, chosen explicitly for output quality over the two cheaper alternatives considered (browser print-to-PDF via CSS; client-side `html2canvas`+`jsPDF`). Real vector PDF, selectable/searchable text, small file size, true one-click download. Trade-off accepted: each report needs a second, PDF-specific layout built from `@react-pdf/renderer`'s own component API (`<Document>/<Page>/<View>/<Text>`, not HTML/CSS) — not a reuse of the existing React page components, so future UI changes to a report's on-screen layout must be mirrored in its PDF layout separately.

**Generation location: server-side**, via a Next.js API route per report using `renderToStream` from `@react-pdf/renderer`. Matches this app's existing pattern (every report page is already an RSC that fetches its own data server-side) and keeps the (non-trivial) `@react-pdf/renderer` bundle out of the client.

## Scope

Three export routes, one per existing report page. Same feature applied three times to three data sources — not decomposed into separate specs, since the shared PDF-primitives layer (below) is the point of doing them together.

## Shared building blocks

New `lib/pdf/` module:
- `pdfTheme.ts` — color/font constants matching the app's existing tokens (`#ed1a24` primary red, `#16803c`/`#eefdf1` green, `#4b4b4d` muted text, `#9c9c9c` label gray — same values used throughout this session's work, not a new palette).
- `PdfPage.tsx` — a `<Page>` wrapper rendering the Merito logo + a title in the shared header, consistent margins/font registration across all three PDFs.
- `PdfSectionCard.tsx` — a bordered/padded `<View>` block matching the on-screen "white card" pattern (assessment summary, AI overview, etc. all use this same visual shape today).
- `PdfScoreBar.tsx` — a horizontal bar (label + score + colored fill), the react-pdf equivalent of `ResumeMatchCategoryCard`/`InterviewSkillCard`'s bar pattern, reused across the fitment and interview PDFs.

## Per-report data flow and PDF contents

### Fitment report — `app/api/hub/report/export/route.ts`
Re-runs `report/page.tsx`'s exact chain: `getUser()` → latest `fitment_leads` row → `isReportUnlocked(user.id, role_title)` (403/redirect-equivalent if not unlocked) → `resume_match_raw` as `ResumeMatchReportReady` → `getCandidateResumeDetails(ib_applied_job_id)` (same `.catch(() => null)` tolerance as the page). PDF: header (name, role, score), assessment summary, skills chips, 6-category match breakdown (`PdfScoreBar` × 6), strengths (✓)/gaps (✗), candidate profile (education/experience/certifications) if present.

### Personality report — `app/api/hub/personality/export/route.ts`
Re-runs `personality/page.tsx`'s chain: `getUser()` → resolve `roleTitle` (query param or latest lead) → `personality_tests` row (`scores`, `validity`) for that user+role — 404-equivalent if no row exists yet (test not taken). PDF: header (candidate name via `nameFromEmail`, role), one trait-band block per `TRAITS` entry (name, %, band strip, "what it measures", "what it suggests at work" — same text derived from `lib/personality.ts`'s existing `TRAIT_MEANING`/`TRAIT_WORK_IMPLICATION`), validity-checks grid (4 cells + overall verdict banner), matching `PersonalityReport.tsx`'s existing content exactly.

### AI-interview report — `app/api/hub/interview/export/route.ts`
Re-runs `interview/page.tsx`'s chain: `getUser()` → resolve `roleTitle` → `fitment_interviews` row (`status === "ready"` required, 404-equivalent otherwise) → `report_raw` as `InterviewReportReady` → `fitment_leads` (name, `ib_applied_job_id`) → `getCandidateResumeDetails` (organisation/location/totalExperience, same tolerance). PDF: header (name, role pill, org/experience/location/date/duration info line), parameters-score grid (`PdfScoreBar` per skill metric), overall score as a static "`{score}/10 — {band label}`" readout (no animated SVG ring — react-pdf has no stroke-dasharray transition; band/color logic reuses `getScoreBand`'s already-exported pure function), AI overview, strengths (✓)/areas-to-improve (✗).

## Trigger UI

One link added to each of the 3 existing report pages, immediately visible near the top (next to "← Back to dashboard" or below the header):
```tsx
<a href="/api/hub/report/export" download className="...">Download PDF</a>
```
Plain `<a download>` — real browser download, zero client JS. Same pattern (just a different `href`) on all three pages.

## Auth and error handling

Every export route repeats its sibling page's exact ownership gate (`getUser()` + `.eq("user_id", user.id)` on every query) — never trust a role/id from a query param alone; an export route is new attack surface and must not leak another user's report by omitting this check. If the underlying data isn't ready (report not unlocked/not paid for, personality test not taken, interview not completed) the route returns 404/403 with a plain error body — never a partially-rendered or blank PDF.

## Testing

- Each export route gets a unit test: rejects unauthenticated/wrong-owner requests, and on the happy path returns `content-type: application/pdf` with a non-empty body — matches this repo's "routes are tested, presentational renderers aren't" convention already established this session (e.g. `InterviewScoreGauge`'s pure `getScoreBand` is tested, the SVG rendering itself is not).
- `lib/pdf/` primitives are not unit-tested (no such convention anywhere in this repo for visual components).
- Manual verification: download and open each of the 3 PDFs against real live data once implemented, same live-verification pattern used throughout this session.

## Out of scope

- No caching/regeneration strategy for the PDF (generated fresh on every request — reports are small, this is cheap; revisit only if it becomes a real cost/latency problem).
- No "export all three as one bundle" — three separate downloads, matching three separate report pages today.
