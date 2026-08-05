import Link from "next/link";
import { listCounsellingRequests, type CounsellingStatus } from "@/lib/adminCounselling";

const STATUS_COLOR: Record<CounsellingStatus, string> = {
  requested: "#c77700",
  scheduled: "#1a56db",
  completed: "#16803c",
  cancelled: "#9c9c9c",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminCounsellingPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  const { all } = await searchParams;
  const includeAll = all === "1";
  const requests = await listCounsellingRequests(includeAll);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: 0 }}>
          {includeAll ? "All requests" : "Active queue (requested + scheduled)"}
        </p>
        <Link
          href={includeAll ? "/admin/counselling" : "/admin/counselling?all=1"}
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13 }}
        >
          {includeAll ? "Show active only" : "Show all"}
        </Link>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            {["Candidate", "Order", "Status", "Requested", "Scheduled"].map((label) => (
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
          {requests.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: "10px 0", fontSize: 14 }}>
                <Link href={`/admin/counselling/${r.id}`} className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]">
                  {r.email}
                </Link>
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {r.orderId}
              </td>
              <td style={{ padding: "10px 0", fontSize: 13 }}>
                <span className="font-[family-name:var(--font-poppins)] font-semibold uppercase" style={{ color: STATUS_COLOR[r.status], fontSize: 11.5 }}>
                  {r.status}
                </span>
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatDate(r.requestedAt)}
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatDate(r.scheduledAt)}
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td colSpan={5} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ padding: "24px 0", fontSize: 14, textAlign: "center" }}>
                {includeAll ? "No counselling requests yet." : "Queue is empty — nothing to schedule."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
