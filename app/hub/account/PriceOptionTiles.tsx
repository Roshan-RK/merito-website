"use client";

import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";

export type PriceOptionTilesProps = {
  soloProduct: "report" | "personality" | "references";
  soloLabel: string;
  level: CandidateLevel;
  bundleEligible: boolean;
  submitting: boolean;
  onContinue: (selection: "solo" | "bundle") => void;
};

export default function PriceOptionTiles({
  soloProduct,
  soloLabel,
  level,
  bundleEligible,
  submitting,
  onContinue,
}: PriceOptionTilesProps) {
  const soloPrice = PRODUCT_PRICING[soloProduct][level];
  const bundlePrice = PRODUCT_PRICING.bundle[level];
  const savings =
    PRODUCT_PRICING.report[level] + PRODUCT_PRICING.personality[level] + PRODUCT_PRICING.references[level] - bundlePrice;

  if (!bundleEligible) {
    return (
      <>
        <button
          onClick={() => onContinue("solo")}
          disabled={submitting}
          className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
          style={{ height: 50, borderRadius: 8, fontSize: 15, background: submitting ? "#dcdcdc" : "#ed1a24", border: "none", cursor: submitting ? "default" : "pointer", boxShadow: submitting ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
        >
          {submitting ? "Redirecting…" : `Continue to payment — ${formatPrice(soloPrice)}`}
        </button>
        <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
          One-time payment · No subscription · UPI, card & netbanking
        </p>
      </>
    );
  }

  return (
    <>
      <div
        onClick={() => !submitting && onContinue("bundle")}
        style={{ background: "#12121f", borderRadius: 14, padding: 18, marginBottom: 12, cursor: submitting ? "default" : "pointer" }}
      >
        <span
          className="font-[family-name:var(--font-poppins)] font-bold uppercase"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "#ed1a24" }}
        >
          Recommended · Save {formatPrice(savings)}
        </span>
        <p className="font-[family-name:var(--font-gabarito)] font-bold text-white" style={{ fontSize: "1.4rem", margin: "6px 0 4px" }}>
          Full Bundle — {formatPrice(bundlePrice)}
        </p>
        <p style={{ color: "#c7c7cf", fontSize: 11.5, margin: "0 0 12px" }}>
          Includes: Detailed Report + Personality Test + Reference Checks
        </p>
        <button
          disabled={submitting}
          className="font-[family-name:var(--font-poppins)] font-semibold"
          style={{ width: "100%", height: 44, borderRadius: 8, fontSize: 14, background: submitting ? "#dcdcdc" : "#fff", color: "#000", border: "none", cursor: submitting ? "default" : "pointer" }}
        >
          {submitting ? "Redirecting…" : "Get the bundle"}
        </button>
      </div>

      <p style={{ textAlign: "center", margin: "0 0 12px" }}>
        <span
          onClick={() => !submitting && onContinue("solo")}
          className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]"
          style={{ fontSize: 12, textDecoration: "underline", cursor: submitting ? "default" : "pointer" }}
        >
          {soloLabel} for {formatPrice(soloPrice)} instead →
        </span>
      </p>

      <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: 0 }}>
        One-time payment · No subscription · UPI, card & netbanking
      </p>
    </>
  );
}
