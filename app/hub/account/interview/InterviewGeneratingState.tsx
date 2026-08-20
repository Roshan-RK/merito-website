"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { messageForElapsedMs, GENERATING_MESSAGE_INTERVAL_MS } from "./interviewGeneratingMessages";

// Renders instead of InterviewInProgressState once isInterviewGenerating()
// (ProgressRail.tsx) is true for this row -- the candidate's interview slot
// has heuristically elapsed but fitment_interviews.status is still "invited"
// (report hasn't landed). No button: same "nothing to do but wait" contract
// as InterviewAppearedState, just with rotating copy since this wait is
// typically the longest of the six view states.
export default function InterviewGeneratingState({ roleTitle }: { roleTitle: string }) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsedMs((ms) => ms + GENERATING_MESSAGE_INTERVAL_MS), GENERATING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 24 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 14 }}>
        <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <Loader2 size={17} strokeWidth={2} className="animate-spin" />
        </div>
        <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
          Generating your report for {roleTitle}
        </span>
      </div>
      <div className="flex items-start bg-white/[0.04]" style={{ gap: 10, borderRadius: 10, padding: 14 }}>
        <Loader2 size={15} strokeWidth={2} className="text-white/40 shrink-0 animate-spin" style={{ marginTop: 1 }} />
        <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 13, lineHeight: 1.65, margin: 0 }}>
          {messageForElapsedMs(elapsedMs)} This page updates automatically the moment your scored report is ready — usually within a few
          minutes.
        </p>
      </div>
    </div>
  );
}
