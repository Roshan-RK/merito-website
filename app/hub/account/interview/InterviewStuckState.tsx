import { AlertOctagon } from "lucide-react";

// Renders for fitment_interviews.stuck_at != null -- the candidate's one
// resume attempt (has_resumed=true, see app/api/hub/interview/resume/route.ts)
// was already used, and the next launch or resume attempt also failed at
// the vendor. Deliberately has no retry/resume button: clicking one here
// would just repeat the same failing vendor call. Points to the existing
// header Help button instead of inventing a new support channel.
export default function InterviewStuckState({ roleTitle }: { roleTitle: string }) {
  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 24 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 14 }}>
        <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
          <AlertOctagon size={17} strokeWidth={2} />
        </div>
        <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
          We couldn&apos;t restart your interview
        </span>
      </div>
      <div
        className="flex items-start"
        style={{
          gap: 10,
          borderRadius: 10,
          padding: 14,
          background: "rgba(232,121,143,0.08)",
          border: "1px solid rgba(232,121,143,0.25)",
        }}
      >
        <AlertOctagon size={15} strokeWidth={2} style={{ color: "#E8798F", marginTop: 1 }} className="shrink-0" />
        <p className="font-[family-name:var(--font-poppins)]" style={{ color: "#E8798F", fontSize: 13, lineHeight: 1.65, margin: 0 }}>
          Your session for {roleTitle} was interrupted a second time, and we weren&apos;t able to reconnect it automatically. Nothing is
          lost — use the Help button above and we&apos;ll get this sorted out for you.
        </p>
      </div>
    </div>
  );
}
