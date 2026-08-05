import Link from "next/link";
import { listCandidates, FUNNEL_STAGE_LABEL } from "@/lib/adminCandidates";

export default async function AdminCandidatesPage() {
  const candidates = await listCandidates();

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid #eee" }}>
          {["Name", "Email", "Latest role", "First seen", "Funnel stage"].map((label) => (
            <th
              key={label}
              className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
              style={{ padding: "10px 0", fontSize: 11, letterSpacing: "0.04em", textAlign: "left" }}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {candidates.map((c) => (
          <tr key={c.userId} style={{ borderBottom: "1px solid #eee" }}>
            <td style={{ padding: "10px 0", fontSize: 14 }}>
              <Link
                href={`/admin/candidates/${c.userId}`}
                className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
              >
                {c.name || "—"}
              </Link>
            </td>
            <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
              {c.email}
            </td>
            <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
              {c.latestRoleTitle}
            </td>
            <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
              {new Date(c.firstSeenAt).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" })}
            </td>
            <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
              {FUNNEL_STAGE_LABEL[c.funnelStage]}
            </td>
          </tr>
        ))}
        {candidates.length === 0 && (
          <tr>
            <td colSpan={5} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ padding: "24px 0", fontSize: 14, textAlign: "center" }}>
              No candidates yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
