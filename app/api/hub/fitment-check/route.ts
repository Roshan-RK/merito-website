import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { createRateLimiter } from "@/lib/rateLimit";
import { createJob } from "@/lib/intervuebox/jobs";
import { uploadResume } from "@/lib/intervuebox/resumes";
import { addApplicant, listApplicantsForJob, type AddApplicantInput } from "@/lib/intervuebox/applicants";
import { getResumeMatchReport, scoreOutOfTen } from "@/lib/intervuebox/reports";
import { IntervueBoxError } from "@/lib/intervuebox/client";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

const checkEmailRateLimit = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
const checkIpRateLimit = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

// IntervueBox parses an uploaded resume asynchronously before it can be
// linked to a job (~40-50s observed for a real DOCX). addApplicant rejects
// with "Resume is still being parsed..." until that finishes — retry on
// that specific condition instead of failing immediately. Overridable via
// env so tests can use near-instant real delays instead of fake timers.
//
// Interval is deliberately long (not a quick poll): IntervueBox appears to
// finish linking the applicant asynchronously even after returning this
// error, so each retry we fire is itself a chance to race that background
// completion — confirmed live with a real ~40-50s-parsing DOCX, where a
// short-interval retry loop reliably landed on "Candidate already applied
// for this job" instead of success right around the parse-completion mark.
// Fewer, more spread-out attempts (~1-2 total after the first) cut that
// collision window; see open item #10 in
// specs/2026-07-17-intervuebox-integration-design.md for the full finding.
const RESUME_PARSE_MAX_WAIT_MS = Number(process.env.RESUME_PARSE_MAX_WAIT_MS) || 90_000;
const RESUME_PARSE_RETRY_INTERVAL_MS = Number(process.env.RESUME_PARSE_RETRY_INTERVAL_MS) || 45_000;

// TEMPORARY (remove once IntervueBox fixes jobs defaulting to inactive on
// creation — tracked in specs/2026-07-17-intervuebox-integration-design.md):
// addApplicant 400s with "...currently inactive or closed" until a human
// manually flips the freshly-created job Active in the IntervueBox
// dashboard. Retrying here gives that human a real window to do so instead
// of failing instantly, since the whole chain otherwise completes in a few
// seconds — faster than anyone could react.
const JOB_INACTIVE_MAX_WAIT_MS = Number(process.env.JOB_INACTIVE_MAX_WAIT_MS) || 90_000;
const JOB_INACTIVE_RETRY_INTERVAL_MS = Number(process.env.JOB_INACTIVE_RETRY_INTERVAL_MS) || 5_000;

function isResumeStillParsingError(err: unknown): boolean {
  return err instanceof IntervueBoxError && /still being parsed/i.test(err.message);
}

function isJobInactiveError(err: unknown): boolean {
  return err instanceof IntervueBoxError && /inactive or closed/i.test(err.message);
}

// IntervueBox can report "still being parsed" on addApplicant and then finish
// linking the applicant asynchronously anyway, before our retry lands — the
// retry then hits this duplicate error instead of success. addApplicantWithRetry
// recovers the real appliedJobId when this fires (see recoverAppliedJobId below);
// this stays as the final fallback for a genuine resubmission (or if recovery
// itself fails) — surfaces the friendly duplicate response rather than a
// dead-end "Something went wrong". Checked by message, not status — this can
// arrive as a plain 400 as well as 409.
function isDuplicateApplicantError(err: unknown): boolean {
  return err instanceof IntervueBoxError && /already applied|already been created for this (resume|job)/i.test(err.message);
}

// Recovers the applicantId after a duplicate-applicant error using the
// undocumented (but live-confirmed) GET /public/jobs/:jobId/applicants
// endpoint. Live-verified 2026-07-22: a job that hit this exact race still
// had exactly one applicant linked server-side, with its resume-match score
// already computed — the error was purely a client-visibility gap, not a
// lost submission. One job per fitment-check submission, so the first (only)
// applicant returned is always the right one.
async function recoverAppliedJobId(jobId: string | undefined): Promise<string | undefined> {
  if (!jobId) return undefined;
  try {
    const { applicants } = await listApplicantsForJob(jobId);
    return applicants[0]?.applicantId;
  } catch (err) {
    console.error("Failed to recover applicantId after duplicate-applicant error", { jobId, error: err });
    return undefined;
  }
}

async function addApplicantWithRetry(input: AddApplicantInput) {
  const parseDeadline = Date.now() + RESUME_PARSE_MAX_WAIT_MS;
  const inactiveDeadline = Date.now() + JOB_INACTIVE_MAX_WAIT_MS;
  for (;;) {
    try {
      return await addApplicant(input);
    } catch (err) {
      if (isResumeStillParsingError(err) && Date.now() < parseDeadline) {
        await new Promise((resolve) => setTimeout(resolve, RESUME_PARSE_RETRY_INTERVAL_MS));
        continue;
      }
      if (isJobInactiveError(err) && Date.now() < inactiveDeadline) {
        await new Promise((resolve) => setTimeout(resolve, JOB_INACTIVE_RETRY_INTERVAL_MS));
        continue;
      }
      if (isDuplicateApplicantError(err)) {
        const recoveredId = await recoverAppliedJobId(input.jobId);
        if (recoveredId) return { ibAppliedJobId: recoveredId };
      }
      throw err;
    }
  }
}

