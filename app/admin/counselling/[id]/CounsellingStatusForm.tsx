"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CounsellingStatus } from "@/lib/adminCounselling";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";
import type { AdminActionRow } from "@/lib/adminAuditLog";

const STATUS_LABEL: Record<CounsellingStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CounsellingStatusForm({
  id,
  currentStatus,
  currentNotes,
  allowedNext,
  statusHistory,
}: {
  id: string;
  currentStatus: CounsellingStatus;
  currentNotes: string | null;
  allowedNext: CounsellingStatus[];
  statusHistory: AdminActionRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState<CounsellingStatus>(currentStatus);
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  if (allowedNext.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
        {STATUS_LABEL[currentStatus]} is final — no further status changes.
      </p>
    );
  }

  const isNoOp = status === currentStatus;

  async function handleSave() {
    setConfirmOpen(false);
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/counselling/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (response.ok) {
        showToast("success", "Counselling request updated.");
        router.refresh();
      } else {
        const body = await response.json().catch(() => null);
        showToast("error", body?.error ?? "Something went wrong — try again.");
      }
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20 }}>
      <label
        htmlFor="status-select"
        className="font-[family-name:var(--font-poppins)] font-semibold text-black"
        style={{ fontSize: 13, display: "block", marginBottom: 8 }}
      >
        Change status
      </label>
      <select
        id="status-select"
        value={status}
        onChange={(e) => setStatus(e.target.value as CounsellingStatus)}
        className="font-[family-name:var(--font-poppins)]"
        style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #eee", borderRadius: 7, marginBottom: 14 }}
      >
        <option value={currentStatus}>{STATUS_LABEL[currentStatus]} (current)</option>
        {!allowedNext.includes(status) && status !== currentStatus && <option value={status}>{STATUS_LABEL[status]} (from revert)</option>}
        {allowedNext.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <label
        htmlFor="notes"
        className="font-[family-name:var(--font-poppins)] font-semibold text-black"
        style={{ fontSize: 13, display: "block", marginBottom: 8 }}
      >
        Notes
      </label>
      <textarea
        id="notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        className="font-[family-name:var(--font-poppins)]"
        style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #eee", borderRadius: 7, marginBottom: 8, resize: "vertical" }}
      />

      {isNoOp && (
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "0 0 14px" }}>
          Choose a new status above to save a change.
        </p>
      )}

      <Button variant="primary" onClick={() => setConfirmOpen(true)} disabled={saving || isNoOp} loading={saving}>
        Save
      </Button>

      {statusHistory.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
            style={{ fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {showHistory ? "Hide" : "Show"} status change history ({statusHistory.length})
          </button>
          {showHistory && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {statusHistory.map((row) => {
                const nv = row.newValue as { status?: CounsellingStatus; notes?: string | null } | null;
                const pv = row.priorValue as { status: CounsellingStatus } | null;
                return (
                  <div key={row.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <p className="font-[family-name:var(--font-poppins)] text-black" style={{ margin: "0 0 2px" }}>
                      {row.adminEmail} · {formatDateTime(row.createdAt)}
                    </p>
                    <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ margin: 0 }}>
                      Set status={nv?.status ? STATUS_LABEL[nv.status] : "—"}
                    </p>
                    {pv && (
                      <button
                        onClick={() => setStatus(pv.status)}
                        className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
                        style={{ fontSize: 11.5, background: "none", border: "none", padding: 0, marginTop: 6, cursor: "pointer" }}
                      >
                        Revert to status before this change
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title="Change counselling status?"
        message={`This changes the status from "${STATUS_LABEL[currentStatus]}" to "${STATUS_LABEL[status]}".`}
        confirmLabel="Confirm"
        busy={saving}
        onConfirm={handleSave}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
