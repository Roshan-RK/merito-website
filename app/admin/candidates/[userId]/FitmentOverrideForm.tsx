"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import Badge from "@/app/admin/_components/Badge";
import { useToast } from "@/app/admin/_components/Toast";
import type { AdminActionRow } from "@/lib/adminAuditLog";

const inputStyle = { fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7, width: "100%", boxSizing: "border-box" } as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function FitmentOverrideForm({
  leadId,
  overallScore,
  summary,
  overridden,
  overrideHistory,
}: {
  leadId: string;
  overallScore: number;
  summary: string;
  overridden: boolean;
  overrideHistory: AdminActionRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(String(overallScore));
  const [text, setText] = useState(summary);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function save() {
    const parsed = Number(score);
    if (!reason.trim() || !Number.isFinite(parsed)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/fitment-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overallScore: parsed, summary: text, reason: reason.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      setReason("");
      showToast("success", "Saved.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function clearOverride() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/fitment-override`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      setReason("");
      showToast("success", "Override cleared — retry is available again.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div className="flex items-center" style={{ gap: 10 }}>
        {overridden && <Badge variant="warning">Admin-overridden</Badge>}
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
          style={{ fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {open ? "Cancel" : "Override score/summary"}
        </button>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480, marginTop: 10 }}>
          <label className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Overall score (0-100)
            <input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} style={inputStyle} />
          </label>
          <label className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Summary
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} style={inputStyle} />
          </label>
          <input
            placeholder="Reason for this change"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="font-[family-name:var(--font-poppins)]"
            style={inputStyle}
          />
          <div className="flex items-center" style={{ gap: 8 }}>
            <Button variant="secondary" onClick={save} disabled={busy || !reason.trim()} loading={busy}>
              Save override
            </Button>
            {overridden && (
              <Button variant="danger" onClick={clearOverride} disabled={busy || !reason.trim()}>
                Clear override
              </Button>
            )}
          </div>
        </div>
      )}

      {overrideHistory.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
            style={{ fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {showHistory ? "Hide" : "Show"} override history ({overrideHistory.length})
          </button>
          {showHistory && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {overrideHistory.map((row) => {
                const nv = row.newValue as { overallScore?: number; summary?: string; overridden?: boolean; reason?: string } | null;
                return (
                  <div key={row.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <p className="font-[family-name:var(--font-poppins)] text-black" style={{ margin: "0 0 2px" }}>
                      {row.adminEmail} · {formatDateTime(row.createdAt)}
                    </p>
                    <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ margin: 0 }}>
                      {row.action === "candidate.fitment_override_cleared"
                        ? `Cleared override — ${nv?.reason}`
                        : `Set overallScore=${nv?.overallScore}, summary="${nv?.summary}" — ${nv?.reason}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
