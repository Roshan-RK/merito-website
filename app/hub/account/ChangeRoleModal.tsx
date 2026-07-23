"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

type JdMode = "paste" | "link";

export default function ChangeRoleModal({
  onClose,
  onRoleChanged,
}: {
  onClose: () => void;
  onRoleChanged: (roleTitle: string) => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [candidateLevel, setCandidateLevel] = useState<"" | "entry" | "mid" | "senior">("");
  const [jdMode, setJdMode] = useState<JdMode>("paste");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = role.trim() && candidateLevel && (jdMode === "paste" ? jdText.trim() : jdUrl.trim()) && cvFile && !busy;

  const handleSubmit = async () => {
    if (!canSubmit || !cvFile) return;
    setBusy(true);
    setError(null);

    const form = new FormData();
    form.set("role", role.trim());
    form.set("candidateLevel", candidateLevel);
    if (jdMode === "paste") form.set("jdText", jdText.trim());
    else form.set("jdUrl", jdUrl.trim());
    form.set("cv", cvFile);
    form.set("recaptchaToken", ""); // rescore-role runs server-side for an already-authenticated user; recaptcha applies to the anonymous path it delegates to, which is conditional and skips cleanly when unconfigured

    try {
      const res = await fetch("/api/hub/rescore-role", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setBusy(false);
        setError(data.error || "Something went wrong — please try again.");
        return;
      }
      setBusy(false);
      onRoleChanged(role.trim());
      router.refresh();
    } catch {
      setBusy(false);
      setError("Something went wrong — please try again.");
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white"
        style={{ maxWidth: 480, width: "100%", borderRadius: 24, padding: 28, maxHeight: "92vh", overflowY: "auto" }}
      >
        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.4rem", margin: "0 0 6px" }}>
          Change target role
        </h2>
        <p className="text-[#9c9c9c]" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 18px" }}>
          Your completed steps carry over. The detailed report re-locks for the new role (₹299).
        </p>

        <input
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="e.g. Senior Product Manager"
          className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24]"
          style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
        />

        <select
          value={candidateLevel}
          onChange={(e) => setCandidateLevel(e.target.value as "entry" | "mid" | "senior")}
          className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24]"
          style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
        >
          <option value="" disabled>
            Your experience level
          </option>
          <option value="entry">Entry-level (0-2 years)</option>
          <option value="mid">Mid-level (3-7 years)</option>
          <option value="senior">Senior-level (8+ years)</option>
        </select>

        <div className="flex" style={{ gap: 8, marginBottom: 6 }}>
          <button type="button" onClick={() => setJdMode("paste")} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 50, border: "1px solid #dcdcdc", background: jdMode === "paste" ? "#ed1a24" : "#fff", color: jdMode === "paste" ? "#fff" : "#4b4b4d", cursor: "pointer" }}>
            Paste JD
          </button>
          <button type="button" onClick={() => setJdMode("link")} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 50, border: "1px solid #dcdcdc", background: jdMode === "link" ? "#ed1a24" : "#fff", color: jdMode === "link" ? "#fff" : "#4b4b4d", cursor: "pointer" }}>
            JD link
          </button>
        </div>
        {jdMode === "paste" ? (
          <textarea
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job description here..."
            className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24] resize-none"
            style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, height: 120, marginBottom: 12 }}
          />
        ) : (
          <input
            value={jdUrl}
            onChange={(e) => setJdUrl(e.target.value)}
            placeholder="https://company.com/careers/role"
            className="w-full box-border bg-white font-[family-name:var(--font-poppins)] text-black outline-none border border-[#dcdcdc] focus:border-[#ed1a24]"
            style={{ padding: "13px 14px", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => setCvFile(e.target.files?.[0] || null)}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          className="bg-white cursor-pointer flex items-center"
          style={{ border: `1.5px dashed ${cvFile ? "#22c55e" : "#dcdcdc"}`, borderRadius: 10, padding: "14px 16px", gap: 12, marginBottom: 16 }}
        >
          <span className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 13, color: cvFile ? "#16803c" : "#4b4b4d" }}>
            {cvFile ? `${cvFile.name} - ready ✓` : "Upload your CV (PDF or DOCX)"}
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 48, borderRadius: 8, fontSize: 14, background: canSubmit ? "#ed1a24" : "#dcdcdc", border: "none", cursor: canSubmit ? "pointer" : "default" }}
        >
          {busy ? "Re-evaluating your fitment…" : "Re-evaluate my fitment"}
        </button>

        {error && <p style={{ fontSize: 12.5, color: "#ed1a24", marginTop: 10, textAlign: "center" }}>{error}</p>}
      </div>
    </div>
  );
}
