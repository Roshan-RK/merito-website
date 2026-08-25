import { getSupabaseServerClient } from "@/lib/supabase";
import { createJob, resolveJobDetails } from "@/lib/intervuebox/jobs";
import { uploadResume } from "@/lib/intervuebox/resumes";
import { addApplicant, listApplicantsForJob, isDuplicateApplicantError } from "@/lib/intervuebox/applicants";
import { getResumeMatchReport, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import { IntervueBoxError } from "@/lib/intervuebox/client";
import type { CandidateLevel } from "@/lib/intervuebox/agents";
import { buildSyntheticResumePdf, buildResumeText, type ScrapedCandidateFields } from "@/lib/syntheticResume";
import { isRecruiterEmailVerified } from "@/lib/recruiterIdentity";
import { hashJd } from "@/lib/recruiterJdRescore";
import { logRecruiterAction } from "@/lib/recruiterActionLog";
import { MONTHLY_CHECK_CAP, getMonthlyCheckCount } from "@/lib/recruiterChecks";

export type ScoreProspectInput = {
  recruiterEmail: string;
  linkedinUrl: string;
  candidateFields: ScrapedCandidateFields;
  candidateLevel: CandidateLevel;
  jdText: string;
};

// Scoring a prospect is a two-phase, poll-driven flow rather than one long
// request: IntervueBox's resume-parse (~40-50s observed) plus report
// generation on top of that can't reliably fit inside a single Vercel
// function invocation's time budget. startScoringProspect kicks the
// IntervueBox chain off and returns immediately; the extension polls
// getProspectScoreStatus (cheap, single-shot per call) until it's ready.
export type StartScoringResult =
  | { status: "verification_required" }
  | { status: "cap_exceeded" }
  | { status: "pending"; prospectId: string }
  | { status: "ready"; prospectId: string; report: ResumeMatchReportReady; jdText: string }
  | { status: "failed" };

export type ProspectScoreStatusResult =
  | { status: "pending" }
  | { status: "ready"; prospectId: string; report: ResumeMatchReportReady; jdText: string }
  | { status: "failed" };

function deriveJobTitle(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "Role";
}

function isResumeStillParsingError(err: unknown): boolean {
  return err instanceof IntervueBoxError && /still being parsed/i.test(err.message);
}

function isJobInactiveError(err: unknown): boolean {
  return err instanceof IntervueBoxError && /inactive or closed/i.test(err.message);
}

// IntervueBox can report "still being parsed" on addApplicant and then finish
// linking the applicant asynchronously anyway, before our retry lands -- the
// retry then hits this duplicate error instead of success. Live-confirmed
// 2026-08-12 hitting on the very first attempt (same race documented for the
// fitment-check route's addApplicantWithRetry).
async function recoverAppliedJobId(jobId: string): Promise<string | undefined> {
  try {
    const { applicants } = await listApplicantsForJob(jobId);
    return applicants[0]?.applicantId;
  } catch (err) {
    console.error("Failed to recover applicantId after duplicate-applicant error", { jobId, error: err });
    return undefined;
  }
}

async function tryAddApplicant(params: {
  jobId: string;
  resumeId: string;
  candidateName: string;
}): Promise<{ ibAppliedJobId: string } | { pending: true } | { failed: true }> {
  // TEMPORARY: fixed to a real monitored inbox for testing -- see the same
  // note on placeholderEmail in lib/syntheticResume.ts.
  const placeholderEmail = "roshan@merito.in";
  try {
    const { ibAppliedJobId } = await addApplicant({
      jobId: params.jobId,
      resumeId: params.resumeId,
      name: params.candidateName,
      email: placeholderEmail,
      phoneNumber: "Not specified",
    });
    return { ibAppliedJobId };
  } catch (err) {
    if (isResumeStillParsingError(err) || isJobInactiveError(err)) {
      return { pending: true };
    }
    if (isDuplicateApplicantError(err)) {
      const recoveredId = await recoverAppliedJobId(params.jobId);
      if (recoveredId) return { ibAppliedJobId: recoveredId };
    }
    console.error("addApplicant failed for prospect", err);
    return { failed: true };
  }
}

export async function startScoringProspect(input: ScoreProspectInput): Promise<StartScoringResult> {
  const email = input.recruiterEmail.toLowerCase();

  if (!(await isRecruiterEmailVerified(email))) {
    return { status: "verification_required" };
  }

  const admin = getSupabaseServerClient();
  const jdHash = hashJd(input.jdText);

  const { data: existing } = await admin
    .from("recruiter_sourced_prospects")
    .select("id, resume_match_raw")
    .eq("recruiter_email", email)
    .eq("linkedin_url", input.linkedinUrl)
    .eq("jd_hash", jdHash)
    .eq("status", "ready")
    .maybeSingle();

  if (existing) {
    return {
      status: "ready",
      prospectId: existing.id as string,
      report: existing.resume_match_raw as ResumeMatchReportReady,
      jdText: input.jdText,
    };
  }

  const count = await getMonthlyCheckCount(email);
  if (count >= MONTHLY_CHECK_CAP) {
    return { status: "cap_exceeded" };
  }

  const resumeText = buildResumeText(input.candidateFields);
  const { skills, title } = await resolveJobDetails(deriveJobTitle(input.jdText), input.jdText, input.candidateLevel, resumeText);
  const { ibJobId } = await createJob({
    title,
    jobDescription: input.jdText,
    candidateLevel: input.candidateLevel,
    resumeText,
    skills,
  });

  const pdfBuffer = await buildSyntheticResumePdf(input.candidateFields);
  const pdfFile = new File([new Uint8Array(pdfBuffer)], "resume.pdf", { type: "application/pdf" });
  const { ibResumeId } = await uploadResume(pdfFile, { jobId: ibJobId });

  // Best-effort immediate attempt -- IntervueBox sometimes parses fast
  // enough that this succeeds inline, saving the extension a poll round
  // trip. If not, getProspectScoreStatus retries on the next poll.
  const applicantResult = await tryAddApplicant({
    jobId: ibJobId,
    resumeId: ibResumeId,
    candidateName: input.candidateFields.name || "Candidate",
  });

  const baseRow = {
    recruiter_email: email,
    linkedin_url: input.linkedinUrl,
    candidate_name: input.candidateFields.name || null,
    candidate_level: input.candidateLevel,
    jd_text: input.jdText,
    jd_hash: jdHash,
    ib_job_id: ibJobId,
    ib_resume_id: ibResumeId,
  };

  if ("failed" in applicantResult) {
    await admin.from("recruiter_sourced_prospects").insert({ ...baseRow, status: "failed" });
    return { status: "failed" };
  }

  const { data: inserted, error } = await admin
    .from("recruiter_sourced_prospects")
    .insert({
      ...baseRow,
      ib_applied_job_id: "ibAppliedJobId" in applicantResult ? applicantResult.ibAppliedJobId : null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    throw new Error(`Failed to save prospect: ${error?.message}`);
  }

  try {
    await logRecruiterAction({
      recruiterEmail: email,
      action: "prospect.scored",
      targetType: "prospect",
      targetId: inserted.id as string,
      detail: { candidateName: input.candidateFields.name || null },
    });
  } catch (err) {
    console.error("Failed to log recruiter action prospect.scored", err);
  }

  return { status: "pending", prospectId: inserted.id as string };
}

export async function getProspectScoreStatus(prospectId: string): Promise<ProspectScoreStatusResult> {
  const admin = getSupabaseServerClient();
  const { data: row, error: fetchError } = await admin
    .from("recruiter_sourced_prospects")
    .select("status, ib_job_id, ib_resume_id, ib_applied_job_id, candidate_name, resume_match_raw, jd_text")
    .eq("id", prospectId)
    .maybeSingle();

  if (fetchError || !row) {
    return { status: "failed" };
  }

  const jdText = row.jd_text as string;

  if (row.status === "ready") {
    return { status: "ready", prospectId, report: row.resume_match_raw as ResumeMatchReportReady, jdText };
  }
  if (row.status === "failed") {
    return { status: "failed" };
  }

  let ibAppliedJobId = row.ib_applied_job_id as string | null;

  if (!ibAppliedJobId) {
    const applicantResult = await tryAddApplicant({
      jobId: row.ib_job_id as string,
      resumeId: row.ib_resume_id as string,
      candidateName: (row.candidate_name as string | null) || "Candidate",
    });
    if ("failed" in applicantResult) {
      await admin.from("recruiter_sourced_prospects").update({ status: "failed" }).eq("id", prospectId);
      return { status: "failed" };
    }
    if ("pending" in applicantResult) {
      return { status: "pending" };
    }
    ibAppliedJobId = applicantResult.ibAppliedJobId;
    await admin.from("recruiter_sourced_prospects").update({ ib_applied_job_id: ibAppliedJobId }).eq("id", prospectId);
  }

  const report = await getResumeMatchReport(ibAppliedJobId).catch((err) => {
    console.error("getResumeMatchReport failed for prospect, treating as pending", err);
    return { status: "PENDING" as const };
  });

  if (report.status !== "READY") {
    return { status: "pending" };
  }

  const { status: _status, ...reportReady } = report;
  const { error: updateError } = await admin
    .from("recruiter_sourced_prospects")
    .update({ resume_match_raw: reportReady, status: "ready" })
    .eq("id", prospectId);

  if (updateError) {
    console.error("Failed to persist ready prospect score", updateError);
  }

  return { status: "ready", prospectId, report: reportReady as ResumeMatchReportReady, jdText };
}
