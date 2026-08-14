"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountActions({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"ban" | "unban" | "delete" | "magic-link" | "merge" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");

  function handleBan() {
    const reason = window.prompt("Reason for banning this candidate?");
    if (!reason) return;
    if (!window.confirm(`Ban ${email}? They will no longer be able to sign in.`)) return;
    run("ban", `/api/admin/candidates/${userId}/ban`, { reason });
  }

  function handleUnban() {
    run("unban", `/api/admin/candidates/${userId}/unban`);
  }

  function handleDelete() {
    if (!window.confirm(`Permanently delete ${email}'s account? This cannot be undone.`)) return;
    run("delete", `/api/admin/candidates/${userId}`, undefined, "DELETE");
  }

  async function handleMagicLink() {
    setBusy("magic-link");
    setMessage(null);
    setMagicLink(null);
    try {
      const response = await fetch(`/api/admin/candidates/${userId}/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "Something went wrong.");
        return;
      }
      setMagicLink(data.link);
    } finally {
      setBusy(null);
    }
  }

  function handleMerge() {
    if (!mergeTarget.trim()) return;
    if (!window.confirm(`Merge account ${mergeTarget.trim()} into ${email}? The merged-away account will be banned.`)) return;
    run("merge", "/api/admin/candidates/merge", { keepUserId: userId, mergeUserId: mergeTarget.trim() });
  }

  async function run(action: "ban" | "unban" | "delete" | "merge", url: string, body?: unknown, method: string = "POST") {
    setBusy(action);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button onClick={handleBan} disabled={busy !== null} style={{ background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
          {busy === "ban" ? "…" : "Ban"}
        </button>
        <button onClick={handleUnban} disabled={busy !== null} style={{ background: "transparent", color: "#16803c", border: "1px solid #16803c", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
          {busy === "unban" ? "…" : "Unban"}
        </button>
        <button onClick={handleDelete} disabled={busy !== null} style={{ background: "transparent", color: "#ed1a24", border: "1px solid #ed1a24", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
          {busy === "delete" ? "…" : "Delete account"}
        </button>
        <button onClick={handleMagicLink} disabled={busy !== null} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
          {busy === "magic-link" ? "…" : "Generate magic link"}
        </button>
      </div>
      {magicLink && (
        <input readOnly value={magicLink} onFocus={(e) => e.target.select()} style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #dcdcdc", borderRadius: 6, width: "100%" }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          placeholder="Other account's user ID to merge in"
          value={mergeTarget}
          onChange={(e) => setMergeTarget(e.target.value)}
          style={{ fontSize: 13, padding: "6px 10px", border: "1px solid #dcdcdc", borderRadius: 6, minWidth: 280 }}
        />
        <button onClick={handleMerge} disabled={busy !== null || !mergeTarget.trim()} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 12, padding: "4px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
          {busy === "merge" ? "…" : "Merge into this account"}
        </button>
      </div>
      {message && <span style={{ fontSize: 12, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}
