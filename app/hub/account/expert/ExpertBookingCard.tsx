import { UserRound } from "lucide-react";
import ExpertBookingButton from "./ExpertBookingButton";

// Booking CTA from the mockup's expert-guidance page (the card below the
// bio, not the bio card itself) -- reuses the same CounsellingPaywallModal
// and "requested" copy CounsellingCard.tsx already established on the
// Overview page, rather than a new modal or the mockup's own "Call booked"
// wording. Button + modal logic lives in ExpertBookingButton so the closing
// CTA card further down the page can reuse the same booking flow.
export default function ExpertBookingCard({
  firstName,
  priceLabel,
  initialRequested,
}: {
  firstName: string;
  priceLabel: string;
  initialRequested: boolean;
}) {
  return (
    <div
      className="bg-[#141416] border border-white/[0.08] flex items-center flex-wrap"
      style={{ borderRadius: 20, padding: 22, gap: 16 }}
    >
      <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 42, height: 42, borderRadius: 10 }}>
        <UserRound size={19} strokeWidth={2} />
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 14, margin: 0 }}>
          Book your session with {firstName}
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "4px 0 0" }}>
          30 minutes, video call. He&apos;ll have read your fitment, personality and mock interview results beforehand.
        </p>
      </div>
      <div className="shrink-0">
        <ExpertBookingButton priceLabel={priceLabel} initialRequested={initialRequested} />
      </div>
    </div>
  );
}
