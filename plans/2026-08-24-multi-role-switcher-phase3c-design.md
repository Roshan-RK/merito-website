# Phase 3c: Real Switcher UI — Design Spec

**Goal:** Enable candidates to switch between their multiple applications (fitment checks) on the dashboard, with all role-specific data updating per lead while candidate-wide data (references, requests) stay constant.

**Architecture:** ApplicationsCard rows become clickable links with `?lead={leadId}` URL param. Dashboard and ~13 role-specific pages read this param to fetch and display the correct lead's data.

---

## Data Model

**Per-application (per-lead) data — changes on switch:**
- Fitment report (score, feedback, analysis based on role's JD)
- AI interview (interview taken for that specific role)
- Interview report (feedback, evaluation)
- All role-specific analysis pages (report, share-summary, expert, etc.)

**Cross-application (candidate-wide) data — stays same:**
- Reference checks (candidate's references, not role-specific)
- Requests & messages (generic candidate communication)
- Personality profile (candidate trait, not role-specific)
- Pricing/credits (candidate account-level)

---

## URL & Routing

**Pattern:** `?lead={uuid}` query parameter identifies which application to display.

**Behavior:**
- If `?lead=` present and valid → show that lead's data
- If `?lead=` absent or invalid → show latest lead (`leads[0]`)
- No 404 errors; graceful fallback to latest

**Backward compatibility:** Existing links without `?lead=` param continue to work (fall back to latest).

---

## Component Changes

### ApplicationsCard (app/hub/account/ApplicationsCard.tsx)

**Current:** Display-only `<div>` rows with "current" badge.

**Change to:** Each row becomes a `<Link href="?lead={app.id}">` that navigates to the same page with the new param.

```
<Link href={`?lead=${app.id}`}>
  <div className={isCurrent ? "bg-[#ed1a24]/[0.06]" : ""}>
    {/* role, company, score, "Current" badge */}
  </div>
</Link>
```

The "current" badge logic stays the same: highlight the row matching the active `?lead=` param (or `leads[0]` if no param).

### Dashboard Page (app/hub/account/page.tsx)

**Query logic change:**
```typescript
const leadIdParam = searchParams.get('lead');
const lead = leadIdParam 
  ? leads.find(l => l.id === leadIdParam) || leads[0]
  : leads[0];
```

Pass `leadId={lead.id}` to DashboardClient (already does this).

### TopBar (app/hub/account/TopBar.tsx or app/hub/account/layout.tsx)

**Current:** Layout queries latest lead to show role label in TopBar. Layout doesn't receive `searchParams` by default.

**Change:** Make TopBar a client component with `useSearchParams()`.
```typescript
'use client';
import { useSearchParams } from 'next/navigation';

export default function TopBar() {
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get('lead');
  
  // Fetch or receive lead data, show its role_title in TopBar
  // Falls back to latest if no param
}
```

Or: keep layout as server component, pass current `lead` as prop from page to layout.

### ~13 Role-Specific Pages

Pages that display role-specific data: interview, report, share-summary, recruiter-preview, expert, pricing, references (print versions included).

**Change pattern (same for all):**
```typescript
const leadIdParam = searchParams.get('lead');
const lead = leadIdParam
  ? leads.find(l => l.id === leadIdParam) || leads[0]
  : leads[0];

// Use `lead` for role-specific queries (interview, fitment report, etc.)
// Use candidate data (references, requests) from candidate record, not lead
```

### resolveActiveLead Utility (lib/activeLead.ts)

**Current:** Returns lead matching (lead_id or role_title) for DB queries.

**Extend:** Accept optional `leadIdOverride` param from URL.
```typescript
export function resolveActiveLead(
  leads: Lead[],
  leadIdOverride?: string // from ?lead= param
) {
  if (leadIdOverride) {
    const match = leads.find(l => l.id === leadIdOverride);
    if (match) return match;
  }
  return leads[0]; // fallback to latest
}
```

---

## "View All Applications" & "Add New Application"

**View all applications:** Leave as-is. This page lists all roles; doesn't need `?lead=` param since it's just a list view. Clicking an entry can navigate to dashboard with `?lead=`.

**Add new application:** Out of scope. Triggers existing fitment flow (which creates new leads). Once created, new lead appears in ApplicationsCard switcher automatically.

---

## Mobile & Responsive

ApplicationsCard mockup already responsive. No changes needed; switcher works on all screen sizes.

---

## Error Handling & Edge Cases

- **Invalid leadId:** Silently fall back to latest. No errors shown to user.
- **Deleted lead:** If a lead is deleted after user bookmarks its URL, fall back to latest. Can add a toast notification: "Application no longer available, showing latest."
- **No leads:** Defensive check: if `leads.length === 0`, show empty state (not in scope for Phase 3c, but note it).
- **Concurrent lead creation:** New lead appears in ApplicationsCard immediately (no cache issue). Switcher just shows whatever leads exist.

---

## Testing Strategy

1. **Unit:** ApplicationsCard renders rows as clickable links with correct href.
2. **Integration:** Click row → URL updates to `?lead={id}` → page re-renders with correct lead's data.
3. **Regression:** Existing links without `?lead=` param still work (fallback to latest).
4. **E2E:** Candidate switches between 3+ applications, sees correct interview/report/fitment data per role, references stay same.

---

## Implementation Order

1. ApplicationsCard: rows → links
2. Dashboard page: read `?lead=` param, pass to DashboardClient
3. TopBar/layout: become lead-aware (client component or prop-based)
4. resolveActiveLead utility: extend with leadIdOverride
5. 13 role-specific pages: adopt same query pattern
6. Tests: verify switcher works end-to-end

---

## Success Criteria

- ✅ Clicking ApplicationsCard row navigates to dashboard with `?lead={id}`
- ✅ Dashboard shows correct role's interview, fitment, reports
- ✅ All ~13 pages show correct role-specific data
- ✅ References, requests stay same across all roles
- ✅ TopBar role label updates when switching
- ✅ Backward compatible (existing links without `?lead=` still work)
- ✅ No errors on invalid `?lead=` (graceful fallback)
- ✅ Tests pass; no regressions
