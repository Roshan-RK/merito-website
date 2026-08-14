import Link from "next/link";
import { requireAdmin } from "@/lib/adminAuth";
import { listRecruiters } from "@/lib/adminRecruiters";

export default async function AdminRecruitersPage() {
  await requireAdmin();
  const recruiters = await listRecruiters();

  return (
    <div style={{ padding: 24 }}>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 22, marginBottom: 16 }}>
        Recruiters
      </h2>
      <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #eee" }}>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>Email</th>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>Company</th>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>Verified</th>
              <th style={{ padding: "12px 16px", fontSize: 11, textAlign: "left" }}>Banned</th>
            </tr>
          </thead>
          <tbody>
            {recruiters.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#9c9c9c", fontSize: 14 }}>
                  No recruiters yet.
                </td>
              </tr>
            ) : (
              recruiters.map((r) => (
                <tr key={r.email} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>
                    <Link href={`/admin/recruiters/${encodeURIComponent(r.email)}`} style={{ color: "#ed1a24" }}>
                      {r.email}
                    </Link>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{r.companyName ?? "—"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{r.verifiedAt ? "Yes" : "No"}</td>
                  <td style={{ padding: "12px 16px", fontSize: 14 }}>{r.bannedAt ? "Yes" : "No"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
