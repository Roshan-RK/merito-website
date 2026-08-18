"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  Building2,
  RotateCw,
  BellRing,
  CheckCircle2,
  Clock3,
  XCircle,
  Quote,
  TrendingUp,
  TrendingDown,
  Download,
} from "lucide-react";
import type { ComponentType } from "react";
import ExportPreviewButton from "../ExportPreviewButton";
import {
  MAX_REFEREES,
  MAX_REMINDERS,
  REFERENCE_CATEGORIES,
  computeReferenceReport,
  type ReferenceCheckStatusResult,
  type RefereeRole,
} from "@/lib/referenceChecks";
import ReferenceScoreGauge, { getReferenceScoreBand } from "./ReferenceScoreGauge";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";
const CARD = "bg-[rgb(29,25,31)] border border-[rgb(49,47,55)]";
const INPUT = "bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-white/25 outline-none focus:border-[#ed1a24] transition-colors";
const LABEL = "font-[family-name:var(--font-poppins)] font-semibold text-white/50";

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

function roleLabel(role: RefereeRole): string {
  return ROLE_OPTIONS.find((opt) => opt.value === role)?.label ?? role;
}

const STATUS_META: Record<string, { label: string; icon: ComponentType<{ size?: number; strokeWidth?: number }>; color: string; bg: string }> = {
  pending: { label: "Pending", icon: Clock3, color: "#BD7E12", bg: "rgba(189,126,18,0.12)" },
  completed: { label: "Completed", icon: CheckCircle2, color: "#3FCB8C", bg: "rgba(63,203,140,0.12)" },
  rejected: { label: "Declined", icon: XCircle, color: "#E8798F", bg: "rgba(232,121,143,0.12)" },
};

function StatusPill({ status }: { status: "pending" | "completed" | "rejected" }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className="flex items-center shrink-0 font-[family-name:var(--font-poppins)] font-semibold"
      style={{ gap: 5, fontSize: 11, color: meta.color, background: meta.bg, borderRadius: 999, padding: "5px 10px" }}
    >
      <Icon size={11} strokeWidth={2.5} />
      {meta.label}
    </span>
  );
}

