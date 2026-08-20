"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type JdMode = "paste" | "link";

export default function AuthenticatedFitmentChecker() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [phone, setPhone] = useState("");
  const [candidateLevel, setCandidateLevel] = useState<"" | "entry" | "mid" | "senior">("");
  const [jdMode, setJdMode] = useState<JdMode>("paste");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const canSubmit = name.trim() && role.trim() && phone.trim() && candidateLevel && (jdMode === "paste" ? jdText.trim() : jdUrl.trim()) && cvFile && !checking;

  const POLL_INTERVAL_MS = 3000;
  const POLL_MAX_ATTEMPTS = 20;

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
        const data = (await res.json()) as { status?: "pending" | "ready" };
        if (!isMountedRef.current) return;
        if (res.ok && data.status === "ready") {
          setChecking(false);
          setOpen(false);
          router.refresh();
          return;
        }
        pollForResult(leadId, attempt + 1);
      } catch {
        if (!isMountedRef.current) return;
        pollForResult(leadId, attempt + 1);
      }
    }, POLL_INTERVAL_MS);
  };

  const checkFit = async () => {
    if (!canSubmit || !cvFile) return;
    setErrorMsg(null);
    setIsDuplicate(false);
    setChecking(true);

    const form = new FormData();
    form.set("name", name.trim());
    form.set("role", role.trim());
    form.set("phone", phone.trim());
    form.set("candidateLevel", candidateLevel);
    if (jdMode === "paste") form.set("jdText", jdText.trim());
    else form.set("jdUrl", jdUrl.trim());
    form.set("cv", cvFile);

    try {
      const res = await fetch("/api/hub/fitment-check", { method: "POST", body: form, credentials: "include" });
      const data = (await res.json()) as {
        status?: "pending" | "ready";
        leadId?: string;
        error?: string;
        duplicate?: boolean;
      };
      if (!res.ok || !data.status) {
        setChecking(false);
        setIsDuplicate(Boolean(data.duplicate));
        setErrorMsg(data.error || "Something went wrong — please try again.");
        return;
      }
      if (data.status === "ready") {
        setChecking(false);
        setOpen(false);
        router.refresh();
        return;
      }
      if (data.status === "pending" && data.leadId) {
        pollForResult(data.leadId);
        return;
      }
      setChecking(false);
      setErrorMsg("Something went wrong — please try again.");
    } catch {
      setChecking(false);
      setErrorMsg("Something went wrong — please try again.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-block font-[family-name:var(--font-poppins)] font-semibold text-white text-center"
        style={{ marginTop: 18, padding: "12px 22px", borderRadius: 8, fontSize: 14, background: "#ed1a24", border: "none", cursor: "pointer" }}
      >
        Check my fitment
      </button>

      {open && (
        <div
          onClick={() => !checking && setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#141416] border border-white/[0.08]"
            style={{ maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto", borderRadius: 24, padding: 28, position: "relative" }}
          >
            <button
              onClick={() => !checking && setOpen(false)}
              aria-label="Close"
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 20, cursor: checking ? "default" : "pointer", color: "#9c9c9c" }}
            >
              ✕
            </button>

            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.4rem", margin: "0 0 10px" }}>
              Check my fitment
            </h2>
            <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, lineHeight: 1.6, margin: "0 0 20px" }}>
              Free, takes about 60 seconds. We&apos;ll use your Merito account email.
            </p>

            <label className="block font-[family-name:var(--font-poppins)] font-semibold text-white/80" style={{ fontSize: 12, marginBottom: 6 }}>
              Full name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full box-border bg-white/[0.04] font-[family-name:var(--font-poppins)] text-white outline-none border border-white/[0.12] focus:border-[#ed1a24] transition-colors"
              style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
            />

            <label className="block font-[family-name:var(--font-poppins)] font-semibold text-white/80" style={{ fontSize: 12, marginBottom: 6 }}>
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full box-border bg-white/[0.04] font-[family-name:var(--font-poppins)] text-white outline-none border border-white/[0.12] focus:border-[#ed1a24] transition-colors"
              style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
            />

            <label className="block font-[family-name:var(--font-poppins)] font-semibold text-white/80" style={{ fontSize: 12, marginBottom: 6 }}>
              The role you want
            </label>
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Product Manager"
              className="w-full box-border bg-white/[0.04] font-[family-name:var(--font-poppins)] text-white outline-none border border-white/[0.12] focus:border-[#ed1a24] transition-colors"
              style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
            />

            <select
              value={candidateLevel}
              onChange={(e) => setCandidateLevel(e.target.value as "entry" | "mid" | "senior")}
              className="w-full box-border bg-white/[0.04] font-[family-name:var(--font-poppins)] text-white outline-none border border-white/[0.12] focus:border-[#ed1a24]"
              style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
            >
              <option value="" disabled>
                Your experience level
              </option>
              <option value="entry">Entry-level (0-2 years)</option>
              <option value="mid">Mid-level (2-10 years)</option>
              <option value="senior">Senior-level (10+ years)</option>
            </select>

            <div className="flex items-center" style={{ gap: 8, marginBottom: 6 }}>
              <label className="font-[family-name:var(--font-poppins)] font-semibold text-white/80" style={{ fontSize: 12 }}>
                Job description
              </label>
              <div className="flex border border-white/[0.12] overflow-hidden" style={{ borderRadius: 50, marginLeft: "auto" }}>
                <button
                  type="button"
                  onClick={() => setJdMode("paste")}
                  className="font-[family-name:var(--font-poppins)] font-semibold transition-all"
                  style={{ border: "none", cursor: "pointer", fontSize: 11, padding: "5px 12px", background: jdMode === "paste" ? "#ed1a24" : "transparent", color: jdMode === "paste" ? "#fff" : "#9c9c9c" }}
                >
                  Paste JD
                </button>
                <button
                  type="button"
                  onClick={() => setJdMode("link")}
                  className="font-[family-name:var(--font-poppins)] font-semibold transition-all"
                  style={{ border: "none", cursor: "pointer", fontSize: 11, padding: "5px 12px", background: jdMode === "link" ? "#ed1a24" : "transparent", color: jdMode === "link" ? "#fff" : "#9c9c9c" }}
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
                className="w-full box-border bg-white/[0.04] font-[family-name:var(--font-poppins)] text-white outline-none border border-white/[0.12] focus:border-[#ed1a24] transition-colors resize-none"
                style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, height: 88, marginBottom: 12 }}
              />
            ) : (
              <input
                value={jdUrl}
                onChange={(e) => setJdUrl(e.target.value)}
                placeholder="https://company.com/careers/role"
                className="w-full box-border bg-white/[0.04] font-[family-name:var(--font-poppins)] text-white outline-none border border-white/[0.12] focus:border-[#ed1a24] transition-colors"
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
              className="cursor-pointer flex items-center transition-colors"
              style={{ border: `1.5px dashed ${cvFile ? "#22c55e" : "rgba(255,255,255,0.12)"}`, borderRadius: 10, padding: "14px 16px", gap: 12, background: "rgba(255,255,255,0.04)" }}
            >
              <svg width="20" height="20" fill="none" stroke={cvFile ? "#22c55e" : "#9c9c9c"} strokeWidth="2" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <span className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 13, color: cvFile ? "#22c55e" : "#9c9c9c" }}>
                {cvFile ? `${cvFile.name} - ready ✓` : "Upload your CV (PDF or DOCX)"}
              </span>
            </div>

            <button
              onClick={checkFit}
              disabled={!canSubmit}
              className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white transition-colors"
              style={{
                marginTop: 18,
                height: 50,
                borderRadius: 8,
                fontSize: 15,
                background: canSubmit ? "#ed1a24" : "rgba(255,255,255,0.08)",
                cursor: canSubmit ? "pointer" : "default",
                border: "none",
              }}
            >
              {checking ? "Scoring your CV…" : "Check my fitment"}
            </button>

            {errorMsg && (
              <p role="alert" className="font-[family-name:var(--font-poppins)]" style={{ color: "#E8798F", fontSize: 12.5, marginTop: 10, textAlign: "center" }}>
                {errorMsg}
                {isDuplicate && (
                  <>
                    {" "}
                    <Link href="/hub/account" style={{ textDecoration: "underline", fontWeight: 600 }}>
                      Refresh
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
