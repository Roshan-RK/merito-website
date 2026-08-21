# Multi-Role Switcher — Design & Impact Map

**Status:** decisions locked (see [[multi_role_switcher_design_decisions]] memory, confirmed 2026-08-17). This doc closes the "design doc still unwritten" gap and adds the full cross-surface impact map requested 2026-08-21.

**Goal:** let a candidate who has checked fitment against multiple JDs (multiple `fitment_leads` rows) switch between them in the Hub UI and see each role's own score/report/interview, while personality and references stay one-per-candidate.

## Locked decisions (unchanged from prior brainstorm)

1. **Identity key: `lead_id` (fitment_leads.id), not `role_title` text.** `role_title` is free AI-extracted text — two JDs can produce identical text and collide under text-matching.
2. **Personality + references are candidate-level**, not per-role — taken once, reused across all JDs. References (`reference_checks`) already has no `role_title` column — nothing to change there. Personality (`personality_tests`, PK `(user_id, role_title)`) needs a PK migration to `user_id` alone, with existing duplicate rows deduped (keep newest `completed_at` — user already approved losing older duplicate answers).
3. **Report + interview stay per-role** — re-pay, re-interview each new JD. `report_unlocks` is already correctly keyed `(user_id, role_title)` and needs no change. `fitment_interviews` is role_title-keyed today and needs a `lead_id` FK (it's the one per-role entity still missing it).
4. **Recruiter preview: per-role visibility.** Master `recruiter_preview_settings.enabled` stays as a global kill switch. A new per-role table carries which roles are visible and which sections show per role.

## Why this is bigger than it looks

Verified 2026-08-21 against current code: **41 files under `app/`** and **20 files under `lib/`** read or write `role_title` as a matching key. The Hub UI already has 7+ pages independently doing `fitment_leads.order(created_at desc).limit(1)` to pick "the" lead. `TopBar.tsx:163-166` and `ApplicationsCard.tsx:10-14` already contain comments acknowledging the switcher doesn't exist yet and describing exactly this `?lead=` gap.

## Cross-surface impact map

### Billing (report_unlocks, product_unlocks, razorpay_transactions)
- `report_unlocks` — already `(user_id, role_title)`, already correct per-role pattern. **No change required.**
- `product_unlocks` (personality, references) — already `(user_id, product)`, global. **No change required**, matches decision #2.
- `razorpay_transactions` — interview credit consumption is FIFO on unconsumed order id, not role-keyed. **No change required.**
- Conclusion: billing was already built for the "per-role report/interview, global personality/references" model. The switcher doesn't touch payment logic at all.

### AI Plan / fitment-check (creates a lead + IntervueBox job)
- Every fitment-check submission already creates its own `fitment_leads` row with its own `ib_job_id`/`ib_applied_job_id`. Multi-role is **already supported** at this layer — nothing to build here.

### AI Interview (fitment_interviews + IntervueBox)
- **Vendor constraint (confirmed 2026-07-28 by IntervueBox, documented in `app/api/hub/start-ai-interview/route.ts:50-63`): one IntervueBox job = one interview, permanently. No retake on the same job, no re-invite to a reused agent.**
- This is *not* a blocker for multi-role: each lead/role already has its own `ib_job_id`, so switching roles naturally gets its own interview. The constraint only blocks *retaking the same role* — which is the existing, intended behavior ("Each role can only be interviewed once").
- The actual risk is the role_title-text matching used to find "the" interview for a role (`start-ai-interview/route.ts` lines 36-42, 64-71, 110-117; `recruiter-preview/lookup/route.ts` lines 105-116). Two leads with identical `role_title` text for the same user collide today. `lead_id` FK removes this.

### Report (combinedReportData.ts, export routes)
- All exports (report / interview / personality / references / combined / share-summary) resolve off `leads[0]` (latest), same as the dashboard. No behavior change until the `?lead=` param is threaded through (later phase).

### Admin view (lib/adminCandidates.ts, admin interview routes)
- Funnel-stage computation is already `user_id`-level (candidate's furthest stage across *all* roles) — **not broken** by multi-role, stays correct as-is.
- `latestRoleTitle` field is actually the *earliest* lead's role_title today (the `byUser` map only sets it on first-seen row) — a pre-existing display bug, not caused by this project. Worth a one-line fix but out of scope here.
- Admin interview reinvite/generate routes (`app/api/admin/interviews/[id]/reinvite`, `.../generate`) are role_title-keyed the same way as the candidate-facing route — same collision risk, same fix (lead_id cutover).

### Recruiter view (recruiter_preview_settings, lookup route, extension)
- Biggest structural change. Today: one global `sections text[]` per candidate; `lookup/route.ts` hardcodes `leads[0]`. Locked design: split into a per-role table `(user_id, lead_id, visible, sections)`, master `enabled`/`linkedin_url` row stays as the kill switch above it.
- Extension UI (separate roadmap, see [[recruiter_extension_roadmap_status]]) will need role-tab rendering once the lookup response carries multiple roles.

## Edge cases to carry into later phases (tracked here so nothing gets lost)

- **Duplicate `role_title` text for the same user** — today's silent collision risk in personality/interview/recruiter-lookup matching. Any backfill migration must pick most-recent match and this must be documented; full fix is the lead_id cutover.
- **Single-lead candidates** — switcher UI must degrade to no-chrome (matches current TopBar single-role display), not show an empty/broken switcher.
- **Candidate deletion / purge** (`0043_candidate_deletions.sql`, `0044_purge_candidate_data.sql`) — any new `lead_id` FK must not block a purge; verify FK delete behavior against these migrations before the interview cutover ships.
- **Recruiter kill switch** — `recruiter_preview_settings.enabled = false` must still fully disable preview after the per-role split, not just hide the per-role rows.
- **IntervueBox one-job-per-role** — already the intended model (see above), not a new restriction introduced by the switcher.

## Phase roadmap

This is deliberately split into independently-shippable phases — the `report_unlocks` incident (see [[prod_deploy_broken_untracked_dependency]] and the lead_id lesson in [[multi_role_switcher_design_decisions]]) showed that shipping schema ahead of every write-path code change breaks prod. Each phase below ships schema + all its code together, and phase N+1 never depends on unshipped work from phase N being "close enough."

| Phase | Scope | Risk | Doc |
|---|---|---|---|
| 1 | Foundation: centralized active-lead resolver + additive `lead_id` column + backfill + dual-write on `fitment_interviews`. Zero visible behavior change. | Low — additive only | `plans/2026-08-21-multi-role-switcher-phase1-plan.md` |
| 2 | Personality dedup: PK `(user_id, role_title)` → `user_id`. Independent of interview work. | Low-medium — data loss on old duplicates (pre-approved) | not yet written |
| 3 | Interview cutover: switch all role_title-keyed interview lookups (candidate + admin + recruiter-lookup) to `lead_id`. Drop `role_title` reliance. | Medium — touches payment-adjacent code (start-ai-interview) | not yet written |
| 4 | Recruiter preview split: per-role visibility table, lookup route rewrite, extension UI role tabs. | Medium — external consumer (extension) | not yet written |
| 5 | UI wiring: real `?lead=` param through all 7 Hub pages, TopBar/ApplicationsCard switcher goes live. | Low by this point — backend already supports it | not yet written |

Phase 1 is the only phase specified in full detail right now, per the plan-writing skill's scope-check rule (multi-subsystem spec → break into sub-plans). Phases 2-5 get their own plan doc written immediately before execution, using whatever is still true in the codebase at that time.
