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

export default function CandidateProfileOverrideForm({
  userId,
  phoneNumber,
  location,
  totalExperience,
  overrideHistory,
}: {
  userId: string;
  phoneNumber: string | null;
  location: string | null;
  totalExperience: number | null;
  overrideHistory: AdminActionRow[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(phoneNumber ?? "");
  const [loc, setLoc] = useState(location ?? "");
  const [experience, setExperience] = useState(totalExperience === null ? "" : String(totalExperience));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  async function save() {
    if (!reason.trim()) return;
    const parsedExperience = experience.trim() === "" ? null : Number(experience);
    if (parsedExperience !== null && !Number.isFinite(parsedExperience)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/candidates/${userId}/profile-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone.trim() || null,
          location: loc.trim() || null,
          totalExperience: parsedExperience,
          reason: reason.trim(),
        }),
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
    <div>
      <div className="flex items-center" style={{ gap: 10 }}>
        {overrideHistory.length > 0 && <Badge variant="warning">Admin-overridden</Badge>}
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
          style={{ fontSize: 12, background: "none", border: "none", padding: 0, cursor: "pointer" }}
        >
          {open ? "Cancel" : "Override phone/location/experience"}
        </button>
      </div>

      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "6px 0 0" }}>
        Fetched fresh from IntervueBox on every page load — an override here always wins over that live fetch.
      </p>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 480, marginTop: 10 }}>
          <label className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
          </label>
          <label className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Location
            <input value={loc} onChange={(e) => setLoc(e.target.value)} style={inputStyle} />
          </label>
          <label className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            Total experience (years)
            <input type="number" min={0} step={0.1} value={experience} onChange={(e) => setExperience(e.target.value)} style={inputStyle} />
          </label>
          <input
            placeholder="Reason for this change"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="font-[family-name:var(--font-poppins)]"
            style={inputStyle}
          />
          <div>
            <Button variant="secondary" onClick={save} disabled={busy || !reason.trim()} loading={busy}>
              Save override
            </Button>
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
                const nv = row.newValue as { phoneNumber?: string | null; location?: string | null; totalExperience?: number | null; reason?: string } | null;
                const pv = row.priorValue as { phoneNumber: string | null; location: string | null; totalExperience: number | null } | null;
                return (
                  <div key={row.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <p className="font-[family-name:var(--font-poppins)] text-black" style={{ margin: "0 0 2px" }}>
                      {row.adminEmail} · {formatDateTime(row.createdAt)}
                    </p>
                    <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ margin: 0 }}>
                      Set phone={nv?.phoneNumber ?? "—"}, location={nv?.location ?? "—"}, experience={nv?.totalExperience ?? "—"} — {nv?.reason}
                    </p>
                    {pv && (
                      <button
                        onClick={() => {
                          setPhone(pv.phoneNumber ?? "");
                          setLoc(pv.location ?? "");
                          setExperience(pv.totalExperience === null ? "" : String(pv.totalExperience));
                          setOpen(true);
                        }}
                        className="font-[family-name:var(--font-poppins)] text-[#ed1a24]"
                        style={{ fontSize: 11.5, background: "none", border: "none", padding: 0, marginTop: 6, cursor: "pointer" }}
                      >
                        Revert to values before this change
                      </button>
                    )}
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
