import { Resend } from "resend";
import { renderTemplate } from "@/lib/emailTemplates";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Email service is not configured (RESEND_API_KEY missing).");
  }
  return new Resend(apiKey);
}

function getFromEmail(): string {
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("Email service is not configured (CONTACT_FROM_EMAIL missing).");
  }
  return fromEmail;
}

function confirmUrl(token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.merito.in";
  return `${siteUrl}/api/public/recruiter/verify-email/confirm?token=${token}`;
}

export async function sendRecruiterVerificationEmail(to: string, token: string): Promise<void> {
  const resend = getResendClient();
  const rendered = await renderTemplate("recruiter_verification", { url: confirmUrl(token) });

  await resend.emails.send({
    from: getFromEmail(),
    to: [to],
    subject: rendered.subject,
    text: rendered.bodyText,
    html: rendered.bodyHtml,
  });
}
