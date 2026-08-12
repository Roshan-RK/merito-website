# Admin Shell + Design System — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Follow-up from a full UI/UX + backend/security audit of `/admin` (2026-08-12, no separate doc — findings delivered inline in session). Admin portal was built across 8 separate slices (`plans/2026-08-05-admin-*-design.md`), each a standalone page with inline styles, zero shared components. Result: the 8 pages look/behave like 8 different products, and several concrete bugs stem directly from that (missing column gap in the payments table producing glued-together text like `AMOUNTSTATUS`; candidate table has no responsive handling and clips off-screen at mobile widths; the whole admin section renders inside the public marketing site's `Navbar`/`Footer`/Zoho chat widget since those are hardcoded into the single root `app/layout.tsx`).

This is the first of three follow-up sub-projects (deliberately decomposed, not one big spec):
- **A (this doc)** — shell + shared components + re-skin existing pages onto them, fixing the CSS-layer/consistency bugs found.
- **B** — new capabilities (search/filter/pagination, audit trail, drill-down restructure, global search, CSV export). Depends on A's components.
- **C** — backend correctness: counselling status-change TOCTOU race, interview generate/reinvite idempotency (incl. unguarded flag-write on failure, and the admin route firing with no check of remote IntervueBox candidate status first — the self-heal poller requires `TERMINATED`, this route skips that check entirely), `RAZORPAY_BYPASS` interview-start tracking, structured API error responses, swallowed-error logging (`adminCandidates.ts` IntervueBox `.catch(() => null)`), zero test coverage on `adminExtension.ts`/`adminLearnedSkills.ts`/admin share-link path/DB-query fns, missing index on `counselling_requests(status, requested_at)`, cookie `SameSite` not explicitly configured (currently relies on browser default — confirm nothing overrides it in prod deploy config), minor validation (`notes` field has no `.max()`). `listCandidates()`'s unbounded scan is resolved by sub-project B1's server-side pagination as a side effect, though the per-row N+1 IntervueBox call is only reduced (20/page instead of unbounded), not eliminated — still a C candidate if it matters at real volume. Not a UX question, doesn't need this component library.

Single admin user today (`roshan@merito.in`, `ADMIN_EMAIL` env var, no roles table) — unchanged by this work.

## Decisions

1. **Chrome removal via pathname-gated client wrapper, not route groups.** Next.js's "correct" way to give `/admin` its own root layout is route groups with separate root `<html>/<body>` per group — but that requires moving every existing marketing route (`app/about`, `app/contact`, `app/hub/**`, everything) into a `(marketing)/` group first. Blast radius disproportionate to the problem. Instead: a small client component `ChromeGate` wraps `<Navbar />`, `<Footer />`, and the Zoho chat-widget loader in `app/layout.tsx`, using `usePathname().startsWith("/admin")` to skip rendering them on admin routes. GTM script and JSON-LD stay everywhere (invisible, SEO/analytics-only, no reason to touch).
2. **Sidebar dashboard shell**, not a topbar. Chosen over cleaned-up-topbar for room to grow (more admin pages/features are expected — see sub-project B) and standard admin-tool affordance. Flat 6-item nav list (Overview/Candidates/Payments/Counselling/Extension/Learned Skills) — not grouped; 6 items doesn't need grouping yet (revisit if the nav grows past ~10 items).
3. **Components are admin-scoped** (`app/admin/_components/`), not a site-wide `components/ui/` library. Nothing here is designed for or should be reused by the public marketing site — keeping them colocated avoids implying otherwise.
4. **No new UI dependency.** Components are hand-built with the existing Poppins/Gabarito fonts and existing red/black brand palette already used throughout admin — consistent with how the rest of the site is built (no Tailwind component library, no shadcn/radix currently in the repo).
5. **Logout link added to the sidebar.** Audit found there is currently no way to sign out from anywhere in the admin UI — a real functional gap, not a style issue, but small enough to fold into the shell work rather than spin up a separate spec.
6. **This sub-project re-skins all 8 existing pages**, not just the shell + an unused component library. Building components nobody applies wouldn't fix the "8 different products" problem. Re-skinning includes fixing the concrete bugs already found (below) but explicitly does not add new features or touch backend logic.

## Architecture

