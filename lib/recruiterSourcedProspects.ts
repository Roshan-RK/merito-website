import { getSupabaseServerClient } from "@/lib/supabase";
import { createJob } from "@/lib/intervuebox/jobs";
import { uploadResume } from "@/lib/intervuebox/resumes";
import { addApplicant } from "@/lib/intervuebox/applicants";
import { getResumeMatchReport, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { CandidateLevel } from "@/lib/intervuebox/agents";
import { buildSyntheticResumePdf, type ScrapedCandidateFields } from "@/lib/syntheticResume";
import { isRecruiterEmailVerified } from "@/lib/recruiterIdentity";
import { hashJd } from "@/lib/recruiterJdRescore";

export const MONTHLY_PROSPECT_CAP = 10;
const POLL_INTERVAL_MS = Number(process.env.RESCORE_POLL_INTERVAL_MS) || 5_000;
const MAX_WAIT_MS = Number(process.env.RESCORE_MAX_WAIT_MS) || 90_000;

export type ScoreProspectInput = {
  recruiterEmail: string;
  linkedinUrl: string;
  candidateFields: ScrapedCandidateFields;
  candidateLevel: CandidateLevel;
  jdText: string;
};

export type ScoreProspectResult =
  | { status: "verification_required" }
  | { status: "cap_exceeded" }
  | { status: "ready"; prospectId: string; report: ResumeMatchReportReady }
  | { status: "failed" };

export async function getMonthlyProspectCount(recruiterEmail: string): Promise<number> {
  const admin = getSupabaseServerClient();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count } = await admin
    .from("recruiter_sourced_prospects")
    .select("id", { count: "exact", head: true })
    .eq("recruiter_email", recruiterEmail.toLowerCase())
    .gte("created_at", monthStart.toISOString());

  return count ?? 0;
}

function deriveJobTitle(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "Role";
}

export async function scoreProspect(input: ScoreProspectInput): Promise<ScoreProspectResult> {
  const email = input.recruiterEmail.toLowerCase();

  if (!(await isRecruiterEmailVerified(email))) {
    return { status: "verification_required" };
  }

  const count = await getMonthlyProspectCount(email);
  if (count >= MONTHLY_PROSPECT_CAP) {
    return { status: "cap_exceeded" };
  }

  const admin = getSupabaseServerClient();
  const jdHash = hashJd(input.jdText);

  const { ibJobId } = await createJob({
    title: deriveJobTitle(input.jdText),
    jobDescription: input.jdText,
    candidateLevel: input.candidateLevel,
  });

  const pdfBuffer = await buildSyntheticResumePdf(input.candidateFields);
  const pdfFile = new File([new Uint8Array(pdfBuffer)], "resume.pdf", { type: "application/pdf" });
  const { ibResumeId } = await uploadResume(pdfFile, { jobId: ibJobId });

  const placeholderEmail = `prospect-${crypto.randomUUID()}@leads.merito.ai`;
  const { ibAppliedJobId } = await addApplicant({
    jobId: ibJobId,
    resumeId: ibResumeId,
    name: input.candidateFields.name || "Candidate",
    email: placeholderEmail,
    phoneNumber: "Not specified",
  });

  let report = await getResumeMatchReport(ibAppliedJobId);
  const deadline = Date.now() + MAX_WAIT_MS;
  while (report.status === "PENDING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    report = await getResumeMatchReport(ibAppliedJobId);
  }

  if (report.status !== "READY") {
    await admin.from("recruiter_sourced_prospects").insert({
      recruiter_email: email,
      linkedin_url: input.linkedinUrl,
      candidate_name: input.candidateFields.name || null,
      candidate_level: input.candidateLevel,
      jd_text: input.jdText,
      jd_hash: jdHash,
      ib_job_id: ibJobId,
      ib_resume_id: ibResumeId,
      ib_applied_job_id: ibAppliedJobId,
      status: "failed",
    });
    return { status: "failed" };
  }

  const { status: _status, ...reportReady } = report;
  const { data: inserted, error } = await admin
    .from("recruiter_sourced_prospects")
    .insert({
      recruiter_email: email,
      linkedin_url: input.linkedinUrl,
      candidate_name: input.candidateFields.name || null,
      candidate_level: input.candidateLevel,
      jd_text: input.jdText,
      jd_hash: jdHash,
      ib_job_id: ibJobId,
      ib_resume_id: ibResumeId,
      ib_applied_job_id: ibAppliedJobId,
      resume_match_raw: reportReady,
      status: "ready",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to save scored prospect: ${error?.message}`);
  }

  return { status: "ready", prospectId: inserted.id as string, report: reportReady as ResumeMatchReportReady };
}
