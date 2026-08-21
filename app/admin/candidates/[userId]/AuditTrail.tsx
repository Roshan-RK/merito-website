import type { AdminActionRow } from "@/lib/adminAuditLog";

function formatActionLabel(action: string): string {
  const spaced = action.split(".").join(" ").split("_").join(" ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AuditTrail({ actions }: { actions: AdminActionRow[] }) {
  if (actions.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
        No admin actions recorded yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {actions.map((row) => (
        <div key={row.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ margin: "0 0 2px" }}>
            {formatActionLabel(row.action)}
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ margin: "0 0 4px" }}>
            {row.adminEmail} · {formatDateTime(row.createdAt)}
          </p>
          <pre
            className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]"
            style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {JSON.stringify(row.newValue)}
          </pre>
        </div>
      ))}
    </div>
  );
}
