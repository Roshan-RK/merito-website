"use client";

import { useState } from "react";
import type { ReportType } from "../reportSections";
import type { LookupResponse } from "@/shared/recruiter-preview/types";
import { RecruiterPreviewCard } from "@/shared/recruiter-preview/RecruiterPreviewCard";

const SECTION_LABELS: Record<ReportType, string> = {
  fitment: "Fitment report",
  personality: "Personality profile",
  interview: "AI interview report",
  references: "Reference checks",
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
      <main style={{ padding: "48px 20px", maxWidth: 820, margin: "0 auto" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem" }}>
          Recruiter Preview
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
          Complete at least one report — fitment, personality, AI interview, or reference checks — before you can make
          your profile visible to recruiters.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: "48px 20px", maxWidth: 820, margin: "0 auto" }}>
      <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem" }}>
        Recruiter Preview
      </h1>
      <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13.5, margin: "6px 0 24px" }}>
        Control what recruiters see about you via the Merito Hub recruiter preview, before they ever reach out. Raw
        scores, the AI recommendation, and the integrity assessment are never included.
      </p>

      <div style={{ marginBottom: 20 }}>
        <label
          htmlFor="linkedin-url"
          className="font-[family-name:var(--font-poppins)] font-semibold text-black"
          style={{ fontSize: 13, display: "block", marginBottom: 6 }}
        >
          Your LinkedIn profile URL
        </label>
        <input
          id="linkedin-url"
          type="url"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/your-name"
          className="font-[family-name:var(--font-poppins)]"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)", fontSize: 13.5 }}
        />
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: "6px 0 0" }}>
          Must be your own LinkedIn profile — this is what recruiters&apos; extension will match against.
        </p>
      </div>

      <label className="flex items-center" style={{ gap: 10, marginBottom: 16, cursor: "pointer" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 14 }}>
          Visible to recruiters
        </span>
      </label>

      {enabled && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, paddingLeft: 4 }}>
          {SELECTABLE_SECTIONS.map((section) => (
            <label
              key={section}
              className="flex items-center"
              style={{ gap: 10, opacity: available[section] ? 1 : 0.4, cursor: available[section] ? "pointer" : "not-allowed" }}
            >
              <input
                type="checkbox"
                checked={sections.has(section)}
                disabled={!available[section]}
                onChange={() => toggleSection(section)}
              />
              <span className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5 }}>
                {SECTION_LABELS[section]}
                {!available[section] ? " (not available yet)" : ""}
              </span>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saveState === "saving"}
        className="font-[family-name:var(--font-poppins)] font-semibold text-white"
        style={{ background: "#ed1a24", border: "none", borderRadius: 8, padding: "10px 22px", fontSize: 13.5, cursor: "pointer", marginBottom: 12 }}
      >
        {saveState === "saving" ? "Saving…" : "Save"}
      </button>
      {saveState === "saved" && (
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: "#16803c", margin: "0 0 24px" }}>
          Saved.
        </p>
      )}
      {saveState === "error" && errorMessage && (
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: "#ed1a24", margin: "0 0 24px" }}>
          {errorMessage}
        </p>
      )}

      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.15rem", margin: "32px 0 4px" }}>
        Live preview
      </h2>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12.5, margin: "0 0 20px" }}>
        {enabled ? "This is exactly what a recruiter would see." : 'Turn on "Visible to recruiters" to see a preview.'}
      </p>

      {enabled && (
        <RecruiterPreviewCard
          data={{ ...previewData, sections: Array.from(sections) }}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          logoUrl="/logo.png"
        />
      )}
    </main>
  );
}
