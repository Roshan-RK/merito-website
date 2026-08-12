# Admin Drill-down Navigation (Back-link + Tabs) — Design

**Status:** Approved design, not yet planned/implemented.

## Context

Third sub-project from the 2026-08-12 admin portal audit (first two: `plans/2026-08-12-admin-shell-design-system-design.md` sub-project A, `plans/2026-08-12-admin-list-ux-design.md` sub-project B1). The candidate drill-down (`app/admin/candidates/[userId]/page.tsx`) renders the full fitment report, full interview report (skills table, roadmap, evaluator notes, transcript link), candidate profile, personality, references, and recruiter-preview section as one unbroken vertical stack — fine for one candidate, unusable for an admin scanning many per day. Neither drill-down page (candidate or counselling) has a way back to its list except the browser back button or re-navigating via the top nav.

Depends on sub-project A's shell (tabs live inside the `Table`-less content area, no new shared component needed beyond a simple `Tabs` primitive).

## Decisions

1. **Simple back-link, not a full breadcrumb trail.** Both drill-downs are 2 levels deep (`Candidates → [Name]`, `Counselling → [Email]`) — a breadcrumb component would be pure overhead at this depth. A single "← Back to Candidates" / "← Back to Counselling" link at the top of the page is enough.
2. **Candidate drill-down gets tabs; counselling drill-down does not.** Counselling's drill-down is already small (order info + a status-change form) — no restructuring needed, it just gains the back-link.
3. **Candidate drill-down tabs**: `Overview` / `Fitment Report` / `Interview Report` / `Personality & References` / `Recruiter Preview`. `Overview` is the default/landing tab and shows the profile card plus a one-line status summary per other section (e.g. "Fitment: 90% — Excellent Match", "Interview: 76% — Strong", "Personality: not taken", "References: 3 completed") rather than the full content — admin sees status at a glance, clicks into a tab only when they need the detail.
4. **No "last computed at" timestamp on the funnel overview** (was tracked as sub-project B4). Investigated: the funnel page has no caching layer — it's a live server-rendered query on every request. A timestamp would only ever show render-time, implying a staleness risk that doesn't actually exist. Closing this as "not a real gap" rather than building it.

## Architecture

```
app/admin/
  _components/
    Tabs.tsx                      # new, minimal: tab list + active-panel switch, client component (needs interactivity)
    BackLink.tsx                  # new, tiny: "← Back to {label}" link, used by both drill-downs
  candidates/[userId]/
    page.tsx                      # adds <BackLink href="/admin/candidates" label="Candidates" />, wraps existing sections in <Tabs>
    OverviewTab.tsx                # new — profile card + condensed per-section status lines
    (existing RefereeSummary.tsx, ShareLinkRevokeToggle.tsx, InterviewRecoveryActions.tsx unchanged, just relocated into their respective tab panels)
  counselling/[id]/
    page.tsx                      # adds <BackLink href="/admin/counselling" label="Counselling" />, no other structural change
```

`Tabs` state (which tab is active) is client-side only (`useState`, no URL sync) — deep-linking to a specific tab isn't a requirement here, keeps this simple. All the underlying data (fitment report, interview report, etc.) is still fetched once server-side in `getCandidateDetail()` exactly as today; tabs only change how it's *rendered*, not how it's *fetched* — zero data-layer changes, same as sub-project A's re-skin was presentation-only.

## Data flow

No changes. `getCandidateDetail()` and `getCounsellingRequest()` keep their existing signatures and return shapes. This sub-project only restructures how the already-fetched data is laid out in the DOM.

## Error handling

No new failure modes introduced — this is pure layout restructuring of data that's already successfully fetched by the time the page renders (fetch failures are handled the same way they are today, unchanged).

## Explicitly out of scope

- Audit trail (sub-project B3, separate spec).
- Any change to what data is fetched or how (`lib/adminCandidates.ts`, `lib/adminCounselling.ts` untouched).
- Backend hardening (sub-project C).
- Deep-linkable tab state (`?tab=interview`) — not needed for a same-page click-through, can be added later if sharing a direct link to a specific tab ever becomes a real need.

## Testing

`Tabs` and `BackLink` are pure layout components, no business logic to unit test. Verification is manual: browser-check the candidate drill-down (all 5 tabs render their expected content, tab switching works, back-link returns to the filtered/paginated candidates list correctly once B1 lands) and the counselling drill-down back-link, at desktop and mobile widths — same convention as sub-projects A and B1.
