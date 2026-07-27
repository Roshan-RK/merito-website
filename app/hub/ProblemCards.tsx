"use client";

import { useState } from "react";

const CARDS = [
  { label: "Students & Freshers", quote: "I've applied to 30 jobs and heard nothing.", reality: "You're not being rejected, you're one of 500 look-alike CVs a recruiter skims in seconds, with no way to show what a CV alone never could." },
  { label: "Mid-Level Professionals", quote: "My work speaks for itself. So why does the promotion keep going to someone else?", reality: "Your delivery is obvious. Your readiness for more isn't, and nothing about a standard CV proves it." },
  { label: "Senior & Leadership", quote: "I used to get approached. Lately, nothing.", reality: "Hiring at your level runs on quiet signal and trusted networks. There's no way to stay visible on your own terms, without accidentally tipping your hand to the wrong people." },
];

export default function ProblemCards() {
  const [flipped, setFlipped] = useState<number | null>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 16 }}>
      {CARDS.map((c, i) => {
        const isFlipped = flipped === i;
        return (
          <div
            key={c.quote}
            onClick={() => setFlipped(isFlipped ? null : i)}
            className="group cursor-pointer"
            style={{ perspective: 1000, minHeight: 230 }}
          >
            <div
              className="relative w-full h-full transition-transform sm:group-hover:[transform:rotateY(180deg)]"
              style={{
                minHeight: 230,
                transformStyle: "preserve-3d",
                transitionDuration: "600ms",
                transitionTimingFunction: "cubic-bezier(0.23,1,0.32,1)",
                transform: isFlipped ? "rotateY(180deg)" : undefined,
              }}
            >
              {/* Front */}
              <div
                className="absolute inset-0 flex flex-col bg-[#fef7f7] border border-[#f4d8d8] box-border"
                style={{ borderRadius: 18, padding: 22, backfaceVisibility: "hidden", gap: 14, boxShadow: "0px 18px 50px rgba(17,35,89,0.04)" }}
              >
                <span className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 11, letterSpacing: "0.05em" }}>
                  {c.label}
                </span>
                <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.25rem", lineHeight: 1.35, margin: 0 }}>
                  &ldquo;{c.quote}&rdquo;
                </p>
                <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#9c9c9c]" style={{ marginTop: "auto", fontSize: 11 }}>
                  Hover for the reality →
                </span>
              </div>
              {/* Back */}
              <div
                className="absolute inset-0 flex flex-col justify-center bg-white border border-black/[0.08] box-border"
                style={{
                  borderRadius: 18,
                  padding: 22,
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  gap: 12,
                  boxShadow: "0px 18px 50px rgba(17,35,89,0.04)",
                }}
              >
                <span className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 11, letterSpacing: "0.05em" }}>
                  The reality
                </span>
                <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.7, margin: 0 }}>
                  {c.reality}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
