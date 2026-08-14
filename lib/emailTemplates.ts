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

import { getSupabaseServerClient } from "@/lib/supabase";

export const DEFAULT_TEMPLATES: Record<TemplateKey, TemplateDraft> = {
  recruiter_verification: {
    subject: "Confirm your email to use Merito's recruiter scoring tool",
    bodyText: "Click to confirm your email and start scoring candidates:\n{{url}}\n\nThis link expires in 30 minutes.",
    bodyHtml: '<p>Click to confirm your email and start scoring candidates:</p><p><a href="{{url}}">{{url}}</a></p><p>This link expires in 30 minutes.</p>',
  },
  recruiter_viewed: {
    subject: "A recruiter checked out your profile",
    bodyText: "Hi {{candidateName}},\n\nA recruiter checked out your Merito profile through our recruiter extension.\n\nSee your recruiter activity: {{dashboardUrl}}",
    bodyHtml: '<p>Hi {{candidateName}},</p><p>A recruiter checked out your Merito profile through our recruiter extension.</p><p><a href="{{dashboardUrl}}">See your recruiter activity</a></p>',
  },
  payment_failed_alert: {
    subject: "Payment failed — order {{orderId}}",
    bodyText: "A payment failed.\n\nOrder: {{orderId}}\nAmount: ₹{{amountRupees}}\nCandidate: {{candidateEmail}}",
    bodyHtml: "<p>A payment failed.</p><p>Order: {{orderId}}<br/>Amount: ₹{{amountRupees}}<br/>Candidate: {{candidateEmail}}</p>",
  },
  referee_invite: {
    subject: "{{candidateName}} listed you as a professional reference",
    bodyText: "Hi {{refereeName}},\n\n{{candidateName}} listed you as a reference on Merito. Please share quick feedback here:\n{{url}}\n\nThis link expires in {{validityDays}} days.",
    bodyHtml: '<p>Hi {{refereeName}},</p><p>{{candidateName}} listed you as a reference on Merito. Please share quick feedback:</p><p><a href="{{url}}">{{url}}</a></p><p>This link expires in {{validityDays}} days.</p>',
  },
  referee_reminder: {
    subject: "Reminder: {{candidateName}} is waiting on your feedback",
    bodyText: "Hi {{refereeName}},\n\nJust a reminder — {{candidateName}} is waiting on your reference feedback:\n{{url}}",
    bodyHtml: '<p>Hi {{refereeName}},</p><p>Just a reminder — {{candidateName}} is waiting on your reference feedback:</p><p><a href="{{url}}">{{url}}</a></p>',
  },
  contact_form_submission: {
    subject: "New contact form submission from {{fullName}}",
    bodyText: "Name: {{fullName}}\nEmail: {{email}}\nPhone: {{phone}}\nDepartments: {{departments}}\n\nMessage:\n{{message}}",
    bodyHtml: "<h2>New contact form submission</h2><p><strong>Name:</strong> {{fullName}}</p><p><strong>Email:</strong> {{email}}</p><p><strong>Phone:</strong> {{phone}}</p><p><strong>Departments:</strong> {{departments}}</p><p><strong>Message:</strong></p><p>{{message}}</p>",
  },
};

export type EmailTemplateRow = {
  key: TemplateKey;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  updatedAt: string;
  updatedBy: string | null;
};

export async function listTemplates(): Promise<EmailTemplateRow[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("email_templates")
    .select("key, subject, body_text, body_html, updated_at, updated_by")
    .order("key");

  return (data ?? []).map((row) => ({
    key: row.key as TemplateKey,
    subject: row.subject,
    bodyText: row.body_text,
    bodyHtml: row.body_html,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
}

const CACHE_TTL_MS = 60_000;
const templateCache = new Map<TemplateKey, { draft: TemplateDraft; expiresAt: number }>();

export async function getTemplate(key: TemplateKey): Promise<TemplateDraft> {
  const cached = templateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.draft;
  }

  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from("email_templates").select("subject, body_text, body_html").eq("key", key).maybeSingle();

  if (!data) {
    return DEFAULT_TEMPLATES[key];
  }

  const draft: TemplateDraft = { subject: data.subject, bodyText: data.body_text, bodyHtml: data.body_html };
  templateCache.set(key, { draft, expiresAt: Date.now() + CACHE_TTL_MS });
  return draft;
}
