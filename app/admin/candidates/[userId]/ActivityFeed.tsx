import type { AdminActionRow } from "@/lib/adminAuditLog";
import type { CandidateNotificationRow } from "@/lib/adminCandidates";
import type { CandidatePaymentRow } from "@/lib/adminPayments";
import Badge, { type BadgeVariant } from "@/app/admin/_components/Badge";

function formatActionLabel(action: string): string {
  const spaced = action.split(".").join(" ").split("_").join(" ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatMoney(amountPaise: number): string {
  return `₹${(amountPaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PAYMENT_STATUS_VARIANT: Record<string, BadgeVariant> = {
  success: "success",
  failed: "danger",
  refunded: "warning",
  initiated: "neutral",
};

type TimelineEvent = {
  id: string;
  timestamp: string;
  badge: { label: string; variant: BadgeVariant };
  title: string;
  detail: string;
};

export default function ActivityFeed({
  adminActions,
  notifications,
  payments,
}: {
  adminActions: AdminActionRow[];
  notifications: CandidateNotificationRow[];
  payments: CandidatePaymentRow[];
}) {
  const events: TimelineEvent[] = [
    ...adminActions.map((row) => ({
      id: `admin:${row.id}`,
      timestamp: row.createdAt,
      badge: { label: "Admin", variant: "neutral" as BadgeVariant },
      title: formatActionLabel(row.action),
      detail: `${row.adminEmail} — ${JSON.stringify(row.newValue)}`,
    })),
    ...notifications.map((row) => ({
      id: `notification:${row.id}`,
      timestamp: row.createdAt,
      badge: { label: "Notification", variant: "success" as BadgeVariant },
      title: row.message,
      detail: `${row.createdBy ?? "system"} · ${row.category}${row.readAt ? " · read" : " · unread"}`,
    })),
    ...payments.map((row) => ({
      id: `payment:${row.orderId}`,
      timestamp: row.createdAt,
      badge: { label: row.status, variant: PAYMENT_STATUS_VARIANT[row.status] ?? "neutral" },
      title: `${row.product} (${row.level})${row.roleTitle ? ` — ${row.roleTitle}` : ""}`,
      detail: formatMoney(row.amountPaise),
    })),
  ].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  if (events.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
        No activity recorded yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {events.map((event) => (
        <div key={event.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
          <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
            <Badge variant={event.badge.variant}>{event.badge.label}</Badge>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ margin: 0 }}>
              {event.title}
            </p>
          </div>
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ margin: "0 0 4px" }}>
            {formatDateTime(event.timestamp)}
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ margin: 0, wordBreak: "break-word" }}>
            {event.detail}
          </p>
        </div>
      ))}
    </div>
  );
}
