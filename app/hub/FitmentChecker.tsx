"use client";

import { useState, useRef, useEffect } from "react";
import Script from "next/script";
import Link from "next/link";

declare global {
  interface Window {
    grecaptcha?: {
      render: (container: HTMLElement, options: { sitekey: string }) => number;
      getResponse: (widgetId?: number) => string;
      reset: (widgetId?: number) => void;
      ready: (cb: () => void) => void;
    };
    onRecaptchaLoad?: () => void;
  }
}

type JdMode = "paste" | "link";

export default function FitmentChecker() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [jdMode, setJdMode] = useState<JdMode>("paste");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const [verdict, setVerdict] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
  const recaptchaEnabled = Boolean(recaptchaSiteKey);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!recaptchaEnabled) return;
    const renderWidget = () => {
      if (recaptchaContainerRef.current && window.grecaptcha?.render && widgetIdRef.current === null) {
        widgetIdRef.current = window.grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: recaptchaSiteKey,
        });
      }
    };
    if (window.grecaptcha?.render) {
      window.grecaptcha.ready(renderWidget);
    } else {
      window.onRecaptchaLoad = renderWidget;
    }
    return () => {
      widgetIdRef.current = null;
    };
  }, [recaptchaEnabled, recaptchaSiteKey]);

  const roleLabel = role.trim() || "your target role";
  const canSubmit = email.trim() && role.trim() && phone.trim() && (jdMode === "paste" ? jdText.trim() : jdUrl.trim()) && cvFile && !checking;

  const animateScore = (target: number) => {
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 1500);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const checkFit = async () => {
    if (!canSubmit || !cvFile) return;
    setErrorMsg(null);
    setChecking(true);
    setScore(null);
    setShown(0);

    let recaptchaToken = "";
    if (recaptchaEnabled) {
      recaptchaToken = window.grecaptcha?.getResponse?.(widgetIdRef.current ?? undefined) || "";
      if (!recaptchaToken) {
        setChecking(false);
        setErrorMsg("Please verify that you are not a robot.");
        return;
      }
    }

    const form = new FormData();
    form.set("name", name.trim());
    form.set("email", email.trim());
    form.set("role", role.trim());
    form.set("phone", phone.trim());
    if (jdMode === "paste") form.set("jdText", jdText.trim());
    else form.set("jdUrl", jdUrl.trim());
    form.set("cv", cvFile);
    form.set("recaptchaToken", recaptchaToken);

    try {
      const res = await fetch("/api/hub/fitment-check", { method: "POST", body: form });
      const data = (await res.json()) as {
        status?: "pending" | "ready";
        score?: number;
        verdict?: string;
        leadId?: string;
        error?: string;
      };
      window.grecaptcha?.reset?.(widgetIdRef.current ?? undefined);
      if (!res.ok || !data.status) {
        setChecking(false);
        setErrorMsg(data.error || "Something went wrong — please try again.");
        return;
      }
      if (data.status === "ready" && typeof data.score === "number") {
        setChecking(false);
        setScore(data.score);
        setVerdict(data.verdict || "");
        animateScore(data.score);
        return;
      }
      if (data.status === "pending" && data.leadId) {
        pollForResult(data.leadId);
        return;
      }
      setChecking(false);
      setErrorMsg("Something went wrong — please try again.");
    } catch {
      window.grecaptcha?.reset?.(widgetIdRef.current ?? undefined);
      setChecking(false);
      setErrorMsg("Something went wrong — please try again.");
    }
  };

  const POLL_INTERVAL_MS = 3000;
  const POLL_MAX_ATTEMPTS = 20; // 20 * 3000ms = 60s, see plan's Global Constraints on provisional polling values

  const pollForResult = (leadId: string, attempt = 0) => {
    if (attempt >= POLL_MAX_ATTEMPTS) {
      setChecking(false);
      setErrorMsg("Your score is taking longer than usual — check back in a few minutes.");
      return;
    }
    setTimeout(async () => {
      if (!isMountedRef.current) return;
      try {
        const res = await fetch(`/api/hub/fitment-check/status?leadId=${encodeURIComponent(leadId)}`);
        const data = (await res.json()) as { status?: "pending" | "ready"; score?: number; verdict?: string };
        if (!isMountedRef.current) return;
        if (res.ok && data.status === "ready" && typeof data.score === "number") {
          setChecking(false);
          setScore(data.score);
          setVerdict(data.verdict || "");
          animateScore(data.score);
          return;
        }
        pollForResult(leadId, attempt + 1);
      } catch {
        if (!isMountedRef.current) return;
        pollForResult(leadId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  };

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
      {recaptchaEnabled ? (
        <Script src="https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit" strategy="afterInteractive" />
      ) : null}

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
        Full name
      </label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Jane Doe"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />

      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        Your email
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />

      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        Phone number
      </label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+91 98765 43210"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />

      <label className="block font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12, marginBottom: 6 }}>
        The role you want
      </label>
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="e.g. Senior Product Manager"
        className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
        style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
      />

      <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
        <label className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 12 }}>
          Job description
        </label>
        <div className="flex border border-[#dcdcdc] overflow-hidden" style={{ borderRadius: 50, marginLeft: "auto" }}>
          <button
            type="button"
            onClick={() => setJdMode("paste")}
            className="font-[family-name:var(--font-poppins)] font-semibold transition-all"
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              padding: "5px 12px",
              background: jdMode === "paste" ? "#ed1a24" : "#fff",
              color: jdMode === "paste" ? "#fff" : "#4b4b4d",
            }}
          >
            Paste JD
          </button>
          <button
            type="button"
            onClick={() => setJdMode("link")}
            className="font-[family-name:var(--font-poppins)] font-semibold transition-all"
            style={{
              border: "none",
              cursor: "pointer",
              fontSize: 11,
              padding: "5px 12px",
              background: jdMode === "link" ? "#ed1a24" : "#fff",
              color: jdMode === "link" ? "#fff" : "#4b4b4d",
            }}
          >
            JD link
          </button>
        </div>
      </div>
      {jdMode === "paste" ? (
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job description here..."
          className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors resize-none"
          style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, height: 88, marginBottom: 12 }}
        />
      ) : (
        <input
          value={jdUrl}
          onChange={(e) => setJdUrl(e.target.value)}
          placeholder="https://company.com/careers/role"
          className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] transition-colors"
          style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          if (file && file.size > 5 * 1024 * 1024) {
            setErrorMsg("That file is too large — please upload a CV under 5MB.");
            return;
          }
          setErrorMsg(null);
          setCvFile(file);
        }}
      />
      <div
        onClick={() => fileInputRef.current?.click()}
        className="bg-white cursor-pointer flex items-center transition-colors"
        style={{
          border: `1.5px dashed ${cvFile ? "#22c55e" : "#dcdcdc"}`,
          borderRadius: 10,
          padding: "14px 16px",
          gap: 12,
        }}
      >
        <svg width="20" height="20" fill="none" stroke={cvFile ? "#22c55e" : "#9c9c9c"} strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <path d="M14 2v6h6" />
        </svg>
        <span
          className="font-[family-name:var(--font-poppins)] font-semibold"
          style={{ fontSize: 13, color: cvFile ? "#16803c" : "#4b4b4d" }}
        >
          {cvFile ? `${cvFile.name} - ready ✓` : "Upload your CV (PDF or DOCX)"}
        </span>
      </div>

      <p className="text-[#9c9c9c]" style={{ fontSize: 11, lineHeight: 1.5, margin: "8px 0 0" }}>
        By uploading, you agree to Merito storing your CV to build your profile — see our{" "}
        <Link href="/privacy" className="text-[#9c9c9c] underline">
          Privacy Policy
        </Link>
        .
      </p>

      {recaptchaEnabled ? (
        <div style={{ marginTop: 14 }}>
          <div className="origin-top-left scale-[0.82] sm:scale-100" style={{ width: 300 }}>
            <div ref={recaptchaContainerRef} />
          </div>
        </div>
      ) : null}

      <button
        onClick={checkFit}
        disabled={!canSubmit}
        className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white transition-colors"
        style={{
          marginTop: 14,
          height: 50,
          borderRadius: 8,
          fontSize: 15,
          background: canSubmit ? "#ed1a24" : "#dcdcdc",
          cursor: canSubmit ? "pointer" : "default",
          boxShadow: canSubmit ? "0px 4px 6px rgba(236,34,40,0.3)" : "none",
          border: "none",
        }}
      >
        {checking ? "Scoring your CV…" : "Check my fitment - free"}
      </button>

      {errorMsg && (
        <p className="text-center" style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10 }}>
          {errorMsg}
        </p>
      )}

      {noScore && !errorMsg && (
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
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            Fill in the form above to get your real score.
          </p>
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
          <p className="text-[#9c9c9c]" style={{ fontSize: 12, margin: "14px 0 0", lineHeight: 1.6 }}>
            <Link href="/hub/login" className="font-semibold text-[#ed1a24]" style={{ textDecoration: "underline" }}>
              Create your free account
            </Link>
            {" "}to unlock the full report - strengths, gaps, and exactly what to fix.
          </p>
        </div>
      )}

      <p className="font-[family-name:var(--font-poppins)] font-medium text-[#9c9c9c] text-center" style={{ fontSize: 12, margin: "14px 0 0" }}>
        Free · Takes 60 seconds
      </p>
    </div>
  );
}
