"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecruiterActions({ email, banned, verified, companyName }: { email: string; banned: boolean; verified: boolean; companyName: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"ban" | "unban" | "unverify" | "company" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [companyInput, setCompanyInput] = useState(companyName ?? "");

  async function callAction(action: "ban" | "unban" | "unverify", body?: unknown) {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/recruiters/${encodeURIComponent(email)}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
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

  async function saveCompany() {
    setBusy("company");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/recruiters/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyInput }),
      });
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

  function handleBan() {
    const reason = window.prompt("Reason for banning this recruiter?");
    if (!reason) return;
    if (!window.confirm(`Ban ${email}? They will no longer be able to use recruiter features.`)) return;
    callAction("ban", { reason });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {banned ? (
          <button onClick={() => callAction("unban")} disabled={busy !== null} style={{ background: "transparent", color: "#16803c", border: "1px solid #16803c", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
            {busy === "unban" ? "…" : "Unban"}
          </button>
        ) : (
          <button onClick={handleBan} disabled={busy !== null} style={{ background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
            {busy === "ban" ? "…" : "Ban"}
          </button>
        )}
        {verified && (
          <button onClick={() => callAction("unverify")} disabled={busy !== null} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
            {busy === "unverify" ? "…" : "Unverify"}
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          value={companyInput}
          onChange={(e) => setCompanyInput(e.target.value)}
          style={{ fontSize: 13, padding: "6px 10px", border: "1px solid #dcdcdc", borderRadius: 6 }}
        />
        <button onClick={saveCompany} disabled={busy !== null || companyInput === (companyName ?? "")} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
          {busy === "company" ? "…" : "Save company"}
        </button>
      </div>
      {message && <span style={{ fontSize: 12, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}
