import { notFound } from "next/navigation";
import { getCounsellingRequest, ALLOWED_TRANSITIONS } from "@/lib/adminCounselling";
import { listActionsForTarget } from "@/lib/adminAuditLog";
import CounsellingStatusForm from "./CounsellingStatusForm";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

export default async function AdminCounsellingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const request = await getCounsellingRequest(id);

  if (!request) {
    notFound();
  }

  const statusHistory = (await listActionsForTarget("counselling_request", id)).filter((row) => row.action === "counselling.status_change");

  return (
    <div>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 4px" }}>
        {request.email}
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 28px" }}>
        Order {request.orderId} · Requested {formatDate(request.requestedAt)}
        {request.scheduledAt && ` · Scheduled ${formatDate(request.scheduledAt)}`}
        {request.completedAt && ` · Completed ${formatDate(request.completedAt)}`}
      </p>

      <CounsellingStatusForm
        id={request.id}
        currentStatus={request.status}
        currentNotes={request.notes}
        allowedNext={ALLOWED_TRANSITIONS[request.status]}
        statusHistory={statusHistory}
      />
    </div>
  );
}
