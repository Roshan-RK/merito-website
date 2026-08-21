"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REFERENCE_CATEGORIES, MAX_REMINDERS, type RefereeRow, type RefereeRole } from "@/lib/referenceChecks";
import type { AdminActionRow } from "@/lib/adminAuditLog";

const editInputStyle = { fontSize: 12.5, padding: "6px 10px", border: "1px solid #dcdcdc", borderRadius: 6, width: "100%", boxSizing: "border-box" } as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type RefereeContactValue = { name: string; email: string; phone: string | null; organization: string | null };

function EditContactForm({ referee, prefill, onDone }: { referee: RefereeRow; prefill?: RefereeContactValue; onDone: () => void }) {
  const router = useRouter();
  const initial = prefill ?? referee;
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [organization, setOrganization] = useState(initial.organization ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/referees/${referee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          organization: organization.trim() || null,
          reason: reason.trim(),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error || "Something went wrong — try again.");
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, padding: 12, background: "#fafafa", borderRadius: 8 }}>
      <input style={editInputStyle} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input style={editInputStyle} placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input style={editInputStyle} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input style={editInputStyle} placeholder="Organization" value={organization} onChange={(e) => setOrganization(e.target.value)} />
      <input style={editInputStyle} placeholder="Reason for this change" value={reason} onChange={(e) => setReason(e.target.value)} />
      {error && <span style={{ fontSize: 11.5, color: "#ed1a24" }}>{error}</span>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={save}
          disabled={busy || !reason.trim()}
          style={{ background: "#000", color: "#fff", border: "none", fontSize: 11.5, padding: "5px 10px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "…" : "Save"}
        </button>
        <button onClick={onDone} disabled={busy} style={{ background: "transparent", border: "1px solid #dcdcdc", fontSize: 11.5, padding: "5px 10px", borderRadius: 6, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function OverrideHistory({ history, onRevert }: { history: AdminActionRow[]; onRevert: (value: RefereeContactValue) => void }) {
  const [show, setShow] = useState(false);
  if (history.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <button
        onClick={() => setShow((v) => !v)}
        className="text-[#ed1a24]"
        style={{ fontSize: 11.5, background: "none", border: "none", padding: 0, cursor: "pointer" }}
      >
        {show ? "Hide" : "Show"} edit history ({history.length})
      </button>
      {show && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
          {history.map((row) => {
            const nv = row.newValue as { name?: string; email?: string; phone?: string | null; organization?: string | null; reason?: string } | null;
            const pv = row.priorValue as RefereeContactValue | null;
            return (
              <div key={row.id}>
                <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, margin: 0 }}>
                  {row.adminEmail} · {formatDateTime(row.createdAt)} — set email={nv?.email}, phone={nv?.phone ?? "—"} — {nv?.reason}
                </p>
                {pv && (
                  <button
                    onClick={() => onRevert(pv)}
                    className="text-[#ed1a24]"
                    style={{ fontSize: 11.5, background: "none", border: "none", padding: 0, marginTop: 2, cursor: "pointer" }}
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
  );
}

const ROLE_LABEL: Record<RefereeRole, string> = {
  faculty: "Faculty",
  classmate: "Classmate",
  "internship-colleague": "Internship colleague",
  "internship-manager": "Internship manager",
  manager: "Manager",
  "team-lead": "Team lead",
  teammate: "Teammate",
  client: "Client",
  other: "Other",
};

const STATUS_LABEL: Record<RefereeRow["status"], string> = {
  pending: "Pending",
  completed: "Completed",
  rejected: "Declined",
};

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(REFERENCE_CATEGORIES.map((c) => [c.value, c.label]));

function ResetRemindersButton({ refereeId, reminderCount }: { refereeId: string; reminderCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reset() {
    if (!window.confirm("Reset reminder count to 0 and re-admit this referee to the reminder sweep?")) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/referees/${refereeId}/reset-reminders`, { method: "POST" });
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 11.5, color: reminderCount >= MAX_REMINDERS ? "#ed1a24" : "#9c9c9c" }}>
        {reminderCount}/{MAX_REMINDERS} reminders sent
      </span>
      <button onClick={reset} disabled={busy} style={{ background: "transparent", color: "#4b4b4d", border: "1px solid #dcdcdc", fontSize: 11.5, padding: "3px 8px", borderRadius: 6, cursor: busy ? "default" : "pointer" }}>
        {busy ? "…" : "Reset reminders"}
      </button>
      {message && <span style={{ fontSize: 11.5, color: "#4b4b4d" }}>{message}</span>}
    </div>
  );
}

export default function RefereeSummary({ referees }: { referees: (RefereeRow & { overrideHistory: AdminActionRow[] })[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revertValue, setRevertValue] = useState<RefereeContactValue | null>(null);

  if (referees.length === 0) {
    return (
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13 }}>
        No referees added yet.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {referees.map((r) => (
        <div key={r.id} className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: "14px 16px" }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginBottom: 6 }}>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: 0 }}>
              {r.name}
              <span className="text-[#9c9c9c]" style={{ fontWeight: 400 }}> · {ROLE_LABEL[r.role]}</span>
              {r.organization && <span className="text-[#9c9c9c]" style={{ fontWeight: 400 }}> · {r.organization}</span>}
            </p>
            <span
              className={r.status === "completed" ? "text-[#16803c]" : r.status === "rejected" ? "text-[#ed1a24]" : "text-[#c77700]"}
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </div>
          {r.status === "completed" && r.ratings && r.ratings.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, margin: "8px 0" }}>
              {r.ratings.map((rt) => (
                <p key={rt.category} className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, margin: 0 }}>
                  {CATEGORY_LABEL[rt.category] ?? rt.category}: <strong className="text-black">{rt.value}</strong>
                </p>
              ))}
            </div>
          )}
          {r.status === "completed" && r.overall_feedback && (
            <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>
              &ldquo;{r.overall_feedback}&rdquo;
            </p>
          )}
          {r.status === "pending" && <ResetRemindersButton refereeId={r.id} reminderCount={r.reminder_count} />}

          {editingId === r.id ? (
            <EditContactForm
              referee={r}
              prefill={revertValue ?? undefined}
              onDone={() => {
                setEditingId(null);
                setRevertValue(null);
              }}
            />
          ) : (
            <button
              onClick={() => {
                setRevertValue(null);
                setEditingId(r.id);
              }}
              className="text-[#ed1a24]"
              style={{ fontSize: 11.5, background: "none", border: "none", padding: 0, marginTop: 8, cursor: "pointer" }}
            >
              Edit contact info
            </button>
          )}
          <OverrideHistory
            history={r.overrideHistory}
            onRevert={(value) => {
              setRevertValue(value);
              setEditingId(r.id);
            }}
          />
        </div>
      ))}
    </div>
  );
}
