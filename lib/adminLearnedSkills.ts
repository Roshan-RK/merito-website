import { getSupabaseServerClient } from "@/lib/supabase";

export type LearnedSkillRow = {
  skill: string;
  sampleJobTitle: string | null;
  firstSeenAt: string;
};

export async function listLearnedSkills(): Promise<LearnedSkillRow[]> {
  const supabase = getSupabaseServerClient();

  const { data: rows } = await supabase
    .from("learned_skill_keywords")
    .select("skill, sample_job_title, first_seen_at")
    .order("first_seen_at", { ascending: false });

  return (rows ?? []).map((r) => ({
    skill: r.skill,
    sampleJobTitle: r.sample_job_title,
    firstSeenAt: r.first_seen_at,
  }));
}