const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, matches client-side cap in FitmentChecker.tsx
const MAX_TEXT_CHARS = 20000;

function normalize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const CANDIDATE_LEVELS = ["entry", "mid", "senior"] as const;
type CandidateLevel = (typeof CANDIDATE_LEVELS)[number];

function isCandidateLevel(value: string): value is CandidateLevel {
  return (CANDIDATE_LEVELS as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = normalize(form.get("name"));
  const email = normalize(form.get("email"));
  const role = normalize(form.get("role"));
  const jdText = normalize(form.get("jdText"));
  const jdUrl = normalize(form.get("jdUrl"));
  const phone = normalize(form.get("phone"));
  const candidateLevel = normalize(form.get("candidateLevel"));
  const recaptchaToken = normalize(form.get("recaptchaToken"));
  const cv = form.get("cv");

  if (!name) {
    return Response.json({ error: "Full name is required." }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!role) {
    return Response.json({ error: "Target role is required." }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "A phone number is required." }, { status: 400 });
  }
  if (!candidateLevel || !isCandidateLevel(candidateLevel)) {
    return Response.json({ error: "A valid experience level is required." }, { status: 400 });
  }
  const validCandidateLevel: CandidateLevel = candidateLevel;
  if (!jdText && !jdUrl) {
    return Response.json({ error: "Paste a job description or provide a link." }, { status: 400 });
  }
  if (!(cv instanceof File) || cv.size === 0) {
    return Response.json({ error: "A CV file is required." }, { status: 400 });
  }
  if (cv.size > MAX_CV_SIZE_BYTES) {
    return Response.json(
      { error: "CV file is too large — please upload a file under 5MB." },
      { status: 400 }
    );
  }

  const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (recaptchaSecretKey) {
    if (!recaptchaToken) {
      return Response.json({ error: "Captcha verification is required." }, { status: 400 });
    }
    const isHuman = await verifyRecaptchaToken(recaptchaToken, recaptchaSecretKey);
    if (!isHuman) {
      return Response.json({ error: "Captcha verification failed." }, { status: 400 });
    }
  }

  if (!checkEmailRateLimit(email) || !checkIpRateLimit(ip)) {
    return Response.json(
      { error: "You've checked your fitment recently — please try again later." },
      { status: 429 }
    );
  }

  const jdSource = jdText ? "paste" : "link";
  const jdForScoring = (jdText || jdUrl).slice(0, MAX_TEXT_CHARS);

  let ibJobId: string | undefined;
  let ibResumeId: string | undefined;
  let ibAppliedJobId: string;
  try {
    ({ ibJobId } = await createJob({ title: role, jobDescription: jdForScoring }));
    ({ ibResumeId } = await uploadResume(cv, { jobId: ibJobId }));
    ({ ibAppliedJobId } = await addApplicantWithRetry({
      jobId: ibJobId,
      resumeId: ibResumeId,
      name: name || "Candidate",
      email,
      phoneNumber: phone,
    }));
  } catch (err) {
    console.error("IntervueBox chain failed after partial success", {
      ibJobId,
      ibResumeId,
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorCode: err instanceof IntervueBoxError ? err.code : undefined,
      errorStatus: err instanceof IntervueBoxError ? err.status : undefined,
      errorDetails: err instanceof IntervueBoxError ? err.details : undefined,
      stack: err instanceof Error ? err.stack : undefined,
    });
    if ((err instanceof IntervueBoxError && err.status === 409) || isDuplicateApplicantError(err)) {
      return Response.json(
        {
          error: "Looks like you've already checked your fitment for this role. Sign in to see your report.",
          duplicate: true,
        },
        { status: 409 }
      );
    }
    return Response.json({ error: "Something went wrong — please try again." }, { status: 502 });
  }

  const report = await getResumeMatchReport(ibAppliedJobId).catch((err) => {
    console.error("getResumeMatchReport failed, treating as pending", err);
    return { status: "PENDING" as const };
  });

  const supabase = getSupabaseServerClient();
  const { data: inserted, error: insertError } = await supabase
    .from("fitment_leads")
    .insert({
      name: name || null,
      email,
      phone,
      candidate_level: validCandidateLevel,
      role_title: role,
      jd_text: jdForScoring,
      jd_source: jdSource,
      score: report.status === "READY" ? scoreOutOfTen(report.overallScore) : 0,
      verdict: report.status === "READY" ? report.summary : "",
      ib_job_id: ibJobId,
      ib_resume_id: ibResumeId,
      ib_applied_job_id: ibAppliedJobId,
      resume_match_status: report.status,
      resume_match_score: report.status === "READY" ? report.overallScore : null,
      resume_match_raw:
        report.status === "READY"
          ? {
              overallScore: report.overallScore,
              rank: report.rank,
              categories: report.categories,
              summary: report.summary,
              strongPoints: report.strongPoints,
              weakPoints: report.weakPoints,
            }
          : null,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return Response.json({ error: "Something went wrong saving your result." }, { status: 500 });
  }

  if (report.status === "PENDING") {
    return Response.json({ status: "pending", leadId: inserted.id });
  }

  return Response.json({ status: "ready", score: scoreOutOfTen(report.overallScore), verdict: report.summary });
}
