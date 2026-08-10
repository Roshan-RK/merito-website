import { useRef, useState } from "react";
import logoPath from "../assets/logo.png";
import { RecruiterPreviewCard, type SectionKey } from "../../../shared/recruiter-preview/RecruiterPreviewCard";
import type { LookupResponse } from "../../../shared/recruiter-preview/types";

const logoUrl = chrome.runtime.getURL(logoPath.replace(/^\//, ""));

const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

export type RescoreState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; fitment: NonNullable<LookupResponse["fitment"]> };

function Badge({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: "fixed",
        top: 90,
        right: 24,
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: "#ffffff",
        border: "1px solid #E6E1ED",
        borderRadius: 999,
        boxShadow: "0 3px 10px rgba(20,15,35,0.12)",
        padding: "8px 14px",
        zIndex: 999999,
        fontFamily: SANS,
        fontSize: 12.5,
        fontWeight: 600,
        color: "#211D2C",
        cursor: "pointer",
      }}
    >
      <img src={logoUrl} alt="Merito" style={{ height: 16, width: "auto", display: "block" }} />
      <span style={{ width: 1, height: 14, background: "#E6E1ED" }} />
      Preview available
    </button>
  );
}

function RescoreBanner({ state }: { state: RescoreState }) {
  if (state.status !== "loading") return null;
  return (
    <div
      style={{
        margin: "10px 16px 0",
        padding: "8px 12px",
        borderRadius: 10,
        background: "#ECEBF7",
        color: "#4B4894",
        fontSize: 11.5,
        fontFamily: SANS,
        fontWeight: 600,
      }}
    >
      Scoring against your JD…
    </div>
  );
}

export function Overlay({ data, rescore = { status: "idle" } }: { data: LookupResponse; rescore?: RescoreState }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("fitment");
  const cardRef = useRef<HTMLDivElement>(null);

  function selectSection(key: SectionKey) {
    setActiveSection(key);
    requestAnimationFrame(() => cardRef.current?.scrollTo({ top: 0 }));
  }

  if (!expanded) {
    return <Badge onClick={() => setExpanded(true)} />;
  }

  const mergedData: LookupResponse =
    rescore.status === "ready"
      ? {
          ...data,
          fitment: rescore.fitment,
          sections: data.sections.includes("fitment") ? data.sections : [...data.sections, "fitment"],
        }
      : data;

  return (
    <div
      ref={cardRef}
      style={{
        position: "fixed",
        top: 90,
        right: 24,
        maxHeight: "80vh",
        overflowY: "auto",
        zIndex: 999999,
        borderRadius: 16,
      }}
    >
      <RescoreBanner state={rescore} />
      <RecruiterPreviewCard
        data={mergedData}
        activeSection={activeSection}
        onSelectSection={selectSection}
        logoUrl={logoUrl}
        onClose={() => setExpanded(false)}
      />
    </div>
  );
}
