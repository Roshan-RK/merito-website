import { getSupabaseServerClient } from "@/lib/supabase";
import { scoreOutOfTen } from "@/lib/intervuebox/reports";

export type ConversionResult =
  | { status: "converted"; leadId: string }
  | { status: "already_converted"; leadId: string }
  | { status: "not_found" };

function deriveRoleLabel(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "Role";
}

export async function convertProspectToLead(claimToken: string, userId: string, email: string): Promise<ConversionResult> {
  const admin = getSupabaseServerClient();
  const { data: prospect } = await admin
    .from("recruiter_sourced_prospects")
    .select("id, candidate_name, candidate_level, jd_text, ib_job_id, ib_resume_id, ib_applied_job_id, resume_match_raw, converted_lead_id")
    .eq("claim_token", claimToken)
    .maybeSingle();

  if (!prospect) {
    return { status: "not_found" };
  }
  if (prospect.converted_lead_id) {
    return { status: "already_converted", leadId: prospect.converted_lead_id as string };
  }

  const match = prospect.resume_match_raw as {
    overallScore: number;
    summary: string;
    rank: number | null;
    categories: unknown;
    strongPoints: unknown;
    weakPoints: unknown;
  };

  const { data: inserted, error: insertError } = await admin
    .from("fitment_leads")
    .insert({
      user_id: userId,
      name: prospect.candidate_name,
      email,
      candidate_level: prospect.candidate_level,
      role_title: deriveRoleLabel(prospect.jd_text as string),
      jd_text: prospect.jd_text,
      jd_source: "recruiter_sourced",
      score: scoreOutOfTen(match.overallScore),
      verdict: match.summary || "No summary available.",
      ib_job_id: prospect.ib_job_id,
      ib_resume_id: prospect.ib_resume_id,
      ib_applied_job_id: prospect.ib_applied_job_id,
      resume_match_status: "READY",
      resume_match_score: match.overallScore,
      resume_match_raw: match,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(`Failed to convert prospect to lead: ${insertError?.message}`);
  }

  const { error: updateError } = await admin
    .from("recruiter_sourced_prospects")
    .update({ converted_lead_id: inserted.id })
    .eq("id", prospect.id);
  if (updateError) {
    throw new Error(`Failed to mark prospect converted: ${updateError.message}`);
  }

  return { status: "converted", leadId: inserted.id as string };
}
