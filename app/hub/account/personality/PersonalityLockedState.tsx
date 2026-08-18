"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Play } from "lucide-react";
import { ITEMS, IMPRESSION_ITEMS } from "@/lib/personality";
import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import PersonalityPaywallModal from "../PersonalityPaywallModal";

const CARD = "bg-[#141416] border border-white/[0.08]";

const TOTAL_STATEMENTS = ITEMS.length + IMPRESSION_ITEMS.length;

const STEPS = [
  `Rate ${TOTAL_STATEMENTS} short statements, 1 (inaccurate) to 5 (accurate)`,
  "Get your Extroversion, Agreeableness, Conscientiousness, Emotional Stability and Openness scores instantly",
  "Read what each score suggests about how you'll show up at work",
];

const PREVIEW_TRAITS = [
  { label: "Conscientiousness", color: "#EC1B25", value: 88 },
  { label: "Emotional stability", color: "#3B82F6", value: 79 },
  { label: "Agreeableness", color: "#22C55E", value: 72 },
  { label: "Openness", color: "#A855F7", value: 68 },
  { label: "Extroversion", color: "#F59E0B", value: 61 },
];

export default function PersonalityLockedState({
  leadId,
  roleTitle,
  level,
  bundleEligible,
}: {
  leadId: string;
  roleTitle: string;
  level: CandidateLevel;
  bundleEligible: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const priceLabel = formatPrice(PRODUCT_PRICING.personality[level]);

  return (
    <div className={CARD} style={{ borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: 24 }}>
        <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <ClipboardList size={17} strokeWidth={2} />
            </div>
            <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
              Personality test
            </span>
          </div>
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15 }}>
            {priceLabel}
          </span>
        </div>

        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white/85" style={{ fontSize: 14, margin: "0 0 6px" }}>
          Recruiters ask about your style. This answers it before they do.
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 16px" }}>
          A Big Five (OCEAN) assessment mapping how you think, work and relate to others, with what each score means
          for you at work.
        </p>

        <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 18 }}>
          {[`${TOTAL_STATEMENTS} statements`, "~11 minutes", "Instant results"].map((b) => (
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
          <Play size={15} strokeWidth={2} fill="currentColor" />
          Start my personality test for {priceLabel}
        </button>
      </div>

      <div className="border-t border-white/[0.08] bg-white/[0.02]" style={{ padding: 20 }}>
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 12px" }}>
          Preview: what you&apos;ll get
        </p>
        <div className="select-none" style={{ opacity: 0.8, filter: "blur(3px)", display: "flex", flexDirection: "column", gap: 10 }}>
          {PREVIEW_TRAITS.map((t) => (
            <div key={t.label} className="flex items-center" style={{ gap: 12 }}>
              <span className="font-[family-name:var(--font-poppins)] text-white/50 shrink-0" style={{ fontSize: 12, width: 130 }}>
                {t.label}
              </span>
              <div className="bg-white/[0.08] overflow-hidden" style={{ height: 6, borderRadius: 6, flex: 1 }}>
                <div className="h-full" style={{ borderRadius: 6, width: `${t.value}%`, background: t.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {modalOpen && (
        <PersonalityPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
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
