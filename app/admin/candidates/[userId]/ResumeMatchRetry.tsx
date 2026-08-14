"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResumeMatchRetry({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/retry-resume-match`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
      <button onClick={retry} disabled={busy} style={{ background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
        {busy ? "…" : "Retry"}
      </button>
      {message && <span style={{ fontSize: 12, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}
