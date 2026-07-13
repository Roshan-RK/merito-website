"use client";

import { useState, useRef } from "react";

type Breakdown = { label: string; val: string; width: string; color: string };

export default function FitmentChecker() {
  const [role, setRole] = useState("");
  const [cvUploaded, setCvUploaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const rafRef = useRef<number | null>(null);

  const roleLabel = role.trim() || "your target role";

  const checkFit = () => {
    if (checking) return;
    setChecking(true);
    setScore(null);
    setShown(0);
    const seed = (role.trim() || "Product Manager").split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);
    const target = Math.round((6.6 + (seed % 21) / 10) * 10) / 10;

    setTimeout(() => {
      setChecking(false);
      setScore(target);
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1500);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(target * eased);
        if (p < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 1400);
  };

  const verdict =
    (score ?? 0) >= 8
      ? "Strong fit. Polish your CV and apply with confidence."
      : (score ?? 0) >= 7.3
      ? "Good fit - a few gaps are costing you shortlists."
      : "Fixable gaps. See exactly what to change before your next application.";

  const sub = (o: number) => Math.max(3.5, Math.min(9.6, (score ?? 0) + o));
  const breakdown: Breakdown[] = score
    ? [
        { label: "Skills match", v: sub(0.6) },
        { label: "Experience fit", v: sub(-0.4) },
        { label: "CV clarity", v: sub(-0.9) },
      ].map((b) => ({
        label: b.label,
        val: b.v.toFixed(1),
        width: b.v * 10 + "%",
        color: b.v >= 7 ? "#ed1a24" : "#9c9c9c",
      }))
    : [];

  const hasScore = !!score;
  const noScore = !score && !checking;

  return (
    <div
      id="fit-checker"
      className="bg-[#fdf8fb] border border-black/[0.08] w-full"
      style={{ borderRadius: 24, boxShadow: "0px 18px 50px rgba(17,35,89,0.05)", padding: 24 }}
    >
      <style>{`
        @keyframes hub-pulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.35); opacity: 0.55; } }
      `}</style>
      <div className="flex items-center gap-2.5" style={{ marginBottom: 18 }}>
        <span
          className="rounded-full bg-[#ed1a24] inline-block"
          style={{ width: 10, height: 10, animation: "hub-pulse 2s ease-in-out infinite" }}
        />
        <span
          className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#4b4b4d]"
          style={{ fontSize: 13, letterSpacing: "0.06em" }}
        >
          Job Fitment Score - Free
        </span>
      </div>

      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        The job you want (paste JD or link here)
      </label>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="e.g. Senior Product Manager"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14 }}
      />

      <div
        onClick={() => setCvUploaded((v) => !v)}
        className="bg-white cursor-pointer flex items-center transition-colors"
        style={{
          marginTop: 12,
          border: `1.5px dashed ${cvUploaded ? "#22c55e" : "#dcdcdc"}`,
          borderRadius: 10,
          padding: "14px 16px",
          gap: 12,
        }}
      >
        <svg width="20" height="20" fill="none" stroke={cvUploaded ? "#22c55e" : "#9c9c9c"} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        <span
          className="font-[family-name:var(--font-poppins)] font-semibold"
          style={{ fontSize: 13, color: cvUploaded ? "#16803c" : "#4b4b4d" }}
        >
          {cvUploaded ? "Your_CV.pdf - ready ✓" : "Upload your CV (PDF) - tap to simulate"}
        </span>
      </div>

      <button
        onClick={checkFit}
        className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
        style={{ marginTop: 14, height: 50, borderRadius: 8, fontSize: 15, boxShadow: "0px 4px 6px rgba(236,34,40,0.3)" }}
      >
        {checking ? "Scoring your CV…" : "Check my fitment - free"}
      </button>

      {noScore && (
        <div
          className="bg-white border border-black/[0.08] relative"
          style={{ marginTop: 18, borderRadius: 14, padding: 18, boxShadow: "0px 4px 16px rgba(17,35,89,0.04)" }}
        >
          <span
            className="absolute font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c] bg-white border border-[#dcdcdc]"
            style={{ top: 14, right: 14, fontSize: 9, letterSpacing: "0.06em", borderRadius: 50, padding: "3px 9px" }}
          >
            Sample
          </span>
          <div className="flex items-baseline justify-between" style={{ opacity: 0.75 }}>
            <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "2.6rem", lineHeight: 1, whiteSpace: "nowrap" }}>
              7.8<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "1.1rem" }}> / 10</span>
            </span>
            <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d] text-right" style={{ fontSize: 12, marginRight: 56 }}>
              fit for Senior Product Manager
            </span>
          </div>
          <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 12, height: 10, borderRadius: 6, opacity: 0.75 }}>
            <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: "78%" }} />
          </div>
          {[
            { label: "Skills match", val: "8.4", width: "84%" },
            { label: "Experience fit", val: "7.6", width: "76%" },
            { label: "CV clarity", val: "6.9", width: "69%", grey: true },
          ].map((b) => (
            <div key={b.label} className="flex items-center" style={{ gap: 12, marginTop: 10, opacity: 0.75 }}>
              <span className="text-[#4b4b4d] flex-shrink-0" style={{ fontSize: 12, width: 110 }}>{b.label}</span>
              <div className="flex-1 bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 4 }}>
                <div className="h-full" style={{ borderRadius: 4, width: b.width, background: b.grey ? "#9c9c9c" : "#ed1a24" }} />
              </div>
              <span className="font-bold text-black text-right" style={{ fontSize: 12, width: 32 }}>{b.val}</span>
            </div>
          ))}
          <button
            onClick={checkFit}
            className="w-full font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] border border-[rgba(237,26,36,0.4)] hover:border-[#ed1a24] hover:bg-[#fdeced] transition-all bg-transparent"
            style={{ marginTop: 16, height: 44, borderRadius: 8, fontSize: 13 }}
          >
            Create a free profile - view your detailed fitment report
          </button>
        </div>
      )}

      {hasScore && (
        <div
          className="bg-white border border-black/[0.08]"
          style={{ marginTop: 18, borderRadius: 14, padding: 18, boxShadow: "0px 4px 16px rgba(17,35,89,0.04)" }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "2.6rem", lineHeight: 1, whiteSpace: "nowrap" }}>
              {shown.toFixed(1)}<span className="font-semibold text-[#9c9c9c]" style={{ fontSize: "1.1rem" }}> / 10</span>
            </span>
            <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#4b4b4d] text-right" style={{ fontSize: 12 }}>
              fit for {roleLabel}
            </span>
          </div>
          <div className="bg-[#f0e6ea] overflow-hidden" style={{ marginTop: 12, height: 10, borderRadius: 6 }}>
            <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: shown * 10 + "%" }} />
          </div>
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: "12px 0 0" }}>
            {verdict}
          </p>
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center" style={{ gap: 12, marginTop: 10 }}>
              <span className="text-[#4b4b4d] flex-shrink-0" style={{ fontSize: 12, width: 110 }}>{b.label}</span>
              <div className="flex-1 bg-[#f0e6ea] overflow-hidden" style={{ height: 6, borderRadius: 4 }}>
                <div className="h-full" style={{ borderRadius: 4, width: b.width, background: b.color }} />
              </div>
              <span className="font-bold text-black text-right" style={{ fontSize: 12, width: 32 }}>{b.val}</span>
            </div>
          ))}
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            Create your free account to unlock the full report - strengths, gaps, and exactly what to fix.
          </p>
        </div>
      )}

      <p className="font-[family-name:var(--font-poppins)] font-medium text-[#9c9c9c] text-center" style={{ fontSize: 12, margin: "14px 0 0" }}>
        Free · No sign-up · Takes 60 seconds
      </p>
    </div>
  );
}
