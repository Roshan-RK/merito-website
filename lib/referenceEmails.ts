import { Resend } from "resend";

type RefereeEmailParams = {
  to: string;
  refereeName: string;
  candidateName: string;
  token: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  const url = feedbackUrl(params.token);
  const safeReferee = escapeHtml(params.refereeName);
  const safeCandidate = escapeHtml(params.candidateName);

  await resend.emails.send({
    from: getFromEmail(),
    to: [params.to],
    subject: `${params.candidateName} listed you as a professional reference`,
    text: `Hi ${params.refereeName},\n\n${params.candidateName} listed you as a reference on Merito. Please share quick feedback here:\n${url}\n\nThis link expires in ${process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS || "14"} days.`,
    html: `<p>Hi ${safeReferee},</p><p>${safeCandidate} listed you as a reference on Merito. Please share quick feedback:</p><p><a href="${url}">${url}</a></p><p>This link expires in ${process.env.REFERENCE_FEEDBACK_LINK_VALIDITY_DAYS || "14"} days.</p>`,
  });
}

export async function sendRefereeReminderEmail(params: RefereeEmailParams): Promise<void> {
  const resend = getResendClient();
  const url = feedbackUrl(params.token);
  const safeReferee = escapeHtml(params.refereeName);
  const safeCandidate = escapeHtml(params.candidateName);

  await resend.emails.send({
    from: getFromEmail(),
    to: [params.to],
    subject: `Reminder: ${params.candidateName} is waiting on your feedback`,
    text: `Hi ${params.refereeName},\n\nJust a reminder — ${params.candidateName} is waiting on your reference feedback:\n${url}`,
    html: `<p>Hi ${safeReferee},</p><p>Just a reminder — ${safeCandidate} is waiting on your reference feedback:</p><p><a href="${url}">${url}</a></p>`,
  });
}
