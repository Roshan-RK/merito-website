import { Mic, Loader2 } from "lucide-react";

// Renders for a finished interview whose report isn't in report_raw yet --
// resolveInterviewViewState maps ib_interview_status EVALUATING/EVALUATED with
// no report to "processing". IntervueBox generates the report seconds to a few
// minutes after the interview ends; InterviewStatusPoller refreshes this page
// automatically once fitment_interviews.status flips to "ready". No action for
// the candidate to take -- deliberately no button.
export default function InterviewProcessingState({ roleTitle }: { roleTitle: string }) {
  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 24 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 14 }}>
        <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <Mic size={17} strokeWidth={2} />
        </div>
        <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
          Mock AI interview for {roleTitle}
        </span>
      </div>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 10 }}>
        <Loader2 size={16} strokeWidth={2} className="text-[#ed1a24] animate-spin shrink-0" />
        <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 14 }}>
          Scoring your interview
        </span>
      </div>
      <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 13, lineHeight: 1.65, margin: 0 }}>
        Thanks — we&apos;ve got your interview. It usually takes a few minutes to score. This page updates
        itself the moment your report is ready, so you can wait here or close this and come back later.
      </p>
    </div>
  );
}
