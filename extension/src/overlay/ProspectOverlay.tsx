import { useEffect, useState } from "react";
import logoPath from "../assets/logo.png";
import type { LookupResponse } from "../../../shared/recruiter-preview/types";

const logoUrl = chrome.runtime.getURL(logoPath.replace(/^\//, ""));
const SANS = "-apple-system, 'Segoe UI', Roboto, sans-serif";

export type ProspectState =
  | { status: "needs_setup" }
  | { status: "prompt" }
  | { status: "loading" }
  | { status: "scoring" }
  | { status: "verification_required" }
  | { status: "lookup_verification_required" }
  | { status: "cap_exceeded" }
  | { status: "error" }
  | { status: "ready"; fitment: NonNullable<LookupResponse["fitment"]>; prospectId: string }
  | { status: "shortlisted"; fitment: NonNullable<LookupResponse["fitment"]>; prospectId: string; claimUrl: string; inviteText: string };

const CARD_STYLE: React.CSSProperties = {
  position: "fixed",
  top: 90,
  right: 24,
  width: 300,
  background: "#ffffff",
  border: "1px solid #E6E1ED",
  borderRadius: 16,
  boxShadow: "0 3px 10px rgba(20,15,35,0.12)",
  padding: 16,
  zIndex: 999999,
  fontFamily: SANS,
  fontSize: 12.5,
  color: "#211D2C",
};

function Header() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <img src={logoUrl} alt="Merito" style={{ height: 16 }} />
      <strong>Not yet on Merito</strong>
    </div>
  );
}

const SCORING_MESSAGES = [
  "Reading their experience…",
  "Comparing skills against your JD…",
  "Weighing relevant projects…",
  "Scoring overall fit…",
  "Almost there…",
];
const SCORING_MESSAGE_INTERVAL_MS = 6_000;

function ScoringStatus() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SCORING_MESSAGES.length);
    }, SCORING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);
  return <p style={{ margin: 0 }}>{SCORING_MESSAGES[index]}</p>;
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes merito-prospect-spin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: "50%",
          border: "2px solid #E6E1ED",
          borderTopColor: "#4B4894",
          animation: "merito-prospect-spin 0.8s linear infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}

export function ProspectOverlay({
  state,
  onScore,
  onShortlist,
}: {
  state: ProspectState;
  onScore: () => void;
  onShortlist: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (state.status === "needs_setup") {
    return (
      <div style={CARD_STYLE}>
        <Header />
        <p>Set your JD and confirm your email in the extension popup to score this profile.</p>
      </div>
    );
  }
  if (state.status === "prompt") {
    return (
      <div style={CARD_STYLE}>
        <Header />
        <p>Score this candidate against your JD? Uses one of your monthly checks.</p>
        <button onClick={onScore}>Check this candidate</button>
      </div>
    );
  }
  if (state.status === "loading") {
    return (
      <div style={CARD_STYLE}>
        <Header />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Spinner />
          <p style={{ margin: 0 }}>Starting…</p>
        </div>
      </div>
    );
  }
  if (state.status === "scoring") {
    return (
      <div style={CARD_STYLE}>
        <Header />
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Spinner />
          <ScoringStatus />
        </div>
        <p style={{ color: "#6C6779", margin: "0 0 8px" }}>Can take up to ~2 minutes.</p>
        <p style={{ color: "#6C6779" }}>
          Feel free to keep browsing. Come back to this profile and we&apos;ll show the result — it won&apos;t re-run or spend another check.
        </p>
      </div>
    );
  }
  if (state.status === "verification_required") {
    return (
      <div style={CARD_STYLE}>
        <Header />
        <p>Confirm your email (check your inbox) then click retry.</p>
        <button onClick={onScore}>Retry</button>
      </div>
    );
  }
  if (state.status === "lookup_verification_required") {
    return (
      <div style={CARD_STYLE}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <img src={logoUrl} alt="Merito" style={{ height: 16 }} />
          <strong>Verify your email</strong>
        </div>
        <p>Confirm your email in the extension popup to use Merito, then click retry.</p>
        <button onClick={onScore}>Retry</button>
      </div>
    );
  }
  if (state.status === "cap_exceeded") {
    return (
      <div style={CARD_STYLE}>
        <Header />
        <p>You&apos;ve reached your 10 scored profiles this month. Resets next month.</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div style={CARD_STYLE}>
        <Header />
        <p>Something went wrong.</p>
        <button onClick={onScore}>Retry</button>
      </div>
    );
  }

  const score = state.fitment?.report.overallScore;
  return (
    <div style={CARD_STYLE}>
      <Header />
      <p>
        Fit score: <strong>{score != null ? Math.round(score) : "-"}/100</strong>
      </p>
      <p style={{ color: "#4B4894" }}>{state.fitment?.report.summary}</p>
      {state.status === "ready" && <button onClick={onShortlist}>Shortlist &amp; get invite link</button>}
      {state.status === "shortlisted" && (
        <div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(state.inviteText);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy invite message"}
          </button>
        </div>
      )}
    </div>
  );
}
