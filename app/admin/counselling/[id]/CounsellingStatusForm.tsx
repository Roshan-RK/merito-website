"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CounsellingStatus } from "@/lib/adminCounselling";

const STATUS_LABEL: Record<CounsellingStatus, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function CounsellingStatusForm({
  id,
  currentStatus,
  currentNotes,
  allowedNext,
}: {
  id: string;
  currentStatus: CounsellingStatus;
  currentNotes: string | null;
  allowedNext: CounsellingStatus[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<CounsellingStatus>(allowedNext[0] ?? currentStatus);
  const [notes, setNotes] = useState(currentNotes ?? "");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (allowedNext.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
        {STATUS_LABEL[currentStatus]} is final — no further status changes.
      </p>
    );
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMessage(null);
    try {
      const response = await fetch(`/api/admin/counselling/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (response.ok) {
        router.refresh();
        setSaveState("idle");
      } else {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.error ?? "Something went wrong — please try again.");
        setSaveState("error");
      }
    } catch {
      setErrorMessage("Something went wrong — please try again.");
      setSaveState("error");
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
        style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #eee", borderRadius: 7, marginBottom: 14, resize: "vertical" }}
      />

      <button
        onClick={handleSave}
        disabled={saveState === "saving"}
        className="font-[family-name:var(--font-poppins)] font-semibold"
        style={{ background: "#ed1a24", color: "#fff", border: "none", fontSize: 14, padding: "9px 20px", borderRadius: 7, cursor: "pointer" }}
      >
        {saveState === "saving" ? "Saving…" : "Save"}
      </button>

      {saveState === "error" && errorMessage && (
        <p className="font-[family-name:var(--font-poppins)] text-[#ed1a24]" style={{ fontSize: 12.5, margin: "10px 0 0" }}>
          {errorMessage}
        </p>
      )}
    </div>
  );
}
