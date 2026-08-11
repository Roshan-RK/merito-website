import { getSupabaseServerClient } from "@/lib/supabase";
import { scoreOutOfTen } from "@/lib/intervuebox/reports";

export const runtime = "nodejs";

function deriveRoleLabel(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "this role";
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = getSupabaseServerClient();
  const { data } = await admin
    .from("recruiter_sourced_prospects")
    .select("candidate_name, jd_text, resume_match_raw, converted_lead_id")
    .eq("claim_token", token)
    .maybeSingle();

  if (!data) {
    return Response.json({ valid: false, reason: "not_found" });
  }
  if (data.converted_lead_id) {
    return Response.json({ valid: false, reason: "already_converted" });
  }

  const match = data.resume_match_raw as { overallScore: number };
  return Response.json({
    valid: true,
    candidateName: data.candidate_name as string | null,
    roleLabel: deriveRoleLabel(data.jd_text as string),
    score: scoreOutOfTen(match.overallScore),
  });
}
