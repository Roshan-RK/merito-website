"use client";

import { Compass } from "lucide-react";
import { useTourDismissed } from "./OnboardingTour";

// The mockup's "Quick tour" card launches a 9-step interactive walkthrough
// plus a 67-second video. The video doesn't exist here (separate spec,
// explicitly out of scope), but the walkthrough now does -- OnboardingTour.tsx,
// launched from this card's button.
export default function QuickTipsCard({ onStartTour }: { onStartTour: () => void }) {
  const dismissed = useTourDismissed();

  return (
    <div className="flex items-start flex-wrap bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 16, padding: 18, gap: 14 }}>
      <div className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24] shrink-0" style={{ width: 40, height: 40, borderRadius: 10 }}>
        <Compass size={19} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 14, margin: "0 0 6px" }}>
          How Merito Hub works
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: 0 }}>
          Your fitment score is per role. Personality test and reference checks are one-time and apply to every application
          once done. Use the sidebar to jump between them anytime.
        </p>
      </div>
      <button
        onClick={onStartTour}
        className="font-[family-name:var(--font-poppins)] font-semibold text-white shrink-0"
        style={{ background: "none", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, cursor: "pointer" }}
      >
        {dismissed ? "Replay the tour" : "Take the tour"}
      </button>
    </div>
  );
}
