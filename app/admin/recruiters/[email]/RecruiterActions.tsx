"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import ConfirmDialog from "@/app/admin/_components/ConfirmDialog";
import { useToast } from "@/app/admin/_components/Toast";

export default function RecruiterActions({ email, banned, verified, companyName }: { email: string; banned: boolean; verified: boolean; companyName: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<"ban" | "unban" | "unverify" | "company" | null>(null);
  const [companyInput, setCompanyInput] = useState(companyName ?? "");
  const [pendingBanReason, setPendingBanReason] = useState<string | null>(null);

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
