import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { createJob } from "@/lib/intervuebox/jobs";
import { addApplicant } from "@/lib/intervuebox/applicants";
import { getResumeMatchReport, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { CandidateLevel } from "@/lib/intervuebox/agents";

const POLL_INTERVAL_MS = Number(process.env.RESCORE_POLL_INTERVAL_MS) || 5_000;
const MAX_WAIT_MS = Number(process.env.RESCORE_MAX_WAIT_MS) || 90_000;

export function hashJd(jdText: string): string {
  return createHash("sha256").update(jdText.trim()).digest("hex");
}

export type CandidateForRescore = {
  userId: string;
  ibResumeId: string;
  name: string;
  email: string;
  phone: string;
  candidateLevel: CandidateLevel;
};

export async function getCachedRescore(userId: string, jdHash: string): Promise<ResumeMatchReportReady | null> {
  const admin = getSupabaseServerClient();
  const { data } = await admin
    .from("recruiter_jd_rescores")
    .select("status, resume_match_raw")
    .eq("user_id", userId)
    .eq("jd_hash", jdHash)
    .maybeSingle();

  if (data?.status === "ready" && data.resume_match_raw) {
    return data.resume_match_raw as ResumeMatchReportReady;
  }
  return null;
}

function deriveJobTitle(jdText: string): string {
  const firstLine = jdText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine ? firstLine.slice(0, 80) : "Role";
}

export async function runRescore(
  candidate: CandidateForRescore,
  jdText: string,
  jdHash: string
): Promise<ResumeMatchReportReady> {
  const admin = getSupabaseServerClient();

  const { ibJobId } = await createJob({
    title: deriveJobTitle(jdText),
    jobDescription: jdText,
    candidateLevel: candidate.candidateLevel,
  });
  const { ibAppliedJobId } = await addApplicant({
    jobId: ibJobId,
    resumeId: candidate.ibResumeId,
    name: candidate.name,
    email: candidate.email,
    phoneNumber: candidate.phone,
  });

  let report = await getResumeMatchReport(ibAppliedJobId);
  const deadline = Date.now() + MAX_WAIT_MS;
  while (report.status === "PENDING" && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    report = await getResumeMatchReport(ibAppliedJobId);
  }

  if (report.status !== "READY") {
    await admin.from("recruiter_jd_rescores").upsert(
      {
        user_id: candidate.userId,
        jd_hash: jdHash,
        jd_text: jdText,
        status: "failed",
        ib_job_id: ibJobId,
        ib_applied_job_id: ibAppliedJobId,
      },
      { onConflict: "user_id,jd_hash" }
    );
    throw new Error("Resume match report did not become ready in time.");
  }

  const { status: _status, ...reportReady } = report;
  await admin.from("recruiter_jd_rescores").upsert(
    {
      user_id: candidate.userId,
      jd_hash: jdHash,
      jd_text: jdText,
      status: "ready",
      ib_job_id: ibJobId,
      ib_applied_job_id: ibAppliedJobId,
      resume_match_raw: reportReady,
    },
    { onConflict: "user_id,jd_hash" }
  );

  return reportReady as ResumeMatchReportReady;
}
