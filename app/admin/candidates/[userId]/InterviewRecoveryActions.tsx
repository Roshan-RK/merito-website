"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function InterviewRecoveryActions({ interviewId, status }: { interviewId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"generate" | "reinvite" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: "generate" | "reinvite") {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/interviews/${interviewId}/${action}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setMessage(action === "generate" ? "Report generation requested." : `Reinvited (${data.invited} sent).`);
      router.refresh();
    } catch {
      setMessage("Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12 }}>
        Status: {status}
      </span>
      <button
        onClick={() => run("generate")}
        disabled={busy !== null}
        className="font-[family-name:var(--font-poppins)] font-semibold"
        style={{ background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}
      >
        {busy === "generate" ? "…" : "Generate report"}
      </button>
      <button
        onClick={() => run("reinvite")}
        disabled={busy !== null}
        className="font-[family-name:var(--font-poppins)] font-semibold"
        style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}
      >
        {busy === "reinvite" ? "…" : "Reinvite candidate"}
      </button>
      {message && (
        <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, color: "#4b4b4d" }}>
          {message}
        </span>
      )}
    </div>
  );
}
