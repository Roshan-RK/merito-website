# Recruiter-Preview Oversight (Slice 6) — Design

**Status:** Approved design, not yet implemented.

## Context

Slice 6 of `plans/2026-08-05-admin-portal-roadmap.md`. PO has no visibility into which candidates have recruiter preview enabled, what's shared, or share-link activity. Roadmap asks for `recruiter_preview_settings` visibility and `report_share_links` created/revoked/viewed — but "viewed" doesn't exist anywhere in the codebase today (checked `lib/reportShareTokens.ts` and `app/hub/share/[token]/page.tsx`: `validateShareToken` only checks not-revoked, never records a hit).

## Decisions

1. **Add view tracking.** `report_share_links` gets `view_count`, `last_viewed_at`. Incremented on successful (found + not revoked) token validation from the public share page — closes the gap the roadmap names rather than reporting a metric that doesn't exist.
2. **Fold into candidate drill-down, not a standalone page.** Unlike slices 4/5, this is added as a new section on `/admin/candidates/[userId]` — recruiter preview is inherently a per-candidate concern (their consent settings + their share links), and the existing drill-down page already aggregates all other per-candidate state (fitment, interview, personality, references).
3. **Admin can revoke a share link.** Unlike slice 4's read-only payments (refunds handled externally on Razorpay), this is entirely in-app state — revoking is a plain DB write with no external system to reconcile against, so there's no reason to force ops through the candidate's own settings page for a support request.
4. **Read-only for settings themselves.** Admin sees `enabled`/`sections`/`linkedin_url` but can't edit them — those are the candidate's own consent choices (recruiter_preview_settings owner_id = candidate), editing them on their behalf isn't an admin operation this slice needs.

## Architecture

```
supabase/migrations/
  0026_report_share_links_view_tracking.sql   # view_count, last_viewed_at

lib/
  reportShareTokens.ts
    + recordShareLinkView(token)               # increments view_count, sets last_viewed_at
    + setShareLinkRevokedByToken(token, revoked)  # token-keyed variant of existing setShareLinkRevoked

  adminCandidates.ts
    CandidateDetail.recruiterPreview: {
      settings: { enabled, sections, linkedinUrl, updatedAt } | null
      shareLinks: { roleTitle, token, revoked, viewCount, lastViewedAt, createdAt }[]
    }

app/
  hub/share/[token]/page.tsx        # calls recordShareLinkView(token) after successful validation
  api/
    admin/
      share-links/
        [token]/route.ts             # PATCH { revoked: boolean } — requireAdmin() gated
  admin/
    candidates/
      [userId]/
        page.tsx                     # new "Recruiter Preview" section
        RecruiterPreviewAdminSection.tsx  # settings summary + share-links table
        ShareLinkRevokeToggle.tsx     # client component, per-row revoke/restore button
```

## Data flow

**`getCandidateDetail(userId)`** — two additional queries alongside existing lead/personality/reference fetches: `recruiter_preview_settings` (maybeSingle, by `user_id`) and `report_share_links` (all rows, by `user_id`, ordered by `created_at desc`).

**View recording** — `app/hub/share/[token]/page.tsx` already calls `validateShareToken(token)`; on a `valid: true` result, also call `recordShareLinkView(token)` (fire-and-forget is not appropriate here — await it, but don't block rendering on failure: log and continue, a missed view-count isn't worth a broken report page).

**PATCH `/api/admin/share-links/[token]`** — `requireAdmin()`, body `{ revoked: boolean }`, calls `setShareLinkRevokedByToken`. No transition graph needed (unlike slice 5) — it's a plain boolean flip, both directions always valid.

## Error handling

- Candidate with no `recruiter_preview_settings` row → "Not configured." (never opened the recruiter-preview page).
- No share links → "No share links created yet."
- View-count increment failure → logged, share page still renders (never block a recruiter's access to a report over a metrics write failing).

## Explicitly out of scope

- Editing `enabled`/`sections`/`linkedin_url` on the candidate's behalf (Decision 4).
- Standalone cross-candidate list page (Decision 2) — if ops later wants a "recent recruiter-preview activity" feed across all candidates, that's a different slice.
- Deduping views (e.g. same recruiter reloading counts multiple times) — a raw hit counter is enough signal for v1.

## Testing

- No new pure-function TDD candidate: `recordShareLinkView` and `setShareLinkRevokedByToken` are thin Supabase update wrappers, same category as the existing untested `setShareLinkRevoked` — matches repo convention of only unit-testing branching decision logic (`nextCounsellingState`, `computeFunnelStage`, `findUnpaidUnlocks`).
- Page: manual verification against real data, matching slices 2-5 convention.
