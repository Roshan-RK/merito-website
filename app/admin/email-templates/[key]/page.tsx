import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/adminAuth";
import { listTemplates, TEMPLATE_PLACEHOLDERS, TEMPLATE_KEYS } from "@/lib/emailTemplates";
import type { TemplateKey } from "@/lib/emailTemplates";
import EmailTemplateForm from "./EmailTemplateForm";

function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

export default async function AdminEmailTemplateDetailPage({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  if (!isTemplateKey(key)) notFound();

  const templates = await listTemplates();
  const template = templates.find((t) => t.key === key);
  if (!template) notFound();

  return (
    <div style={{ padding: 24 }}>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 22, marginBottom: 4 }}>
        {key}
      </h2>
      <p style={{ fontSize: 13, color: "#9c9c9c", marginBottom: 20 }}>
        Placeholders: {TEMPLATE_PLACEHOLDERS[key].map((p) => `{{${p}}}`).join(", ")}
      </p>
      <EmailTemplateForm
        templateKey={key}
        initialSubject={template.subject}
        initialBodyText={template.bodyText}
        initialBodyHtml={template.bodyHtml}
      />
    </div>
  );
}
