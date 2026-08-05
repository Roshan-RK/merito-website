# Admin Portal — Roadmap / Slice Decomposition

**Status:** Decomposition agreed, slice 1 design in progress.

## Context

No admin/oversight surface exists today — only candidate-facing Supabase auth (`app/hub/login`). PO has no way to see signups, test/assessment progress, or drop-off without querying Supabase directly. Full portal is too large for one spec — decomposed into independent sub-projects, each gets its own design + plan cycle (see `plans/2026-08-01-recruiter-extension-design.md` for the doc-pair convention this repo already uses).

## Slices

1. **Admin foundation** — auth/access control (none exists today). Blocks every other slice.
2. **Funnel overview** — signup → fitment test → interview → personality → references counts, drop-off, time-series.
3. **Candidate directory + drill-down** — list all candidates; per-candidate view of fitment report, personality result, interview transcript/score, reference-check status.
4. **Payments/unlocks oversight** — `report_unlocks`, `product_unlocks`, Razorpay transaction status, refunds.
5. **Counselling ops queue** — `counselling_requests` (requested → scheduled → completed). Actionable, not passive — someone needs to work this queue.
6. **Recruiter-preview oversight** — per-candidate `recruiter_preview_settings` visibility, `report_share_links` created/revoked/viewed.
7. **Extension usage** — install/active counts, lookups performed. No backend telemetry exists yet for this — would need building from scratch.
8. **IntervueBox/job data** — jobs, applicants, resumes, interview reports, learned skills. External integration, separate system; likely read-only surfacing.
9. **Multi-role/lead-level handling** — candidates can have multiple `fitment_leads` (JDs). Cross-cutting — affects how slices 3/6 render, ties to unfinished multi-role-switcher work (see memory `multi_role_switcher_design_decisions`).
10. **Raw signup count** — true zero-activity signups (account created, never touched a JD) aren't visible from table counts alone; needs `supabase.auth.admin.listUsers()` (paginated admin API, no direct total-count field). Deferred out of slice 2's funnel MVP, tracked here for later.

## Cross-cutting technical dependency (not a slice)

Every table above has RLS scoped to `auth.uid() = user_id` (confirmed across 11 migrations). Admin queries need service-role key bypass — server-side only, must never reach the client bundle. Designed as part of slice 1, not separately.

## Recommended order

1 → 2 → 3 → (4, 5, 6 in any order) → 7 → 8. Slice 9 threaded in wherever 3/6 touch multi-lead candidates.

## Priority

Slice 1 is most important — nothing else renders without it. Slices 1+2 together are the direct answer to the original ask ("no admin view to oversee signups/tests/assessments").
