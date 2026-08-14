import { Resend } from "resend";
import { getAbsoluteUrl } from "@/lib/site";
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

export async function sendRecruiterViewedEmail(to: string, candidateName: string): Promise<void> {
  const resend = getResendClient();
  const rendered = await renderTemplate("recruiter_viewed", { candidateName, dashboardUrl: getAbsoluteUrl("/hub/account") });

  await resend.emails.send({
    from: getFromEmail(),
    to: [to],
    subject: rendered.subject,
    text: rendered.bodyText,
    html: rendered.bodyHtml,
  });
}
