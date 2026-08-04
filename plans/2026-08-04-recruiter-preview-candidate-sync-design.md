# Candidate-facing recruiter-preview parity — design

## Problem

`app/hub/account/recruiter-preview/RecruiterPreviewClient.tsx` has a "Live preview"
section claiming "This is exactly what a recruiter would see." It's false: it renders
native Hub report components (roadmap timeline, criteria-match table, skill-report
table) that the actual recruiter-facing API
(`app/api/public/recruiter-preview/lookup/route.ts`) deliberately strips out. The
two surfaces were built independently and have drifted.

Separately, the extension's card UI (`extension/src/overlay/Overlay.tsx`) has been
iterated on heavily this session (alignment fixes, animation, referee-quote redesign)
and will keep changing. A hand-copied re-implementation in the Hub app would drift
again within days.

## Goal

Candidate dashboard shows the literal same card component the recruiter's Chrome
extension renders, fed by the literal same trimming logic the recruiter API uses —
by construction, not by manual sync.

## Architecture

- Extract the presentational guts of `Overlay.tsx` (hero fitment box, tab rail, all
  four `DetailSection`s) into `shared/recruiter-preview/RecruiterPreviewCard.tsx`.
  Props: `data: LookupResponse`, `activeSection`, `onSelectSection`, `logoUrl: string`.
  No `position: fixed`, no `chrome.*` calls — purely presentational.
- `shared/recruiter-preview/types.ts` becomes the one definition of `LookupResponse`.
  `extension/src/overlay/types.ts` is removed; extension imports from `shared/`.
- `extension/src/overlay/Overlay.tsx` shrinks to the `Badge` + expand/collapse state
  + fixed-position wrapper, rendering `<RecruiterPreviewCard logoUrl={chrome.runtime.getURL(...)} .../>`
  internally when expanded.
- New Hub client component renders the same `RecruiterPreviewCard` inside a normal
  static container, always expanded, `logoUrl="/logo.png"` (or existing Hub asset).
- No workspace/monorepo tooling needed — `shared/` is plain TypeScript source;
  both Vite (extension) and Next.js (webpack) compile it directly via relative or
  aliased imports.

## Data flow

- `lib/recruiterPreview.ts` (new): pure functions extracted from the inline logic
  currently in `route.ts` —
  - `buildLookupFitment(fullFitment, roleTitle)`
  - `buildLookupPersonality(scores, candidateName)` (includes the trait-summary
    paragraph logic added earlier this session)
  - `buildLookupInterview(fullInterview, updatedAt)`
- `app/api/public/recruiter-preview/lookup/route.ts` calls these instead of
  building the trimmed shape inline.
- `app/hub/account/recruiter-preview/page.tsx` (server component, already fetches
  the candidate's own full fitment/personality/interview/references) calls the
  same functions to build a `LookupResponse`-shaped object, passed to the client
  component. Also adds `candidate_level` to its `fitment_leads` select (route.ts
  already selects it; page.tsx currently doesn't).
- The client component filters the already-fetched trimmed data by the in-memory
  `sections` Set as checkboxes toggle — same instant, no-network-round-trip
  behavior the current "Live preview" already has.
- This **replaces** (not supplements) the existing "Live preview" block
  (`RecruiterPreviewClient.tsx` lines ~201–317). Candidates keep full access to
  their own untrimmed reports elsewhere in the Hub (personality page, interview
  page, etc.) — only this specific "what recruiters see" preview changes.

## Testing

- `lib/recruiterPreview.ts` functions get direct unit tests (adapted from the
  existing `route.test.ts` assertions: no `rank`/`strongPoints`/`weakPoints` on
  fitment, no `criteriaEvaluationTable`/`roadmap`/`videoReport`/`integrityCheck`
  on interview, personality trait+summary shape).
- `route.test.ts` becomes a thin integration check that `route.ts` wires the
  shared functions correctly, not a re-test of the trimming rules themselves.
- `RecruiterPreviewCard` has no meaningful automated visual test; verification is
  manual — load the Hub preview page and the extension against the same test
  candidate side by side, confirm match.
- No DB schema changes. No change to the save/toggle flow
  (`PUT /api/hub/recruiter-preview`).

## Out of scope

- Any change to the consent/toggle UI itself (checkboxes, save button, LinkedIn
  URL field) — untouched.
- Any change to what data is collected or how `recruiter_preview_settings` works.
