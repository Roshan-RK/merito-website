# Combined "One-Pager" PDF Export — Design

## Why

Beyond the 3 already-shipped per-report PDF exports (fitment, personality, AI-interview), the user wants a single combined PDF where they pick which completed reports to bundle.

## UI decision (via ecc:frontend-design-direction)

**Modal on the dashboard**, not a new page. The Hub already has an established modal pattern — `ReportPaywallModal` and `InterviewStartModal`, both managed by `DashboardClient.tsx`'s `modal` state (`useState<"none" | "report" | "interview">`). A new dedicated route would introduce a second UI pattern for the same kind of action; the modal matches existing convention and sits next to `ProgressRail`, which already surfaces per-report completion status.

## Architecture

- `DashboardClient.tsx`'s `modal` union type gains `"export"`. A new button (near `ProgressRail`) sets `modal = "export"`.
- New `app/hub/account/CombinedExportModal.tsx` — same shape as `InterviewStartModal.tsx` (props in, `onClose`, no `onStarted`-equivalent needed since this doesn't mutate any status). Receives `reportUnlocked`, `interviewStatus`, `personalityStatus` — the exact same three flags `DashboardClient` already holds in state for `ProgressRail` — no new data-fetching required.
- Modal renders 3 checkboxes:
  - Fitment report — enabled only if `reportUnlocked === true`
  - Personality report — enabled only if `personalityStatus` indicates completed (check its exact type/values in `ProgressRail.tsx` before implementing — likely a `"done"`/`"not_started"` style union, mirror it exactly, don't invent a new shape)
  - AI-interview report — enabled only if `interviewStatus === "ready"`
- "Generate combined PDF" button, disabled until at least one checkbox is checked, becomes `<a href="/api/hub/export/combined?include=<comma-separated checked types>&role=<roleTitle>" download>`.

## Backend refactor (no behavior change to the 3 shipped exports)

Each of `FitmentReportPdf.tsx`, `PersonalityReportPdf.tsx`, `InterviewReportPdf.tsx` currently renders `<Document><PdfPage title="...">...content...</PdfPage></Document>` as one component. Split each into:
- `<Name>PdfContent` — everything currently inside `<PdfPage>` (unchanged JSX), newly exported.
- `<Name>ReportPdf` (existing default export, used by the 3 existing single-report routes) — becomes a thin wrapper: `<Document><PdfPage title="...">.<Name>PdfContent {...props} /></PdfPage></Document>`. Byte-for-byte same output as today — this is a pure extraction, the 3 existing routes and their tests are untouched.

## New combined route — `app/api/hub/export/combined/route.tsx`

- Same auth gate as the 3 existing routes.
- Parses `include` (comma-separated: `fitment`, `personality`, `interview`) and `role` query params.
- For each requested type, re-runs that report's exact existing data-fetch chain (same queries as its own route file) — if the data isn't actually ready (race/stale checkbox), that type is silently dropped from the output rather than erroring the whole request.
- If zero types end up with data, 404 (same shape as the 3 existing routes: `{error: "..."}`).
- Renders one `<Document>` containing one `<PdfPage>` per successfully-fetched type (each wrapping that type's `<Name>PdfContent>`), via `renderToBuffer`, returned as `application/pdf` with `Content-Disposition: attachment; filename="merito-report.pdf"` — same `Uint8Array(buffer)` conversion the 3 existing routes already use.

## Testing

- Same convention as the 3 existing route tests: auth/404 cases, happy path returns `content-type: application/pdf`.
- New case specific to this route: request `include=fitment,interview` where `interview` isn't actually ready server-side → still 200, PDF generated with only the fitment section (proves the "silently omit" behavior, not just documents it).
- The 3 extracted `<Name>PdfContent` components and the thin wrapper split: no new tests (matches existing convention — presentational components untested); the 3 existing route tests must still pass unmodified, proving the extraction didn't change output.

## Out of scope

- No re-ordering/customizing section order within the combined PDF — always fitment → personality → interview when multiple are selected, matching the Hub's own step order (`ProgressRail`'s existing step sequence).
- No "select all" convenience checkbox — three checkboxes is small enough that it isn't needed (YAGNI).
