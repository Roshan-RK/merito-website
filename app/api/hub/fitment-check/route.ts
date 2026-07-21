import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { createRateLimiter } from "@/lib/rateLimit";
import { createJob } from "@/lib/intervuebox/jobs";
import { uploadResume } from "@/lib/intervuebox/resumes";
import { addApplicant, type AddApplicantInput } from "@/lib/intervuebox/applicants";
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
const RESUME_PARSE_MAX_WAIT_MS = Number(process.env.RESUME_PARSE_MAX_WAIT_MS) || 90_000;
const RESUME_PARSE_RETRY_INTERVAL_MS = Number(process.env.RESUME_PARSE_RETRY_INTERVAL_MS) || 8_000;

function isResumeStillParsingError(err: unknown): boolean {
  return err instanceof IntervueBoxError && /still being parsed/i.test(err.message);
}

async function addApplicantWithRetry(input: AddApplicantInput) {
  const deadline = Date.now() + RESUME_PARSE_MAX_WAIT_MS;
  for (;;) {
    try {
      return await addApplicant(input);
    } catch (err) {
      if (!isResumeStillParsingError(err) || Date.now() >= deadline) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, RESUME_PARSE_RETRY_INTERVAL_MS));
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
  const recaptchaToken = normalize(form.get("recaptchaToken"));
  const cv = form.get("cv");

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!role) {
    return Response.json({ error: "Target role is required." }, { status: 400 });
  }
  if (!phone) {
    return Response.json({ error: "A phone number is required." }, { status: 400 });
  }
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
    console.error("IntervueBox chain failed after partial success", { ibJobId, ibResumeId, error: err });
    return Response.json({ error: "Something went wrong — please try again." }, { status: 500 });
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
