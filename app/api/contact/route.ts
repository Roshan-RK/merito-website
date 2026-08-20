import { Resend } from "resend";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { createRateLimiter } from "@/lib/rateLimit";
import { renderTemplate } from "@/lib/emailTemplates";

// Per-instance (sufficient for single deployments; for multi-instance Vercel, swap to KV)
const checkRateLimit = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

type ContactPayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  departments?: string;
  message?: string;
  recaptchaToken?: string;
  "bot-field"?: string;
};

function normalize(value: unknown) {
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

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many requests. Please wait 10 minutes before trying again." },
      { status: 429 }
    );
  }

  let payload: ContactPayload;

  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (normalize(payload["bot-field"])) {
    return Response.json({ ok: true });
  }

  const firstName = normalize(payload.firstName);
  const lastName = normalize(payload.lastName);
  const email = normalize(payload.email);
  const phone = normalize(payload.phone);
  const departments = normalize(payload.departments);
  const message = normalize(payload.message);
  const recaptchaToken = normalize(payload.recaptchaToken);

  if (!firstName || !lastName || !email || !departments || !message) {
    return Response.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return Response.json({ error: "Invalid email address." }, { status: 400 });
  }

  const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
  const recaptchaEnabled = Boolean(recaptchaSecretKey);
  if (recaptchaEnabled) {
    if (!recaptchaToken) {
      return Response.json({ error: "Captcha verification is required." }, { status: 400 });
    }
    const isHuman = await verifyRecaptchaToken(recaptchaToken, recaptchaSecretKey as string);
    if (!isHuman) {
      return Response.json({ error: "Captcha verification failed." }, { status: 400 });
    }
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  const toEmail = process.env.CONTACT_TO_EMAIL;

  if (!apiKey || !fromEmail || !toEmail) {
    return Response.json({ error: "Email service is not configured." }, { status: 500 });
  }

  const resend = new Resend(apiKey);
  const recipients = toEmail
    .split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return Response.json({ error: "Email recipients are not configured." }, { status: 500 });
  }

  try {
    const rendered = await renderTemplate("contact_form_submission", {
      fullName: `${firstName} ${lastName}`,
      email,
      phone: phone || "Not provided",
      departments,
      message,
    });

    await resend.emails.send({
      from: fromEmail,
      to: recipients,
      replyTo: email,
      subject: rendered.subject,
      text: rendered.bodyText,
      html: rendered.bodyHtml,
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Unable to send message." }, { status: 500 });
  }
}
