import Link from "next/link";
import { listContactRequests, type ContactRequestStatus } from "@/lib/adminContactRequests";

const STATUS_COLOR: Record<ContactRequestStatus, string> = {
  pending: "#c77700",
  approved: "#16803c",
  denied: "#9c9c9c",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminContactRequestsPage() {
  const requests = await listContactRequests();

  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #eee" }}>
            {["Candidate", "Role", "Status", "Requested"].map((label) => (
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
                <Link href={`/admin/contact-requests/${r.id}`} className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]">
                  {r.email}
                </Link>
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {r.roleTitle ?? "—"}
              </td>
              <td style={{ padding: "10px 0", fontSize: 13 }}>
                <span className="font-[family-name:var(--font-poppins)] font-semibold uppercase" style={{ color: STATUS_COLOR[r.status], fontSize: 11.5 }}>
                  {r.status}
                </span>
              </td>
              <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
                {formatDate(r.requestedAt)}
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr>
              <td colSpan={4} className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ padding: "24px 0", fontSize: 14, textAlign: "center" }}>
                No contact detail requests yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
