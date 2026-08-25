import { useRef, useState } from "react";
import logoPath from "../assets/logo.png";
import { RecruiterPreviewCard, type SectionKey } from "../../../shared/recruiter-preview/RecruiterPreviewCard";
import type { LookupResponse, LookupWireResponse } from "../../../shared/recruiter-preview/types";
import { flattenLookupRole, pickActiveSection } from "../lib/lookupApi";

const logoUrl = chrome.runtime.getURL(logoPath.replace(/^\//, ""));

const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

export type RescoreState =
  | { status: "idle" }
  | { status: "prompt" }
  | { status: "loading" }
  | { status: "cap_exceeded" }
  | { status: "error" }
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

function openExtensionPopup() {
  chrome.runtime.sendMessage({ type: "OPEN_POPUP" }).catch(() => {});
}

export function Overlay({
  data,
  rescore = { status: "idle" },
  onRequestContactDetails,
  selectedLeadId,
  onSelectRole,
  onCheckFitment,
}: {
  data: LookupWireResponse;
  rescore?: RescoreState;
  onRequestContactDetails?: () => Promise<{ email: string } | { error: string } | null>;
  selectedLeadId: string | null;
  onSelectRole: (leadId: string) => void;
  onCheckFitment?: () => void;
}) {
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

  const flattened = flattenLookupRole(data, selectedLeadId);
  // A JD rescore result is shown under the "fitment" tab regardless of
  // whether the selected role has its own fitment section -- include it as
  // a fallback candidate so switching roles while a rescore is active
  // doesn't make the JD breakdown unreachable.
  const sectionsForFallback =
    rescore.status === "ready" && !flattened.sections.includes("fitment")
      ? [...flattened.sections, "fitment"]
      : flattened.sections;
  const effectiveActiveSection = pickActiveSection(sectionsForFallback, activeSection) as SectionKey;
  const availableRoles = data.roles.map((r) => ({ leadId: r.leadId, roleTitle: r.roleTitle }));

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
        data={flattened}
        activeSection={effectiveActiveSection}
        onSelectSection={selectSection}
        logoUrl={logoUrl}
        onClose={() => setExpanded(false)}
        onRequestContactDetails={onRequestContactDetails}
        jdRescoreStatus={rescore.status}
        onOpenExtension={openExtensionPopup}
        onCheckFitment={onCheckFitment}
        rescoreFitment={rescore.status === "ready" ? rescore.fitment : null}
        availableRoles={availableRoles}
        selectedLeadId={selectedLeadId ?? undefined}
        onSelectRole={onSelectRole}
      />
    </div>
  );
}
