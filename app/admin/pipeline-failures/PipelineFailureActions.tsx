"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PipelineFailureActions({ id, kind }: { id: string; kind: "interview_invite_after_payment" | "orphaned_ib_job" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "discard" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "retry-interview" | "discard", label: "retry" | "discard") {
    if (!window.confirm(`${label === "retry" ? "Retry" : "Discard"} this pipeline failure?`)) return;
    setBusy(label);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/pipeline-failures/${id}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {kind === "interview_invite_after_payment" && (
        <button onClick={() => run("retry-interview", "retry")} disabled={busy !== null} style={{ background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
          {busy === "retry" ? "…" : "Retry interview"}
        </button>
      )}
      <button onClick={() => run("discard", "discard")} disabled={busy !== null} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
        {busy === "discard" ? "…" : "Discard"}
      </button>
      {message && <span style={{ fontSize: 12, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}
