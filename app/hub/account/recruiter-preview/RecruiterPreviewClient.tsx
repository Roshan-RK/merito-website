"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Brain, Mic, Users } from "lucide-react";
import type { ReportType } from "../reportSections";
import type { LookupResponse } from "@/shared/recruiter-preview/types";
import { RecruiterPreviewCard } from "@/shared/recruiter-preview/RecruiterPreviewCard";

const SECTION_LABELS: Record<ReportType, string> = {
  fitment: "Fitment report",
  personality: "Personality profile",
  interview: "AI interview report",
  references: "Reference checks",
};

const SECTION_ICONS: Record<ReportType, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  fitment: FileText,
  personality: Brain,
  interview: Mic,
  references: Users,
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
      <main className="mx-auto" style={{ maxWidth: 720, padding: "56px 32px" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 28, letterSpacing: "-0.02em" }}>
          Recruiter Preview
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 15, margin: "10px 0 0", lineHeight: 1.6 }}>
          Complete at least one report — fitment, personality, AI interview, or reference checks — before you can make
          your profile visible to recruiters.
        </p>
      </main>
    );
  }

  return (
    <div className="mx-auto" style={{ maxWidth: 1180, padding: "56px 32px 96px" }}>
      <div style={{ maxWidth: 720, marginBottom: 40 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 28, letterSpacing: "-0.02em", margin: "0 0 10px" }}>
          Recruiter Preview
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
          Control what recruiters see about you via the Merito Hub recruiter preview, before they ever reach out.{" "}
          <strong className="text-white" style={{ fontWeight: 600 }}>
            Raw scores, the AI recommendation, and the integrity assessment are never included.
          </strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 40, alignItems: "start" }}>
        {/* Settings column */}
        <div>
          <div style={{ marginBottom: 16, minHeight: 38 }}>
            <h2 className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 4px" }}>
              Profile visibility
            </h2>
            <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 12.5, margin: 0 }}>
              These settings control the Live preview.
            </p>
          </div>

          <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14 }}>
            <div style={{ padding: "28px 28px 24px" }}>
              <label
                htmlFor="linkedin-url"
                className="font-[family-name:var(--font-poppins)] font-semibold text-white"
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
                className="w-full bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/30 font-[family-name:var(--font-poppins)] transition-colors focus:outline-none focus:border-[#ed1a24] focus:bg-white/[0.07] focus:ring-2 focus:ring-[#ed1a24]/25"
                style={{ padding: "11px 14px", fontSize: 14, borderRadius: 7 }}
              />
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ margin: "8px 0 0", fontSize: 12.5, lineHeight: 1.5 }}>
                Must be your own LinkedIn profile — this is what recruiters&apos; extension will match against.
              </p>
            </div>

            <div className="bg-white/[0.08]" style={{ height: 1, margin: "0 28px" }} />

            <div style={{ padding: "24px 28px 28px" }}>
              <div className="flex items-start justify-between" style={{ gap: 16 }}>
                <div id="visible-label">
                  <h3 className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 14, margin: "0 0 4px" }}>
                    Visible to recruiters
                  </h3>
                  <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 12.5, margin: 0, lineHeight: 1.5 }}>
                    Recruiters using the Merito Hub extension can see the items below.
                  </p>
                </div>
                <label className="relative inline-flex shrink-0 items-center cursor-pointer" style={{ width: 40, height: 24 }}>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    aria-labelledby="visible-label"
                  />
                  <span className="absolute inset-0 bg-white/15 peer-checked:bg-[#ed1a24] peer-focus-visible:ring-2 peer-focus-visible:ring-[#ed1a24]/50 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[#141416] transition-colors" style={{ borderRadius: 999 }} />
                  <span className="absolute bg-white pointer-events-none transition-transform peer-checked:translate-x-4" style={{ top: 3, left: 3, width: 18, height: 18, borderRadius: 999 }} />
                </label>
              </div>

              <div
                className={`flex flex-col ${enabled ? "" : "opacity-45 pointer-events-none"}`}
                style={{ gap: 8, marginTop: 20 }}
                role="group"
                aria-labelledby="visible-label"
              >
                {SELECTABLE_SECTIONS.map((section) => {
                  const Icon = SECTION_ICONS[section];
                  const isAvailable = available[section];
                  return (
                    <label
                      key={section}
                      className={`flex items-center bg-white/[0.02] border border-white/[0.08] transition-colors ${
                        isAvailable ? "cursor-pointer hover:border-[#ed1a24]/30" : "cursor-not-allowed"
                      }`}
                      style={{ gap: 10, borderRadius: 10, padding: "10px 12px" }}
                    >
                      <input
                        type="checkbox"
                        checked={sections.has(section)}
                        disabled={!enabled || !isAvailable}
                        onChange={() => toggleSection(section)}
                        className="accent-[#ed1a24]"
                        style={{ width: 16, height: 16 }}
                      />
                      <span
                        aria-hidden="true"
                        className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0"
                        style={{ width: 28, height: 28, borderRadius: 8 }}
                      >
                        <Icon size={14} strokeWidth={2} />
                      </span>
                      <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13.5, fontWeight: 500, color: isAvailable ? "#fff" : "rgba(255,255,255,0.4)" }}>
                        {SECTION_LABELS[section]}
                        {!isAvailable ? " (not available yet)" : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="bg-white/[0.08]" style={{ height: 1, margin: "0 28px" }} />

            <div className="flex items-center flex-wrap" style={{ gap: 12, padding: "20px 28px 28px" }}>
              <button
                onClick={handleSave}
                disabled={saveState === "saving"}
                className="bg-[#ed1a24] hover:bg-[#c81319] disabled:opacity-60 disabled:cursor-not-allowed text-white font-[family-name:var(--font-poppins)] font-semibold transition-colors"
                style={{ fontSize: 14, padding: "11px 22px", borderRadius: 7, border: "none", cursor: "pointer" }}
              >
                {saveState === "saving" ? "Saving…" : "Save"}
              </button>
              <span
                aria-live="polite"
                className="font-[family-name:var(--font-poppins)]"
                style={{ fontSize: 12.5, color: saveState === "saved" ? "#4ade80" : "rgba(255,255,255,0.45)", fontWeight: saveState === "saved" ? 600 : 400 }}
              >
                {saveState === "saved" ? "Saved just now." : "Changes apply the next time a recruiter looks you up."}
              </span>
            </div>
            {saveState === "error" && errorMessage && (
              <p role="alert" className="font-[family-name:var(--font-poppins)] text-[#ed1a24]" style={{ fontSize: 12.5, margin: "0 28px 20px" }}>
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        {/* Live preview column */}
        <div className="lg:sticky" style={{ top: 32 }}>
          <div style={{ marginBottom: 16, minHeight: 38 }}>
            <h2 className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 4px" }}>
              Live preview
            </h2>
            <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 12.5, margin: 0 }}>
              {enabled ? "This is exactly what a recruiter would see." : 'Turn on "Visible to recruiters" to see a preview.'}
            </p>
          </div>

          <div className="bg-[#141416] border border-white/[0.08] flex items-center justify-center" style={{ borderRadius: 14, padding: 20, minHeight: 200 }}>
            {enabled ? (
              <RecruiterPreviewCard
                data={{ ...previewData, sections: Array.from(sections) }}
                activeSection={activeSection}
                onSelectSection={setActiveSection}
                logoUrl="/logo.png"
              />
            ) : (
              <div className="flex flex-col items-center text-center" style={{ gap: 8, padding: "36px 12px" }}>
                <Users size={20} strokeWidth={2} className="text-white/30" />
                <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 13, margin: 0 }}>
                  Your profile is hidden from recruiters right now.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
