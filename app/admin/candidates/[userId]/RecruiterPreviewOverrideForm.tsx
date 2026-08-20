"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/app/admin/_components/Button";
import Badge from "@/app/admin/_components/Badge";
import { useToast } from "@/app/admin/_components/Toast";
import { REPORT_TYPE_LABELS, type ReportType } from "@/app/hub/account/reportSections";
import type { AdminActionRow } from "@/lib/adminAuditLog";

const REPORT_TYPES = Object.keys(REPORT_TYPE_LABELS) as ReportType[];

const inputStyle = { fontSize: 13, padding: "8px 12px", border: "1px solid #dcdcdc", borderRadius: 7 } as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function RecruiterPreviewOverrideForm({
  userId,
  settings,
  overrideHistory,
}: {
  userId: string;
  settings: { enabled: boolean; sections: string[]; linkedinUrl: string | null; updatedAt: string } | null;
  overrideHistory: AdminActionRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [sections, setSections] = useState<Set<ReportType>>(new Set((settings?.sections ?? []) as ReportType[]));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  function toggleSection(section: ReportType) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }

  async function save() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/candidates/${userId}/recruiter-preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, sections: Array.from(sections), reason: reason.trim() }),
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
      <div className="flex items-center" style={{ gap: 10 }}>
        <label className="font-[family-name:var(--font-poppins)] flex items-center" style={{ fontSize: 13, gap: 6 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Visible to recruiters
        </label>
        {overrideHistory.length > 0 && <Badge variant="warning">Admin-overridden</Badge>}
      </div>

      {!settings?.linkedinUrl && (
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12 }}>
          No LinkedIn URL on file yet — visibility can&apos;t be enabled until the candidate adds one.
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {REPORT_TYPES.map((section) => (
          <label key={section} className="font-[family-name:var(--font-poppins)] flex items-center" style={{ fontSize: 13, gap: 6 }}>
            <input type="checkbox" checked={sections.has(section)} onChange={() => toggleSection(section)} />
            {REPORT_TYPE_LABELS[section]}
          </label>
        ))}
      </div>

      <input
        placeholder="Reason for this change"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="font-[family-name:var(--font-poppins)]"
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
      />

      <div>
        <Button variant="secondary" onClick={save} disabled={busy || !reason.trim()} loading={busy}>
          Save
        </Button>
      </div>

      {overrideHistory.length > 0 && (
        <div>
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
                const nv = row.newValue as { enabled?: boolean; sections?: string[]; reason?: string } | null;
                return (
                  <div key={row.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <p className="font-[family-name:var(--font-poppins)] text-black" style={{ margin: "0 0 2px" }}>
                      {row.adminEmail} · {formatDateTime(row.createdAt)}
                    </p>
                    <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ margin: 0 }}>
                      Set enabled={String(nv?.enabled)}, sections=[{(nv?.sections ?? []).join(", ")}] — {nv?.reason}
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
