# AI interview difficulty + duration — design

**Why:** IntervueBox's own interview-difficulty classification doesn't match
Merito's. IntervueBox (verbally, to the founder) said Merito needs to pass its
own complexity classification at invite time. Separately, mock interviews
should run 30 min for entry/mid candidates and 45 min for senior — a knob
IntervueBox's public API already exposes today (not "in development" as
originally believed on the Merito side; see Open Items).

## Decisions

- **Seniority source: `candidate_level` on `fitment_leads`**, reusing the
  field already designed (not yet built) in
  `specs/2026-07-23-hub-payu-integration-design.md` for PayU pricing. One
  value per lead/submission, `'entry' | 'mid' | 'senior'`, self-selected by
  the candidate on the fitment-check form. This spec builds the column and
  the form field; PayU's own consumption of the field is unaffected and
  still tracked in its own spec/plan.
- **Duration is live today, not blocked.** Confirmed via IntervueBox's public
  docs (`POST /public/jobs/:jobId/interview`, `manavrittisolutionspvtltd.mintlify.app/api/public/jobs`):
  `maxInterviewMinutes` is a required field, allowed values `15 | 30 | 45`.
  Currently hardcoded to `30` in `lib/intervuebox/agents.ts`. Mapping:
  `entry` → 30, `mid` → 30, `senior` → 45.
- **RESOLVED 2026-08-20:** vendor-confirmed `complexity` enum is
  `easy | medium | hard`, sent on the same `POST /public/jobs/:jobId/interview`
  call as `maxInterviewMinutes`. Mapped 1:1 to `candidate_level` — `entry` →
  `easy`, `mid` → `medium`, `senior` → `hard` — via `complexityForLevel` in
  `lib/intervuebox/agents.ts`, same convention as `durationForLevel`.
- **`rescore-role` (JD/CV reupload) does not get a new dropdown.** It
  reuses the requesting user's most recent `candidate_level` for that
  role, the same pattern already used for `phone` in
  `app/api/hub/rescore-role/route.ts` — reupload is a JD/CV correction, not
  a re-declaration of seniority.

## Data model

- `fitment_leads` gets a new column: `candidate_level text not null default 'mid' check (candidate_level in ('entry','mid','senior'))`.
  New migration `supabase/migrations/0012_fitment_leads_candidate_level.sql`.

## Code changes

- `app/hub/FitmentChecker.tsx` — add a required "Experience level" select
  (Entry-level / Mid-level / Senior), submitted as `candidateLevel` in the
  form POST, alongside the existing `role`/`phone`/etc. fields.
- `app/api/hub/fitment-check/route.ts` — read + validate `candidateLevel`
  from the form (reject unknown values), store on the `fitment_leads`
  insert.
- `app/api/hub/rescore-role/route.ts` — look up the user's most recent
  `candidate_level` for this role (mirroring the existing `phone` lookup)
  and `form.set("candidateLevel", ...)` before forwarding to
  `fitment-check`.
- `lib/intervuebox/agents.ts` — `createInterviewAgent(jobId, roleTitle, candidateLevel)`
  computes `maxInterviewMinutes` via a small `durationForLevel(candidateLevel)`
  mapping (`entry|mid` → 30, `senior` → 45) instead of the hardcoded `30`.
- `app/api/hub/start-ai-interview/route.ts` — the `fitment_leads` lookup
  additionally selects `candidate_level`, passed through to
  `createInterviewAgent`.

## Testing

- `lib/intervuebox/__tests__/agents.test.ts` — extend for
  `durationForLevel`/`createInterviewAgent`'s new param (30/30/45 across
  entry/mid/senior, default/unknown-safe behavior).
- `app/api/hub/fitment-check/__tests__/route.test.ts` — reject missing/invalid
  `candidateLevel`; accept valid values and confirm it's stored.
- `app/api/hub/start-ai-interview/__tests__/route.test.ts` — confirm
  `candidate_level` is read from the lead and forwarded into
  `createInterviewAgent` with the right duration.

## Open Items

None — both duration and complexity scaling are shipped as of 2026-08-20.
