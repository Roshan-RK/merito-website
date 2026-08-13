import { getSupabaseServerClient } from "@/lib/supabase";

// Every LLM extraction that returns a skill not already in the static
// SKILL_KEYWORDS fallback list gets logged here for human review -- not
// auto-merged. The fallback list is only exercised when the LLM call
// already failed, so feeding it from a live, unreviewed DB read would add
// a second failure mode to the exact path meant to be the reliable safety
// net. This is fire-and-forget: never awaited by the caller, never throws,
// so a DB hiccup can't affect job creation.
export function logNewSkillsForReview(skills: string[], knownKeywords: readonly string[], jobTitle: string): void {
  const known = new Set(knownKeywords.map((s) => s.toLowerCase()));
  const newSkills = skills.filter((s) => !known.has(s.toLowerCase()));
  if (newSkills.length === 0) return;

  void insertLearnedSkills(newSkills, jobTitle).catch(() => {});
}

async function insertLearnedSkills(skills: string[], jobTitle: string): Promise<void> {
  const supabase = getSupabaseServerClient();
  await supabase
    .from("learned_skill_keywords")
    .upsert(
      skills.map((skill) => ({ skill, sample_job_title: jobTitle })),
      { onConflict: "skill", ignoreDuplicates: true }
    );
}