```
app/
  layout.tsx                    # root — ChromeGate now wraps Navbar/Footer/chat widget
  admin/
    layout.tsx                  # requireAdmin() + <AdminSidebar> shell (sidebar becomes client component for active-link state)
    _components/
      AdminSidebar.tsx          # client, usePathname() for active state, includes logout link
      Table.tsx                 # enforced column gap/padding, built-in overflow-x:auto wrapper, empty-state slot
      Badge.tsx                 # status pill, variant: success | warning | neutral | danger
      Button.tsx                # variant: primary | secondary | danger, built-in loading/disabled state
      ConfirmDialog.tsx         # modal confirm/cancel, used before any destructive/state-changing action
      Toast.tsx                 # ToastProvider + useToast(), mounted once in admin/layout.tsx
      EmptyState.tsx            # one "no data" treatment, replaces ad hoc "No match" / blank tables
      Pagination.tsx            # built now, not wired to any list yet — sub-project B consumes it
components/
  ChromeGate.tsx                 # new, wraps Navbar/Footer/Zoho loader with the /admin pathname check
```

Every existing `app/admin/**/page.tsx` and drill-down component gets its inline-styled tables/buttons/status text replaced with the components above. No new routes, no new data-fetching — `lib/admin*.ts` function signatures are untouched.

## Concrete bugs fixed as part of the re-skin

- **`/admin/candidates` null-userId dead link** — a lead row with no linked `userId` currently renders as a link to `/admin/candidates/null`, which 404s identically to the "you're not an admin" page. Fix: `Table`/row rendering treats a missing `userId` as non-clickable plain text (or an explicit "not linked" `Badge`), never emits the link.
- **Payments table glued-text bug** (`AMOUNTSTATUS`, `deepakbansal5387@Gmail.comReport`) — structurally impossible once the page uses `Table`'s enforced column gap.
- **Mobile clipping** (390px width: candidate table columns squeezed off-screen, headers garbled) — `Table`'s `overflow-x:auto` wrapper fixes this everywhere at once, not per-page.
- **Counselling status-change `<select>` defaults to the first mutating option** ("Scheduled") instead of current status — admin who hits Save without deliberately choosing silently reschedules. Fix: default to current status (a true no-op) rather than the first `ALLOWED_TRANSITIONS` entry.
- **Silent failure on revoke/status-change** — both currently fail with an uncaught throw and zero UI feedback. Fix: wrap existing `fetch` calls with `useToast()` success/error surfacing. This only touches the calling component's error handling, not the API routes themselves (those get hardened separately in sub-project C).
- **No active-nav-state, no visual distinction between the 8 pages' table/badge/button styling** — fixed by construction once everything routes through the shared components.

## Other gaps spotted, deferred to sub-project B

No global search, no CSV/export, no "last computed at" timestamp on the funnel overview, no breadcrumb/back-to-list link on drill-down pages, no audit trail (who/when/prior-value) on any mutation, no filter on the extension-usage list to hide the ~30 low-signal "No match" rows.

## Error handling

- `Toast` surfaces both success and failure for every mutating action re-skinned in this pass (revoke, status-change). Failure messages are generic ("Something went wrong — try again") since the underlying API routes don't yet return structured error bodies (that's sub-project C) — good enough to stop the "did it even work?" confusion without overpromising on precision.
- `ConfirmDialog` is required before any destructive/state-changing action fires its request — no more single-click-fires-it.
- Everything else (auth failures, missing env vars, query errors) is unchanged from today's behavior — out of scope for a presentation-layer pass.

## Explicitly out of scope

- Search, filter, sort, pagination wiring, audit trail, drill-down tab restructure, CSV export (sub-project B).
- Counselling TOCTOU race fix, interview generate/reinvite idempotency, `RAZORPAY_BYPASS` interview tracking, structured API error responses (sub-project C).
- Multi-admin/roles, any change to `requireAdmin()` or auth model.
- Any new data-fetching, new Supabase queries, or schema changes.

## Testing

No component-test precedent exists in this repo — every existing test is a `vitest` unit test against pure functions in `lib/*.ts` (confirmed: no React Testing Library / component test setup found anywhere). Not introducing one out of scope for a shell/re-skin pass. Verification is manual: browser-check all 7 admin pages + the candidate and counselling drill-downs, at desktop (1440) and mobile (390) widths, logged in as `roshan@merito.in` — same checklist already run for the audit — before calling this done.
