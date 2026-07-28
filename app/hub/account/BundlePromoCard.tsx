"use client";

import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";

export default function BundlePromoCard({ level, onOpenPaywall }: { level: CandidateLevel; onOpenPaywall: () => void }) {
  const bundlePrice = PRODUCT_PRICING.bundle[level];
  const savings =
    PRODUCT_PRICING.report[level] + PRODUCT_PRICING.personality[level] + PRODUCT_PRICING.references[level] - bundlePrice;

  return (
    <div style={{ background: "#12121f", borderRadius: 14, padding: 18, margin: "0 0 18px" }}>
      <span
        className="font-[family-name:var(--font-poppins)] font-bold uppercase"
        style={{ fontSize: 10, letterSpacing: "0.06em", color: "#ed1a24", background: "rgba(237,26,36,0.15)", borderRadius: 50, padding: "3px 10px" }}
      >
        Save {formatPrice(savings)} · Best value
      </span>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.1rem", margin: "10px 0 4px" }}>
        Get the Full Profile Bundle
      </p>
      <p style={{ color: "#c7c7cf", fontSize: 12.5, margin: "0 0 14px" }}>
        Report + Personality + References, bundled cheaper than buying separately.
      </p>
      <button
        onClick={onOpenPaywall}
        className="font-[family-name:var(--font-poppins)] font-semibold"
        style={{ background: "#fff", color: "#000", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13.5, cursor: "pointer" }}
      >
        Book my bundle — {formatPrice(bundlePrice)}
      </button>
    </div>
  );
}
