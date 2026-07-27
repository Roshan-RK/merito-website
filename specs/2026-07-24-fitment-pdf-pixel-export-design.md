# Fitment PDF Export — Pixel-Perfect via Headless Browser

**Goal:** Make the downloaded fitment-report PDF (`/api/hub/report/export`) look exactly like the live `/hub/account/report` page, replacing the current hand-translated `@react-pdf/renderer` recreation with a headless-browser screenshot/print of the actual page.

**Scope:** Standalone fitment PDF route only, in this file's original draft. **Decided 2026-07-24 (pending next session):** user wants this extended to all four report types (fitment, personality, references, AI interview) as pixel-perfect standalone downloads via the same headless-browser-per-page pattern, AND wants the combined "single pager" bundle to also become pixel-perfect — merging the four browser-rendered PDFs via `pdf-lib` instead of the current hand-built `@react-pdf/renderer` recreation. Not yet built — full brainstorm/spec/plan/build cycle needed next session (this session stopped here on cost grounds, ~$82 spent). Starting points for that session: this file's headless-browser architecture (Components 1-3 below) generalizes directly to the other three report pages; the reference-check live page URL needs confirming (likely `/hub/account/references`); `pdf-lib` merge step is new, not designed yet.

## Why headless browser, not a better react-pdf recreation

react-pdf/renderer requires manually re-implementing every visual detail (the circular SVG gauge, exact spacing, colors) in a parallel styling system — always a step behind the real page and prone to drift. A headless browser renders the actual page with its actual CSS, so it's 1:1 by construction and stays in sync automatically as the page evolves.

## Architecture

```
GET /api/hub/report/export
  → verify Supabase session (existing check, fail fast, no browser launch if unauthenticated)
  → target URL = new URL(request.url).origin + "/hub/account/report"
    (same-origin as the incoming request — works unmodified on localhost, ngrok, and prod;
     avoids cross-domain cookie mismatches that NEXT_PUBLIC_SITE_URL would risk)
  → forward the request's own Supabase auth cookies (from cookies().getAll()) into the headless browser
  → headless Chromium navigates to that URL as the authenticated user, waits for network-idle
  → page.pdf({ format: "A4", printBackground: true })
  → return buffer with existing Content-Type/Content-Disposition headers
```

## Components

1. **`lib/pdf/renderPageToPdf.ts`** (new) — `renderPageToPdf(url: string, cookies: {name, value, domain}[]): Promise<Buffer>`.
   Launches Chromium, sets cookies, navigates with `waitUntil: "networkidle0"`, prints to PDF, closes the browser in a `finally` block (always closed, even on error).

   **Dev vs. prod Chromium binary:** `@sparticuz/chromium` only ships a Linux binary built for Vercel/Lambda — it cannot launch on this Windows dev machine (or any non-Linux dev machine). Branch on environment:
   - Prod (`process.env.VERCEL_ENV` set): `puppeteer-core` + `@sparticuz/chromium`'s `executablePath()`.
   - Dev (not on Vercel): full `puppeteer` package (bundles its own Chromium per-OS), launched directly via `puppeteer.launch()`.
   `puppeteer` goes in `devDependencies` (dev-branch only, keeps it out of the deployed function); `puppeteer-core` + `@sparticuz/chromium` go in `dependencies`.

2. **`app/hub/account/report/page.tsx`** (edit) — wrap the "Back to dashboard" / "Download PDF" link row in `className="print:hidden"`. Puppeteer's `page.pdf()` renders in print media by default, so this hides the nav chrome from the PDF output with no query-param/branching needed.

3. **`app/api/hub/report/export/route.tsx`** (rewrite) — same auth check as today; drops its own data-fetching/`FitmentReportPdf` rendering in favor of calling `renderPageToPdf` against the live page. Adds `export const maxDuration = 30` (headless launch + page load + print exceeds Vercel's 10s default).

4. **`FitmentReportPdf.tsx` / react-pdf path** — untouched, stays as the combined-bundle route's implementation.

5. **`package.json`** — add `puppeteer-core`, `@sparticuz/chromium` (dependencies), and `puppeteer` (devDependency, dev-only branch above). All three are already on Next.js's built-in `serverExternalPackages` auto-list (confirmed via `node_modules/next/dist/docs/.../serverExternalPackages.md`), so no `next.config.ts` change is needed.

## Error handling

- Missing/invalid session → existing 401 JSON response, before any browser launch (cheap fail).
- Navigation or print failure → 500 JSON error, matching the existing error-response shape used elsewhere in these export routes.
- Browser is always closed via `try/finally`, even on failure, to avoid leaking headless Chromium processes.

## Testing

- No unit test for `renderPageToPdf` — it's a thin I/O wrapper around Puppeteer; the repo's existing convention doesn't unit-test thin wrappers or presentational code (matches `FitmentReportPdf`/`CandidateProfile`, which also have none).
- Verification is manual: hit the Download PDF link on `/hub/account/report`, open the resulting file, compare visually against the live page.

## Open risk (not blocking, noted for later)

Cold-start latency: headless Chromium adds a few seconds versus the current react-pdf path. Acceptable for a user-initiated one-off download; would need revisiting if this pattern were reused for a high-frequency/bulk export path.
