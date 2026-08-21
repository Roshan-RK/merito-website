"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";
import type { AdminActionRow } from "@/lib/adminAuditLog";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function RecruiterActions({
  email,
  banned,
  verified,
  companyName,
  companyHistory,
}: {
  email: string;
  banned: boolean;
  verified: boolean;
  companyName: string | null;
  companyHistory: AdminActionRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"ban" | "unban" | "unverify" | "company" | null>(null);
  const [companyInput, setCompanyInput] = useState(companyName ?? "");
  const [pendingBanReason, setPendingBanReason] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  async function callAction(action: "ban" | "unban" | "unverify", body?: unknown) {
    setPendingBanReason(null);
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/recruiters/${encodeURIComponent(email)}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Done.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function saveCompany() {
    setBusy("company");
    try {
      const response = await fetch(`/api/admin/recruiters/${encodeURIComponent(email)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyInput }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        showToast("error", data?.error || "Something went wrong — try again.");
        return;
      }
      showToast("success", "Company saved.");
      router.refresh();
    } catch {
      showToast("error", "Something went wrong — try again.");
    } finally {
      setBusy(null);
    }
  }

  function handleBanClick() {
    const reason = window.prompt("Reason for banning this recruiter?");
    if (!reason) return;
    setPendingBanReason(reason);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {banned ? (
          <Button variant="secondary" onClick={() => callAction("unban")} disabled={busy !== null} loading={busy === "unban"}>
            Unban
          </Button>
        ) : (
          <Button variant="danger" onClick={handleBanClick} disabled={busy !== null} loading={busy === "ban"}>
            Ban
          </Button>
        )}
        {verified && (
          <Button variant="secondary" onClick={() => callAction("unverify")} disabled={busy !== null} loading={busy === "unverify"}>
            Unverify
          </Button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input
          value={companyInput}
          onChange={(e) => setCompanyInput(e.target.value)}
          className="font-[family-name:var(--font-poppins)]"
          style={{ fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7 }}
        />
        <Button variant="secondary" onClick={saveCompany} disabled={busy !== null || companyInput === (companyName ?? "")} loading={busy === "company"}>
          Save company
        </Button>
      </div>

      {companyHistory.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
            style={{ fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {showHistory ? "Hide" : "Show"} company edit history ({companyHistory.length})
          </button>
          {showHistory && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
              {companyHistory.map((row) => {
                const nv = row.newValue as { companyName?: string | null } | null;
                const pv = row.priorValue as { companyName: string | null } | null;
                return (
                  <div key={row.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <p className="font-[family-name:var(--font-poppins)] text-black" style={{ margin: "0 0 2px" }}>
                      {row.adminEmail} · {formatDateTime(row.createdAt)}
                    </p>
                    <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ margin: 0 }}>
                      Set companyName={nv?.companyName ?? "—"}
                    </p>
                    {pv && (
                      <button
                        onClick={() => setCompanyInput(pv.companyName ?? "")}
                        className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
                        style={{ fontSize: 11.5, background: "none", border: "none", padding: 0, marginTop: 6, cursor: "pointer" }}
                      >
                        Revert to value before this change
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
        open={pendingBanReason !== null}
        title="Ban this recruiter?"
        message={`They will no longer be able to use recruiter features. Reason: "${pendingBanReason}"`}
        confirmLabel="Ban"
        danger
        busy={busy === "ban"}
        onConfirm={() => pendingBanReason && callAction("ban", { reason: pendingBanReason })}
        onCancel={() => setPendingBanReason(null)}
      />
    </div>
  );
}
