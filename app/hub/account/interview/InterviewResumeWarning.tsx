import { AlertTriangle } from "lucide-react";

// Shared warning callout for the "you get one resume" rule -- shown on both
// InterviewInProgressState (before starting) and InterviewTerminatedState
// (before resuming), since it's the same real constraint
// (fitment_interviews.has_resumed, see app/api/hub/interview/resume/route.ts)
// surfacing in both places.
export default function InterviewResumeWarning() {
  return (
    <div
      className="flex items-start"
      style={{
        gap: 10,
        borderRadius: 10,
        padding: 14,
        marginBottom: 16,
        background: "rgba(189,126,18,0.08)",
        border: "1px solid rgba(189,126,18,0.25)",
      }}
    >
      <AlertTriangle size={15} strokeWidth={2} style={{ color: "#BD7E12", marginTop: 1 }} className="shrink-0" />
      <p className="font-[family-name:var(--font-poppins)]" style={{ color: "#BD7E12", fontSize: 12.5, lineHeight: 1.65, margin: 0 }}>
        You can resume once if your session gets interrupted. A second interruption can&apos;t be recovered automatically — make sure
        your network and power are stable before you begin.
      </p>
    </div>
  );
}
