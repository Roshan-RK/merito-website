# Admin Portal — Slice 8: Learned Skills Review Queue

**Status:** Approved. Scoped down from roadmap slice 8 ("jobs, applicants, resumes, interview reports, learned skills") — see Scope Decision below.

## Context

`createJob` (`lib/intervuebox/jobs.ts`) tries LLM skill extraction first (`extractSkillsWithLLM`), falling back to a static `SKILL_KEYWORDS` keyword match only on failure. Every LLM extraction that returns a skill not already in `SKILL_KEYWORDS` gets logged to `learned_skill_keywords` (migration `0023_learned_skill_keywords.sql`, shipped 2026-07-31) via `logNewSkillsForReview`. This table has existed for 5 days with zero admin visibility — nobody can see what new skills the LLM is surfacing or promote them into the fallback list.

## Scope Decision

Roadmap slice 8 originally covered jobs, applicants, resumes, interview reports, and learned skills. Per-candidate resume-match reports and interview reports are **already surfaced** in slice 3's candidate drill-down (`lib/adminCandidates.ts` → `CandidateLeadDetail.fitmentReport` / `.interviewReport`, sourced via `getCandidateResumeDetails` and `fitment_interviews.report_raw`). A separate job-level aggregate view would duplicate that data sliced differently, with no new admin action enabled. Learned skills is the only genuinely new, actionable gap — narrowing slice 8 to that.

## What's Built

- **Data layer** — `lib/adminLearnedSkills.ts`: `listLearnedSkills()` reads `learned_skill_keywords` (skill, sample_job_title, first_seen_at), ordered newest-first. Thin Supabase read wrapper, same category as `lib/adminExtension.ts` — no new pure-function logic, no unit tests needed (matches slice 6/7 precedent).
- **Page** — `app/admin/learned-skills/page.tsx`: single table (Skill, Sample job, First seen), same visual pattern as `app/admin/extension/page.tsx`. Read-only, no actions.
- **Nav** — `app/admin/layout.tsx`: add "Learned Skills" link after Extension.

## Out of Scope

- No write/promote action (e.g., "add to SKILL_KEYWORDS") — that list lives in code (`lib/intervuebox/jobs.ts`), not the DB; promoting means an engineer edits the array after reviewing this list. Pure visibility slice.
- No job/applicant/resume aggregate view (see Scope Decision).

## Testing

No new pure-function logic to TDD (read-only Supabase wrapper, mirrors `getLookupStats`/`listRecentLookups`). Verify via `tsc --noEmit` + full suite (no regressions expected — no existing code touched besides the nav link).
