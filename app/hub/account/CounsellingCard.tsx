"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";

export default function CounsellingCard({
  priceLabel,
  requested,
  onOpenPaywall,
}: {
  priceLabel: string;
  requested: boolean;
  onOpenPaywall: () => void;
}) {
  return (
    <div
      data-tour="guidance"
      className="flex items-center flex-wrap"
      style={{
        background: "linear-gradient(to bottom right,#000,#1a1a1a,#2d0a0c)",
        borderRadius: 20,
        padding: "22px",
        gap: 20,
      }}
    >
      <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 48, height: 48, borderRadius: "50%" }}>
        <UserRound size={22} strokeWidth={2} />
      </div>

      <div style={{ flex: 1, minWidth: 240 }}>
        <span
          style={{
            display: "inline-flex",
            borderRadius: 50,
            background: "#ed1a24",
            padding: "4px 12px",
            fontSize: 9,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "#fff",
          }}
        >
          1:1 guidance · Highest impact
        </span>
        <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.1rem", lineHeight: 1.3, margin: "10px 0 0" }}>
          Talk to a Merito career expert
        </p>
        <p className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 12.5, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: "6px 0 0" }}>
          Reads your fitment, personality and mock interview results — then gives you a straight, personalised plan.
        </p>
        <Link
          href="/hub/account/expert"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] hover:text-white transition-colors"
          style={{ display: "inline-block", fontSize: 12, margin: "8px 0 0" }}
        >
          Meet Rushikesh & see her track record →
        </Link>
      </div>

      <div className="shrink-0">
        {requested ? (
          <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13 }}>
            Request sent — we&apos;ll confirm your slot.
          </p>
        ) : (
          <button
            onClick={onOpenPaywall}
            className="font-[family-name:var(--font-poppins)] font-semibold"
            style={{ background: "#fff", color: "#0a0a0a", border: "none", borderRadius: 8, padding: "12px 18px", fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Book my expert call — {priceLabel}
          </button>
        )}
      </div>
    </div>
  );
}
