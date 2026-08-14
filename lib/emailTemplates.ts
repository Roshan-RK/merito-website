export const TEMPLATE_KEYS = [
  "recruiter_verification",
  "recruiter_viewed",
  "payment_failed_alert",
  "referee_invite",
  "referee_reminder",
  "contact_form_submission",
] as const;

export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export type TemplateDraft = { subject: string; bodyText: string; bodyHtml: string };
export type RenderedEmail = { subject: string; bodyText: string; bodyHtml: string };

export const TEMPLATE_PLACEHOLDERS: Record<TemplateKey, string[]> = {
  recruiter_verification: ["url"],
  recruiter_viewed: ["candidateName", "dashboardUrl"],
  payment_failed_alert: ["orderId", "amountRupees", "candidateEmail"],
  referee_invite: ["refereeName", "candidateName", "url", "validityDays"],
  referee_reminder: ["refereeName", "candidateName", "url"],
  contact_form_submission: ["fullName", "email", "phone", "departments", "message"],
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function extractPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/\{\{(\w+)\}\}/g)) {
    found.add(match[1]);
  }
  return [...found];
}

function applyValues(text: string, values: Record<string, string>, escapeForHtml: boolean): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, name: string) => {
    if (!(name in values)) return match;
    const raw = values[name];
    return escapeForHtml ? escapeHtml(raw).replace(/\n/g, "<br />") : raw;
  });
}

export function substitutePlaceholders(template: TemplateDraft, values: Record<string, string>): RenderedEmail {
  return {
    subject: applyValues(template.subject, values, false),
    bodyText: applyValues(template.bodyText, values, false),
    bodyHtml: applyValues(template.bodyHtml, values, true),
  };
}
