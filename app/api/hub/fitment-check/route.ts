import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { createRateLimiter } from "@/lib/rateLimit";
import { parseCvFile, UnsupportedCvFileError } from "@/lib/parseCvFile";
import { scoreFitment } from "@/lib/scoreFitment";
import { getSupabaseServerClient } from "@/lib/supabase";

export const runtime = "nodejs";

// Placeholder threshold — exact limit is an open decision (see spec §Explicit open items).
const checkEmailRateLimit = createRateLimiter({ max: 3, windowMs: 60 * 60 * 1000 });
// IP-keyed limiter closes the gap where email is spoofable per-request (unverified at this stage).
const checkIpRateLimit = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

const MAX_CV_SIZE_BYTES = 5 * 1024 * 1024; // 5MB, matches client-side cap in FitmentChecker.tsx
const MAX_TEXT_CHARS = 20000; // token-cost ceiling before text hits scoreFitment's prompt

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
  const recaptchaToken = normalize(form.get("recaptchaToken"));
  const cv = form.get("cv");

  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (!role) {
    return Response.json({ error: "Target role is required." }, { status: 400 });
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

  let cvText: string;
  try {
    cvText = (await parseCvFile(cv)).slice(0, MAX_TEXT_CHARS);
  } catch (err) {
    if (err instanceof UnsupportedCvFileError) {
      return Response.json({ error: "We couldn't read that file — please upload a PDF or DOCX." }, { status: 400 });
    }
    return Response.json({ error: "Something went wrong reading your CV." }, { status: 500 });
  }

  // jdUrl fetching/extraction is a follow-up (see spec §Explicit open items) —
  // for now, a link is stored as the JD source but the pasted text (if any) is
  // what's scored. If only a link was given, use it as the JD text placeholder.
  const jdSource = jdText ? "paste" : "link";
  const jdForScoring = (jdText || jdUrl).slice(0, MAX_TEXT_CHARS);

  let result;
  try {
    result = await scoreFitment(jdForScoring, cvText);
  } catch {
    return Response.json({ error: "Something went wrong — please try again." }, { status: 500 });
  }

  const supabase = getSupabaseServerClient();
  const { error: insertError } = await supabase.from("fitment_leads").insert({
    name: name || null,
    email,
    role_title: role,
    jd_text: jdForScoring,
    jd_source: jdSource,
    score: result.score,
    verdict: result.verdict,
    cv_text: cvText,
  });

  if (insertError) {
    return Response.json({ error: "Something went wrong saving your result." }, { status: 500 });
  }

  return Response.json({ score: result.score, verdict: result.verdict });
}
