"use client";

import { Package } from "lucide-react";
import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";

export default function BundlePromoCard({ level, onOpenPaywall }: { level: CandidateLevel; onOpenPaywall: () => void }) {
  const bundlePrice = PRODUCT_PRICING.bundle[level];
  const savings =
    PRODUCT_PRICING.report[level] + PRODUCT_PRICING.personality[level] + PRODUCT_PRICING.references[level] - bundlePrice;

  return (
    <div
      data-tour="bundle"
      className="flex items-center flex-wrap border border-white/[0.08]"
      style={{ background: "#141416", borderRadius: 14, padding: 18, gap: 16 }}
    >
      <div className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24] shrink-0" style={{ width: 40, height: 40, borderRadius: 10 }}>
        <Package size={19} strokeWidth={2} />
      </div>

      <div style={{ flex: 1, minWidth: 220 }}>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 14.5, margin: "0 0 3px" }}>
          Bundle: Report + Personality + References
        </p>
        <p className="text-white/50" style={{ fontSize: 12.5, margin: 0 }}>
          Save {formatPrice(savings)} vs buying separately, for just {formatPrice(bundlePrice)}
        </p>
      </div>

      <button
        onClick={onOpenPaywall}
        className="font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors shrink-0"
        style={{ border: "none", borderRadius: 8, padding: "11px 18px", fontSize: 13.5, cursor: "pointer" }}
      >
        Get bundle for {formatPrice(bundlePrice)}
      </button>
    </div>
  );
}
