import { Resend } from "resend";
import { getAbsoluteUrl } from "@/lib/site";

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

export async function sendRecruiterViewedEmail(to: string, candidateName: string): Promise<void> {
  const resend = getResendClient();
  const safeName = escapeHtml(candidateName);
  const dashboardUrl = getAbsoluteUrl("/hub/account");

  await resend.emails.send({
    from: getFromEmail(),
    to: [to],
    subject: "A recruiter checked out your profile",
    text: `Hi ${candidateName},\n\nA recruiter checked out your Merito profile through our recruiter extension.\n\nSee your recruiter activity: ${dashboardUrl}`,
    html: `<p>Hi ${safeName},</p><p>A recruiter checked out your Merito profile through our recruiter extension.</p><p><a href="${dashboardUrl}">See your recruiter activity</a></p>`,
  });
}
