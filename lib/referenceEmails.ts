import { Resend } from "resend";
import { renderTemplate } from "@/lib/emailTemplates";

type RefereeEmailParams = {
  to: string;
  refereeName: string;
  candidateName: string;
  token: string;
};

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

function feedbackUrl(token: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.merito.in";
  return `${siteUrl}/hub/references/feedback/${token}`;
}

export async function sendRefereeInviteEmail(params: RefereeEmailParams): Promise<void> {
  const resend = getResendClient();
  const rendered = await renderTemplate("referee_invite", {
    refereeName: params.refereeName,
    candidateName: params.candidateName,
    url: feedbackUrl(params.token),
    validityDays: process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS || "14",
  });

  await resend.emails.send({
    from: getFromEmail(),
    to: [params.to],
    subject: rendered.subject,
    text: rendered.bodyText,
    html: rendered.bodyHtml,
  });
}

export async function sendRefereeReminderEmail(params: RefereeEmailParams): Promise<void> {
  const resend = getResendClient();
  const rendered = await renderTemplate("referee_reminder", {
    refereeName: params.refereeName,
    candidateName: params.candidateName,
    url: feedbackUrl(params.token),
  });

  await resend.emails.send({
    from: getFromEmail(),
    to: [params.to],
    subject: rendered.subject,
    text: rendered.bodyText,
    html: rendered.bodyHtml,
  });
}
