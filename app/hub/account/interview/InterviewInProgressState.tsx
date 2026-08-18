import { Mic, Clock } from "lucide-react";

// Renders for fitment_interviews.status === "invited" -- payment already
// happened and an interview invite was already sent, so this is
// deliberately NOT a paywall (see InterviewLockedState for the unpaid
// state). Copy adapts the mockup's in_progress card
// ("Your mock interview is running — this updates automatically when it is
// done.") to this app's real invite-by-email flow: the interview itself
// runs externally on IntervueBox, not inline on this page.
export default function InterviewInProgressState({ roleTitle }: { roleTitle: string }) {
  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 24 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 14 }}>
        <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <Mic size={17} strokeWidth={2} />
        </div>
        <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
          Mock AI interview — {roleTitle}
        </span>
      </div>
      <div className="flex items-start bg-white/[0.04]" style={{ gap: 10, borderRadius: 10, padding: 14 }}>
        <Clock size={15} strokeWidth={2} className="text-white/40 shrink-0" style={{ marginTop: 1 }} />
        <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 13, lineHeight: 1.65, margin: 0 }}>
          We&apos;ve sent your AI interview invite for {roleTitle} — open it from your email to complete it on IntervueBox whenever you&apos;re
          ready. This page updates automatically once your scored report is ready.
        </p>
      </div>
    </div>
  );
}
