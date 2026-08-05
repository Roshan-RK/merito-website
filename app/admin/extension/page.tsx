import { getLookupStats, listRecentLookups } from "@/lib/adminExtension";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminExtensionPage() {
  const [stats, lookups] = await Promise.all([getLookupStats(), listRecentLookups()]);

  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14, margin: "0 0 24px" }}>
        {stats.totalLookups} total lookups · {stats.matchedLookups} matched · {stats.last30DaysLookups} in the last 30 days
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            {["Candidate", "Date"].map((label) => (
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
          {lookups.map((l) => (
            <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {l.email ?? <span className="text-[#9c9c9c]">No match</span>}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatDate(l.createdAt)}
              </td>
            </tr>
          ))}
          {lookups.length === 0 && (
            <tr>
              <td colSpan={2} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ padding: "24px 0", fontSize: 14, textAlign: "center" }}>
                No lookups yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
