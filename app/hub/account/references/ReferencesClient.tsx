"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReferenceCheckStatusResult, RefereeRole } from "@/lib/referenceChecks";
import { computeReferenceReport } from "@/lib/referenceChecks";

const ROLE_OPTIONS: { value: RefereeRole; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "team-lead", label: "Team lead" },
  { value: "teammate", label: "Teammate" },
  { value: "client", label: "Client" },
  { value: "faculty", label: "Faculty" },
  { value: "classmate", label: "Classmate" },
  { value: "internship-manager", label: "Internship manager" },
  { value: "internship-colleague", label: "Internship colleague" },
  { value: "other", label: "Other" },
];

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  completed: "Completed",
  rejected: "Declined",
};

export default function ReferencesClient({ initialStatus }: { initialStatus: ReferenceCheckStatusResult | null }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "manager" as RefereeRole, organization: "" });

  async function refreshStatus() {
    const res = await fetch("/api/hub/references/status");
    if (res.ok) {
      setStatus(await res.json());
    }
  }

  async function handleStart() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hub/references/initiate", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    await refreshStatus();
  }

  async function handleAddReferee(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/hub/references/add-referee", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    setForm({ name: "", email: "", role: "manager", organization: "" });
    await refreshStatus();
  }

  async function handleResend(refereeId: string, kind: "resend-invite" | "send-reminder") {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/hub/references/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refereeId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }
    await refreshStatus();
  }

  if (!status) {
    return (
      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 20, padding: 24 }}>
        <button
          onClick={handleStart}
          disabled={busy}
          className="font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 46, padding: "0 20px", borderRadius: 8, background: busy ? "#dcdcdc" : "#ed1a24", border: "none", cursor: busy ? "default" : "pointer" }}
        >
          {busy ? "Starting…" : "Start my reference check"}
        </button>
        {error && <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10 }}>{error}</p>}
      </div>
    );
  }

  const completedCount = status.referees.filter((r) => r.status === "completed").length;
  const isDone = status.status === "completed";
  const report = isDone ? computeReferenceReport(status.referees) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {report && (
        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 20, padding: 24 }}>
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: "0 0 4px" }}>
            Reference check report
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "0 0 16px" }}>
            Overall score: {report.overallScore.toFixed(1)} / 5 — based on {report.referees.length} completed reference{report.referees.length === 1 ? "" : "s"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {report.categoryScores.map((cat) => (
              <div key={cat.category} className="flex items-center" style={{ gap: 10 }}>
                <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, width: 160, flexShrink: 0 }}>
                  {cat.label}
                </span>
                <div style={{ flex: 1, height: 8, borderRadius: 50, background: "#f0e6ea" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 50,
                      width: `${(cat.value / 5) * 100}%`,
                      background: cat.value >= 4 ? "#16803c" : cat.value >= 3 ? "#ed1a24" : "#9c9c9c",
                    }}
                  />
                </div>
                <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12.5, width: 28, textAlign: "right" }}>
                  {cat.value > 0 ? cat.value.toFixed(1) : "—"}
                </span>
              </div>
            ))}
          </div>
          {report.referees.some((r) => r.overallFeedback?.trim()) && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {report.referees
                .filter((r) => r.overallFeedback?.trim())
                .map((r, i) => (
                  <div key={i} className="bg-[#fdeced]" style={{ borderRadius: 10, padding: "10px 14px" }}>
                    <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 12.5, fontStyle: "italic", margin: 0 }}>
                      &ldquo;{r.overallFeedback}&rdquo;
                    </p>
                    <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: "4px 0 0" }}>
                      — {r.name}{r.organization ? `, ${r.organization}` : ""}
                    </p>
                  </div>
                ))}
            </div>
          )}
          <Link
            href="/hub/account"
            className="font-[family-name:var(--font-poppins)] font-semibold text-white inline-flex items-center justify-center"
            style={{ height: 44, padding: "0 20px", borderRadius: 8, background: "#ed1a24", marginTop: 20, textDecoration: "none" }}
          >
            Done — back to dashboard
          </Link>
        </div>
      )}

      <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 20, padding: 24 }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: "0 0 12px" }}>
          {completedCount} of {status.minReferences} completed — status: {status.status}
        </p>
        {status.referees.map((referee) => (
          <div
            key={referee.id}
            className="flex items-center"
            style={{ gap: 10, padding: "10px 0", borderTop: "1px solid #f0e6ea" }}
          >
            <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, flex: 1 }}>
              {referee.name} ({referee.email})
            </span>
            <span className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12 }}>
              {STATUS_LABEL[referee.status]}
            </span>
            {referee.status === "pending" && (
              <>
                <button
                  onClick={() => handleResend(referee.id, "resend-invite")}
                  disabled={busy}
                  style={{ fontSize: 12, background: "none", border: "1px solid #dcdcdc", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                >
                  Resend
                </button>
                <button
                  onClick={() => handleResend(referee.id, "send-reminder")}
                  disabled={busy || referee.reminder_count >= 3}
                  style={{ fontSize: 12, background: "none", border: "1px solid #dcdcdc", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}
                >
                  Remind ({referee.reminder_count}/3)
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {!isDone && status.referees.length < 10 && (
        <form onSubmit={handleAddReferee} className="bg-white border border-black/[0.08]" style={{ borderRadius: 20, padding: 24, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            placeholder="Referee name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          />
          <input
            placeholder="Referee email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          />
          <input
            placeholder="Organization (optional)"
            value={form.organization}
            onChange={(e) => setForm({ ...form, organization: e.target.value })}
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as RefereeRole })}
            style={{ height: 42, borderRadius: 8, border: "1px solid #dcdcdc", padding: "0 12px", fontSize: 13 }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="font-[family-name:var(--font-poppins)] font-semibold text-white"
            style={{ height: 46, borderRadius: 8, background: busy ? "#dcdcdc" : "#ed1a24", border: "none", cursor: busy ? "default" : "pointer" }}
          >
            {busy ? "Adding…" : "Add referee"}
          </button>
        </form>
      )}

      {error && <p style={{ fontSize: 12.5, color: "#ed1a24" }}>{error}</p>}
    </div>
  );
}
