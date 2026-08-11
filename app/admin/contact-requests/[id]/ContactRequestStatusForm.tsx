"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContactRequestStatus } from "@/lib/adminContactRequests";

const STATUS_LABEL: Record<ContactRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
};

export default function ContactRequestStatusForm({
  id,
  currentStatus,
  allowedNext,
}: {
  id: string;
  currentStatus: ContactRequestStatus;
  allowedNext: ContactRequestStatus[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ContactRequestStatus>((allowedNext[0] as ContactRequestStatus) ?? currentStatus);
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
      const response = await fetch(`/api/admin/contact-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
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
        onChange={(e) => setStatus(e.target.value as ContactRequestStatus)}
        className="font-[family-name:var(--font-poppins)]"
        style={{ width: "100%", padding: "9px 12px", fontSize: 14, border: "1px solid #eee", borderRadius: 7, marginBottom: 14 }}
      >
        {allowedNext.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>

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
