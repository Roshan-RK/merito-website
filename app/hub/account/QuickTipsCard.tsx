import { Compass } from "lucide-react";

// The mockup's "Quick tour" card launches a 9-step interactive walkthrough
// and a 67-second video -- neither exists in this app, so rather than wire
// up dead buttons this is a static orientation card instead.
export default function QuickTipsCard() {
  return (
    <div className="flex items-start bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 16, padding: 18, gap: 14 }}>
      <div className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24] shrink-0" style={{ width: 40, height: 40, borderRadius: 10 }}>
        <Compass size={19} strokeWidth={2} />
      </div>
      <div>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 14, margin: "0 0 6px" }}>
          How Merito Hub works
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          Your fitment score is per role. Personality test and reference checks are one-time and apply to every application
          once done. Use the sidebar to jump between them anytime.
        </p>
      </div>
    </div>
  );
}