export default function ReferencesClient({ initialStatus }: { initialStatus: ReferenceCheckStatusResult | null }) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "manager" as RefereeRole, organization: "" });
  const formId = useId();

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
      <div className={CARD} style={{ borderRadius: 14, padding: 24 }}>
        <div className="flex items-center" style={{ gap: 12, marginBottom: 12 }}>
          <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 40, height: 40, borderRadius: 10 }}>
            <Users size={19} strokeWidth={2} />
          </div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.4rem", margin: 0 }}>
            Reference checks
          </h1>
        </div>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, lineHeight: 1.65, margin: "0 0 16px" }}>
          Invite people who&apos;ve worked with you to rate you across {REFERENCE_CATEGORIES.length} categories, for independent, verified
          feedback rather than a self-assessment.
        </p>
        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 20 }}>
          {[`${REFERENCE_CATEGORIES.length} categories`, `Up to ${MAX_REFEREES} referees`, "Verified feedback"].map((b) => (
            <span
              key={b}
              className="bg-white/[0.05] border border-white/[0.08] font-[family-name:var(--font-poppins)] text-white/60"
              style={{ fontSize: 12, borderRadius: 999, padding: "6px 13px" }}
            >
              {b}
            </span>
          ))}
        </div>
        <button
          onClick={handleStart}
          disabled={busy}
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
          style={{ gap: 8, height: 48, padding: "0 24px", borderRadius: 8, fontSize: 14.5, border: "none", cursor: busy ? "default" : "pointer" }}
        >
          <UserPlus size={15} strokeWidth={2} />
          {busy ? "Starting…" : "Start my reference check"}
        </button>
        {error && (
          <p role="alert" style={{ fontSize: 12.5, color: "#E8798F", marginTop: 14 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  const completedCount = status.referees.filter((r) => r.status === "completed").length;
  const isDone = status.status === "completed";
  const report = isDone ? computeReferenceReport(status.referees) : null;

  const scoredCategories = report ? report.categoryScores.filter((c) => c.value > 0).sort((a, b) => b.value - a.value) : [];
  const strongest = scoredCategories[0] ?? null;
  const growth = scoredCategories.length > 1 ? scoredCategories[scoredCategories.length - 1] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {report && (
        <>
          <div className={CARD} style={{ borderRadius: 14, padding: 24 }}>
            <div className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 22 }}>
              <div className="flex items-center" style={{ gap: 10 }}>
                <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 8 }}>
                  <Users size={17} strokeWidth={2} />
                </div>
                <div>
                  <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 15, margin: 0 }}>
                    Reference check report
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12, margin: "2px 0 0" }}>
                    Based on {report.referees.length} completed reference{report.referees.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="print:hidden flex items-center flex-wrap" style={{ gap: 10 }}>
                <span
                  className="font-[family-name:var(--font-poppins)] font-semibold"
                  style={{ fontSize: 11, color: "#3FCB8C", background: "rgba(63,203,140,0.12)", borderRadius: 999, padding: "5px 12px" }}
                >
                  Completed
                </span>
                <ExportPreviewButton exportUrl="/api/hub/references/export" title="Reference check report" />
                <a
                  href="/api/hub/references/export"
                  download
                  className="flex items-center hover:bg-white/[0.06] transition-colors font-[family-name:var(--font-poppins)] font-medium text-white"
                  style={{ gap: 6, fontSize: 12, borderRadius: 12, padding: "7px 12px", background: "rgb(21,18,22)", border: "1px solid rgb(49,47,55)" }}
                >
                  <Download size={13} strokeWidth={2} /> Download
                </a>
              </div>
            </div>

            <div className="flex flex-col items-center sm:flex-row sm:items-start" style={{ gap: 28 }}>
              <ReferenceScoreGauge score={report.overallScore} />
              <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                {strongest && (
                  <div
                    className="flex items-center"
                    style={{ gap: 10, borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(63,203,140,0.25)", background: "rgba(63,203,140,0.08)" }}
                  >
                    <TrendingUp size={15} strokeWidth={2} style={{ color: "#3FCB8C", flexShrink: 0 }} />
                    <span className="font-[family-name:var(--font-poppins)] text-white/80" style={{ fontSize: 12.5 }}>
                      <span style={{ fontWeight: 700, color: "#3FCB8C" }}>Strongest &mdash;</span> {strongest.label} ({strongest.value.toFixed(1)})
                    </span>
                  </div>
                )}
                {growth &&
                  (() => {
                    const band = getReferenceScoreBand(growth.value);
                    return (
                      <div
                        className="flex items-center"
                        style={{ gap: 10, borderRadius: 10, padding: "12px 14px", border: `1px solid ${band.textColor}40`, background: `${band.textColor}14` }}
                      >
                        <TrendingDown size={15} strokeWidth={2} style={{ color: band.textColor, flexShrink: 0 }} />
                        <span className="font-[family-name:var(--font-poppins)] text-white/80" style={{ fontSize: 12.5 }}>
                          <span style={{ fontWeight: 700, color: band.textColor }}>Growth area &mdash;</span> {growth.label} ({growth.value.toFixed(1)})
                        </span>
                      </div>
                    );
                  })()}
              </div>
            </div>
          </div>

          <div className={CARD} style={{ borderRadius: 14, padding: 22 }}>
            <p className={EYEBROW} style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 16px" }}>
              Category breakdown
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {report.categoryScores.map((cat) => {
                const band = getReferenceScoreBand(cat.value);
                return (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="font-[family-name:var(--font-poppins)] text-white/75" style={{ fontSize: 13 }}>
                        {cat.label}
                      </span>
                      <span
                        className="font-[family-name:var(--font-poppins)] font-semibold"
                        style={{ fontSize: 13, color: cat.value > 0 ? band.textColor : "rgba(255,255,255,0.3)" }}
                      >
                        {cat.value > 0 ? cat.value.toFixed(1) : "-"}
                      </span>
                    </div>
                    <div className="bg-white/[0.08] overflow-hidden" style={{ height: 8, borderRadius: 6 }}>
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 6,
                          width: `${(cat.value / 5) * 100}%`,
                          background: cat.value > 0 ? band.textColor : "transparent",
                          transition: "width 600ms cubic-bezier(0.23,1,0.32,1)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <p className={EYEBROW} style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 12px" }}>
              References
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {report.referees.map((r, i) => (
                <div key={i} className={CARD} style={{ borderRadius: 14, padding: 18 }}>
                  <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginBottom: r.organization ? 4 : 10 }}>
                    <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13.5 }}>
                      {r.name}
                    </span>
                    <span
                      className="font-[family-name:var(--font-poppins)] font-semibold"
                      style={{ fontSize: 10.5, color: "#ed1a24", background: "rgba(237,26,36,0.12)", borderRadius: 999, padding: "3px 10px" }}
                    >
                      {roleLabel(r.role)}
                    </span>
                  </div>
                  {r.organization && (
                    <p className="font-[family-name:var(--font-poppins)] text-white/35" style={{ fontSize: 11.5, margin: "0 0 10px" }}>
                      {r.organization}
                    </p>
                  )}
                  {r.overallFeedback?.trim() ? (
                    <p className="flex items-start font-[family-name:var(--font-poppins)] text-white/65" style={{ gap: 8, fontSize: 13, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
                      <Quote size={14} strokeWidth={2} className="text-white/20 shrink-0" style={{ marginTop: 2 }} />
                      {r.overallFeedback}
                    </p>
                  ) : (
                    <p className="font-[family-name:var(--font-poppins)] text-white/30" style={{ fontSize: 12.5, fontStyle: "italic", margin: 0 }}>
                      No written feedback provided.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Link
            href="/hub/account"
            className="inline-flex items-center justify-center self-start font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
            style={{ height: 46, padding: "0 24px", borderRadius: 8, fontSize: 14, textDecoration: "none" }}
          >
            Done, back to dashboard
          </Link>
        </>
      )}

      {!isDone && (
        <div className={CARD} style={{ borderRadius: 14, padding: 20 }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 10, marginBottom: 12 }}>
            <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem", margin: 0 }}>
              {completedCount} of {status.minReferences} completed
            </p>
            <span
              className="font-[family-name:var(--font-poppins)] font-semibold uppercase text-white/40"
              style={{ fontSize: 10.5, letterSpacing: "0.04em" }}
            >
              status: {status.status.replace("_", " ")}
            </span>
          </div>
          <div className="bg-white/[0.08] overflow-hidden" style={{ height: 8, borderRadius: 6 }}>
            <div
              className="bg-[#ed1a24] h-full"
              style={{ borderRadius: 6, width: `${Math.min(100, (completedCount / status.minReferences) * 100)}%`, transition: "width 600ms ease" }}
            />
          </div>
        </div>
      )}

      {!isDone && status.referees.length > 0 && (
        <div className={CARD} style={{ borderRadius: 14, padding: "6px 20px" }}>
          {status.referees.map((referee, idx) => (
            <div
              key={referee.id}
              className={idx === 0 ? "flex items-center flex-wrap" : "flex items-center flex-wrap border-t border-white/[0.08]"}
              style={{ gap: 12, padding: "14px 0" }}
            >
              <div
                className="flex items-center justify-center bg-white/[0.06] text-white/70 font-[family-name:var(--font-poppins)] font-bold shrink-0"
                style={{ width: 34, height: 34, borderRadius: "50%", fontSize: 13 }}
              >
                {referee.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-white truncate" style={{ fontSize: 13.5, margin: 0 }}>
                  {referee.name}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/40 truncate" style={{ fontSize: 12, margin: "2px 0 0" }}>
                  {referee.email} · {roleLabel(referee.role)}
                  {referee.organization ? ` · ${referee.organization}` : ""}
                </p>
              </div>
              <StatusPill status={referee.status} />
              {referee.status === "pending" && (
                <div className="flex items-center shrink-0" style={{ gap: 6 }}>
                  <button
                    onClick={() => handleResend(referee.id, "resend-invite")}
                    disabled={busy}
                    className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white/70 hover:text-white hover:border-white/25 transition-colors"
                    style={{ gap: 5, fontSize: 11.5, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 10px", cursor: busy ? "default" : "pointer" }}
                  >
                    <RotateCw size={11} strokeWidth={2} />
                    Resend
                  </button>
                  <button
                    onClick={() => handleResend(referee.id, "send-reminder")}
                    disabled={busy || referee.reminder_count >= MAX_REMINDERS}
                    className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white/70 hover:text-white hover:border-white/25 transition-colors disabled:opacity-40"
                    style={{ gap: 5, fontSize: 11.5, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 10px", cursor: busy || referee.reminder_count >= MAX_REMINDERS ? "default" : "pointer" }}
                  >
                    <BellRing size={11} strokeWidth={2} />
                    Remind ({referee.reminder_count}/{MAX_REMINDERS})
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isDone && status.referees.length < MAX_REFEREES && (
        <form onSubmit={handleAddReferee} className={CARD} style={{ borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
            <div className="flex items-center" style={{ gap: 10 }}>
              <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 32, height: 32, borderRadius: 8 }}>
                <UserPlus size={15} strokeWidth={2} />
              </div>
              <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
                Add a referee
              </span>
            </div>
            <span className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12 }}>
              {status.referees.length} of {MAX_REFEREES}
            </span>
          </div>

          <div>
            <label htmlFor={`${formId}-name`} className={LABEL} style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Referee name
            </label>
            <input
              id={`${formId}-name`}
              placeholder="e.g. Priya Shah"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className={INPUT}
              style={{ height: 44, width: "100%", borderRadius: 8, padding: "0 12px", fontSize: 13 }}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-email`} className={LABEL} style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Referee email
            </label>
            <input
              id={`${formId}-email`}
              placeholder="priya@company.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className={INPUT}
              style={{ height: 44, width: "100%", borderRadius: 8, padding: "0 12px", fontSize: 13 }}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-org`} className={LABEL} style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Organization <span className="text-white/25" style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span>
            </label>
            <div className="relative">
              <Building2 size={14} strokeWidth={2} className="text-white/25 absolute" style={{ left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                id={`${formId}-org`}
                placeholder="Nimbus Systems"
                value={form.organization}
                onChange={(e) => setForm({ ...form, organization: e.target.value })}
                className={INPUT}
                style={{ height: 44, width: "100%", borderRadius: 8, padding: "0 12px 0 36px", fontSize: 13 }}
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${formId}-role`} className={LABEL} style={{ fontSize: 12, display: "block", marginBottom: 6 }}>
              Relationship
            </label>
            <select
              id={`${formId}-role`}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as RefereeRole })}
              className={INPUT}
              style={{ height: 44, width: "100%", borderRadius: 8, padding: "0 12px", fontSize: 13 }}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#141416]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
            style={{ height: 46, borderRadius: 8, fontSize: 14, border: "none", cursor: busy ? "default" : "pointer" }}
          >
            {busy ? "Adding…" : "Add referee"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" style={{ fontSize: 12.5, color: "#E8798F" }}>
          {error}
        </p>
      )}
    </div>
  );
}
