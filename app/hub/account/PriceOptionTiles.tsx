"use client";

import { useState } from "react";
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
  const [selection, setSelection] = useState<"solo" | "bundle">("bundle");

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

  const selectedPrice = selection === "bundle" ? bundlePrice : soloPrice;

  return (
    <>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div
          onClick={() => setSelection("solo")}
          className="bg-white"
          style={{ flex: "1 1 200px", cursor: "pointer", borderRadius: 12, padding: 14, border: `2px solid ${selection === "solo" ? "#ed1a24" : "#dcdcdc"}` }}
        >
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: 0 }}>
            {soloLabel}
          </p>
          <p className="font-[family-name:var(--font-gabarito)] font-bold text-black" style={{ fontSize: "1.3rem", margin: "6px 0 0" }}>
            {formatPrice(soloPrice)}
          </p>
        </div>
        <div
          onClick={() => setSelection("bundle")}
          className="bg-white"
          style={{ flex: "1 1 200px", cursor: "pointer", borderRadius: 12, padding: 14, border: `2px solid ${selection === "bundle" ? "#ed1a24" : "#dcdcdc"}` }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: 0 }}>
              Full Bundle
            </p>
            <span
              className="font-[family-name:var(--font-poppins)] font-bold text-white"
              style={{ fontSize: 10, background: "#16803c", borderRadius: 50, padding: "2px 8px" }}
            >
              Save {formatPrice(savings)}
            </span>
          </div>
          <p className="font-[family-name:var(--font-gabarito)] font-bold text-black" style={{ fontSize: "1.3rem", margin: "6px 0 0" }}>
            {formatPrice(bundlePrice)}
          </p>
          <p className="text-[#9c9c9c]" style={{ fontSize: 11, margin: "6px 0 0" }}>
            Includes: Detailed Report + Personality Test + Reference Checks
          </p>
        </div>
      </div>

      <button
        onClick={() => onContinue(selection)}
        disabled={submitting}
        className="w-full font-[family-name:var(--font-poppins)] font-semibold text-white"
        style={{ height: 50, borderRadius: 8, fontSize: 15, background: submitting ? "#dcdcdc" : "#ed1a24", border: "none", cursor: submitting ? "default" : "pointer", boxShadow: submitting ? "none" : "0 4px 6px rgba(236,34,40,0.3)" }}
      >
        {submitting ? "Redirecting…" : `Continue to payment — ${formatPrice(selectedPrice)}`}
      </button>
      <p className="text-[#9c9c9c]" style={{ fontSize: 11.5, textAlign: "center", margin: "10px 0 0" }}>
        One-time payment · No subscription · UPI, card & netbanking
      </p>
    </>
  );
}
