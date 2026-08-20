import { notFound } from "next/navigation";
import { listTemplates, TEMPLATE_PLACEHOLDERS, TEMPLATE_KEYS } from "@/lib/emailTemplates";
import type { TemplateKey } from "@/lib/emailTemplates";
import EmailTemplateForm from "./EmailTemplateForm";

function isTemplateKey(value: string): value is TemplateKey {
  return (TEMPLATE_KEYS as readonly string[]).includes(value);
}

export default async function AdminEmailTemplateDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!isTemplateKey(key)) notFound();

  const templates = await listTemplates();
  const template = templates.find((t) => t.key === key);
  if (!template) notFound();

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        {key}
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 32px" }}>
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
