import { Resend } from "resend";

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
  const url = confirmUrl(token);

  await resend.emails.send({
    from: getFromEmail(),
    to: [to],
    subject: "Confirm your email to use Merito's recruiter scoring tool",
    text: `Click to confirm your email and start scoring candidates:\n${url}\n\nThis link expires in 30 minutes.`,
    html: `<p>Click to confirm your email and start scoring candidates:</p><p><a href="${url}">${url}</a></p><p>This link expires in 30 minutes.</p>`,
  });
}
