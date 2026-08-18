"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, Quote } from "lucide-react";
import { MIN_REFERENCES, REFERENCE_CATEGORIES } from "@/lib/referenceChecks";
import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import ReferencesPaywallModal from "../ReferencesPaywallModal";

const CARD = "bg-[#141416] border border-white/[0.08]";

const TEAMWORK_LABEL = REFERENCE_CATEGORIES.find((c) => c.value === "teamwork")?.label ?? "Teamwork";

const STEPS = [
  `Add ${MIN_REFERENCES} people who've worked with you: a manager, teammate, or client`,
  "We email each of them a private, one-time link. No login needed",
  `See their ratings and quotes here as soon as all ${MIN_REFERENCES} respond`,
];

export default function ReferencesLockedState({
  leadId,
  level,
  bundleEligible,
}: {
  leadId: string;
  level: CandidateLevel;
  bundleEligible: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const priceLabel = formatPrice(PRODUCT_PRICING.references[level]);

  return (
    <div className={CARD} style={{ borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: 24 }}>
        <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <Users size={17} strokeWidth={2} />
            </div>
            <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
              Reference checks
            </span>
          </div>
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15 }}>
            {priceLabel}
          </span>
        </div>

        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white/85" style={{ fontSize: 14, margin: "0 0 6px" }}>
          Let the people who&apos;ve worked with you make your case.
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 16px" }}>
          Invite {MIN_REFERENCES} people who&apos;ve worked with you to rate you across {REFERENCE_CATEGORIES.length} categories and leave a
          short note. It&apos;s verified feedback, not a self-assessment.
        </p>

        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 18 }}>
          {[`${REFERENCE_CATEGORIES.length} categories`, `${MIN_REFERENCES} referees`, "Verified feedback"].map((b) => (
            <span
              key={b}
              className="bg-white/[0.05] border border-white/[0.08] font-[family-name:var(--font-poppins)] text-white/60"
              style={{ fontSize: 12, borderRadius: 999, padding: "6px 13px" }}
            >
              {b}
            </span>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start" style={{ gap: 10 }}>
              <span
                className="flex items-center justify-center shrink-0 bg-[#ed1a24]/15 text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
                style={{ width: 18, height: 18, borderRadius: "50%", fontSize: 10, marginTop: 1 }}
              >
                {i + 1}
              </span>
              <span className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
          style={{ gap: 8, height: 48, padding: "0 24px", borderRadius: 8, fontSize: 14.5, border: "none", cursor: "pointer" }}
        >
          <UserPlus size={15} strokeWidth={2} />
          Start my reference check for {priceLabel}
        </button>
      </div>

      <div className="border-t border-white/[0.08] bg-white/[0.02]" style={{ padding: 20 }}>
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 12px" }}>
          Preview: what you&apos;ll get
        </p>
        <div className="select-none" style={{ opacity: 0.8, filter: "blur(3px)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="bg-white/[0.04]" style={{ borderRadius: 10, padding: 12 }}>
            <p className="flex items-start font-[family-name:var(--font-poppins)] text-white/70" style={{ gap: 6, fontSize: 12, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
              <Quote size={12} strokeWidth={2} className="text-white/25 shrink-0" style={{ marginTop: 2 }} />
              &quot;The person you want on-call during a bad outage. Calm, methodical, and keeps the team...&quot;
            </p>
            <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11, margin: "6px 0 0" }}>
              Manager, Nimbus Systems
            </p>
          </div>
          <div className="flex items-center" style={{ gap: 12 }}>
            <span className="font-[family-name:var(--font-poppins)] text-white/50 shrink-0" style={{ fontSize: 12, width: 90 }}>
              {TEAMWORK_LABEL}
            </span>
            <div className="bg-white/[0.08] overflow-hidden" style={{ height: 6, borderRadius: 6, flex: 1 }}>
              <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: "92%" }} />
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ReferencesPaywallModal
          leadId={leadId}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModalOpen(false)}
          onUnlocked={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
