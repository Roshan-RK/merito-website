import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { listTemplates } from "@/lib/emailTemplates";

export default async function AdminEmailTemplatesPage() {
  await requireAdmin();
  const templates = await listTemplates();

  return (
    <div style={{ padding: 24 }}>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 22, marginBottom: 16 }}>
        Email templates
      </h2>
      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>Key</th>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>Subject</th>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>Updated</th>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>By</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.key} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "12px 16px", fontSize: 14 }}>
                  <Link href={`/admin/email-templates/${t.key}`} style={{ color: "#ed1a24" }}>
                    {t.key}
                  </Link>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 14 }}>{t.subject}</td>
                <td style={{ padding: "12px 16px", fontSize: 14 }}>{new Date(t.updatedAt).toLocaleString()}</td>
                <td style={{ padding: "12px 16px", fontSize: 14 }}>{t.updatedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
