"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportType } from "../reportSections";
import type { LookupResponse } from "@/shared/recruiter-preview/types";
import { RecruiterPreviewCard } from "@/shared/recruiter-preview/RecruiterPreviewCard";

const BRAND = "#DA3B3B";
const BRAND_DARK = "#C22F2F";
const BRAND_TINT = "#FDECEC";
const BORDER = "#E4E4E9";
const BORDER_SOFT = "#ECECF0";
const TEXT_MUTED = "#6B6B76";
const GREEN = "#1E9A5A";

const SECTION_LABELS: Record<ReportType, string> = {
  fitment: "Fitment report",
  personality: "Personality profile",
  interview: "AI interview report",
  references: "Reference checks",
};

const SECTION_ICONS: Record<ReportType, React.ReactNode> = {
  fitment: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  ),
  personality: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </svg>
  ),
  interview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  references: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  ),
};

const SELECTABLE_SECTIONS = Object.keys(SECTION_LABELS) as ReportType[];

export default function RecruiterPreviewClient({
  previewData,
  initialEnabled,
  initialSections,
  initialLinkedinUrl,
}: {
  previewData: LookupResponse;
  initialEnabled: boolean;
  initialSections: string[];
  initialLinkedinUrl: string | null;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [sections, setSections] = useState<Set<ReportType>>(
    new Set(initialSections.filter((s): s is ReportType => (SELECTABLE_SECTIONS as string[]).includes(s)))
  );
  const [activeSection, setActiveSection] = useState<ReportType>("fitment");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [linkedinUrl, setLinkedinUrl] = useState(initialLinkedinUrl ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const savedPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (savedPulseTimer.current) clearTimeout(savedPulseTimer.current);
    };
  }, []);

  const available: Record<ReportType, boolean> = {
    fitment: previewData.fitment !== null,
    personality: previewData.personality !== null,
    interview: previewData.interview !== null,
    references: previewData.references !== null,
  };
  const hasAnyData = available.fitment || available.personality || available.interview || available.references;

  function toggleSection(section: ReportType) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/hub/recruiter-preview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, sections: Array.from(sections), linkedinUrl }),
      });
      if (response.ok) {
        setSaveState("saved");
        if (savedPulseTimer.current) clearTimeout(savedPulseTimer.current);
        savedPulseTimer.current = setTimeout(() => setSaveState("idle"), 2200);
      } else {
        const body = await response.json().catch(() => null);
        setErrorMessage(body?.error ?? "Something went wrong saving — please try again.");
        setSaveState("error");
      }
    } catch {
      setErrorMessage("Something went wrong saving — please try again.");
      setSaveState("error");
    }
  }

  if (!hasAnyData) {
    return (
      <main style={{ padding: "56px 32px", maxWidth: 720, margin: "0 auto" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 28, letterSpacing: "-0.02em" }}>
          Recruiter Preview
        </h1>
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 15, color: TEXT_MUTED, margin: "10px 0 0", lineHeight: 1.6 }}>
          Complete at least one report — fitment, personality, AI interview, or reference checks — before you can make
          your profile visible to recruiters.
        </p>
      </main>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "56px 32px 96px" }}>
      <style>{`
        .rpv-switch { position: relative; width: 40px; height: 24px; flex: 0 0 auto; }
        .rpv-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
        .rpv-switch-track { position: absolute; inset: 0; background: #D8D8DE; border-radius: 999px; transition: background .15s ease; }
        .rpv-switch input:checked ~ .rpv-switch-track { background: ${BRAND}; }
        .rpv-switch-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.25); transition: left .15s ease; }
        .rpv-switch input:checked ~ .rpv-switch-thumb { left: 19px; }
        .rpv-switch input:focus-visible ~ .rpv-switch-track { box-shadow: 0 0 0 4px rgba(218,59,59,0.18); }
        .rpv-subitems { position: relative; margin: 20px 0 0; padding-left: 22px; transition: opacity .15s ease; }
        .rpv-subitems.is-disabled { opacity: .45; pointer-events: none; }
        .rpv-subitems::before { content: ""; position: absolute; top: 18px; bottom: 18px; left: 5px; width: 1px; background: ${BORDER}; }
        .rpv-subitem { position: relative; display: flex; align-items: center; gap: 12px; padding: 10px 0; }
        .rpv-subitem::before { content: ""; position: absolute; left: -17px; top: 50%; width: 11px; height: 1px; background: ${BORDER}; }
        .rpv-subitem input[type="checkbox"] { width: 16px; height: 16px; margin: 0; accent-color: ${BRAND}; flex: 0 0 auto; cursor: pointer; }
        .rpv-text-input:focus { border-color: ${BRAND} !important; background: #fff !important; box-shadow: 0 0 0 4px rgba(218,59,59,0.18); outline: none; }
        .rpv-btn-primary:hover { background: ${BRAND_DARK}; }
        .rpv-btn-primary:active { transform: translateY(1px); }
        @media (max-width: 900px) {
          .rpv-layout { grid-template-columns: 1fr !important; }
          .rpv-preview-col { position: static !important; }
        }
      `}</style>

      <div style={{ maxWidth: 720, marginBottom: 40 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 28, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
          Recruiter Preview
        </h1>
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 15, lineHeight: 1.6, color: TEXT_MUTED, margin: 0 }}>
          Control what recruiters see about you via the Merito Hub recruiter preview, before they ever reach out.{" "}
          <strong className="text-black" style={{ fontWeight: 600 }}>
            Raw scores, the AI recommendation, and the integrity assessment are never included.
          </strong>
        </p>
      </div>

      <div className="rpv-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 460px", gap: 40, alignItems: "start" }}>
        <div>
          <div style={{ marginBottom: 16, minHeight: 38 }}>
            <h2 className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 15, margin: "0 0 4px" }}>
              Profile visibility
            </h2>
            <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: TEXT_MUTED, margin: 0 }}>
              These settings control the Live preview.
            </p>
          </div>

          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, boxShadow: "0 1px 2px rgba(20,20,30,0.03)" }}>
            <div style={{ padding: "28px 28px 24px" }}>
              <label
                htmlFor="linkedin-url"
                className="font-[family-name:var(--font-poppins)] font-semibold text-black"
                style={{ fontSize: 13, display: "block", marginBottom: 10 }}
              >
                Your LinkedIn profile URL
              </label>
              <input
                id="linkedin-url"
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-name"
                className="rpv-text-input font-[family-name:var(--font-poppins)]"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  fontSize: 14,
                  color: "#17171B",
                  background: "#FBFBFC",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 7,
                }}
              />
              <p className="font-[family-name:var(--font-poppins)]" style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.5, color: TEXT_MUTED }}>
                Must be your own LinkedIn profile — this is what recruiters&apos; extension will match against.
              </p>
            </div>

            <div style={{ height: 1, background: BORDER_SOFT, margin: "0 28px" }} />

            <div style={{ padding: "24px 28px 28px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div id="visible-label">
                  <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14, margin: "0 0 4px" }}>
                    Visible to recruiters
                  </h3>
                  <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: TEXT_MUTED, margin: 0, lineHeight: 1.5 }}>
                    Recruiters using the Merito Hub extension can see the items below.
                  </p>
                </div>
                <label className="rpv-switch">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} aria-labelledby="visible-label" />
                  <span className="rpv-switch-track" />
                  <span className="rpv-switch-thumb" />
                </label>
              </div>

              <div className={`rpv-subitems${enabled ? "" : " is-disabled"}`} role="group" aria-labelledby="visible-label">
                {SELECTABLE_SECTIONS.map((section) => (
                  <div key={section} className="rpv-subitem" style={{ opacity: available[section] ? 1 : 0.4 }}>
                    <input
                      type="checkbox"
                      checked={sections.has(section)}
                      disabled={!enabled || !available[section]}
                      onChange={() => toggleSection(section)}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: BRAND_TINT,
                        color: BRAND_DARK,
                        flex: "0 0 auto",
                      }}
                    >
                      <span style={{ width: 15, height: 15 }}>{SECTION_ICONS[section]}</span>
                    </span>
                    <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {SECTION_LABELS[section]}
                      {!available[section] ? " (not available yet)" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 1, background: BORDER_SOFT, margin: "0 28px" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 28px 28px" }}>
              <button
                onClick={handleSave}
                disabled={saveState === "saving"}
                className="rpv-btn-primary font-[family-name:var(--font-poppins)] font-semibold"
                style={{ background: BRAND, color: "#fff", border: "none", fontSize: 14, padding: "11px 22px", borderRadius: 7, cursor: "pointer" }}
              >
                {saveState === "saving" ? "Saving…" : "Save"}
              </button>
              <span
                className="font-[family-name:var(--font-poppins)]"
                style={{ fontSize: 12.5, color: saveState === "saved" ? GREEN : TEXT_MUTED, fontWeight: saveState === "saved" ? 600 : 400 }}
              >
                {saveState === "saved" ? "Saved just now." : "Changes apply the next time a recruiter looks you up."}
              </span>
            </div>
            {saveState === "error" && errorMessage && (
              <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: BRAND, margin: "0 28px 20px" }}>
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        <div className="rpv-preview-col" style={{ position: "sticky", top: 32 }}>
          <div style={{ marginBottom: 16, minHeight: 38 }}>
            <h2 className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 15, margin: "0 0 4px" }}>
              Live preview
            </h2>
            <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: TEXT_MUTED, margin: 0 }}>
              {enabled ? "This is exactly what a recruiter would see." : 'Turn on "Visible to recruiters" to see a preview.'}
            </p>
          </div>

          <div style={{ background: "#F6F6F8", border: `1px solid ${BORDER_SOFT}`, borderRadius: 14, padding: 16 }}>
            {enabled ? (
              <RecruiterPreviewCard
                data={{ ...previewData, sections: Array.from(sections) }}
                activeSection={activeSection}
                onSelectSection={setActiveSection}
                logoUrl="/logo.png"
              />
            ) : (
              <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: TEXT_MUTED, margin: 0, padding: 12 }}>
                Nothing to show while visibility is off.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
