"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Unlock, Quote } from "lucide-react";
import { PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import ReportPaywallModal from "../ReportPaywallModal";

const CARD = "bg-[#141416] border border-white/[0.08]";

const WHAT_YOU_GET = [
  "Assessment summary in plain language",
  "6-dimension breakdown — skills, education, experience, location, domain, role fit",
  "Strong points and gaps, each explained",
  "Full candidate profile — education and experience timeline",
];

export default function ReportLockedState({
  leadId,
  roleTitle,
  level,
  bundleEligible,
  skillTags,
  previewSummary,
  previewCategory,
}: {
  leadId: string;
  roleTitle: string;
  level: CandidateLevel;
  bundleEligible: boolean;
  skillTags: string[];
  previewSummary: string | null;
  previewCategory: { label: string; score: number } | null;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();
  const priceLabel = formatPrice(PRODUCT_PRICING.report[level]);
  const visibleTags = skillTags.slice(0, 6);
  const extraTagCount = skillTags.length - visibleTags.length;

  return (
    <div className={CARD} style={{ borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: 24 }}>
        <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 12 }}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24] shrink-0" style={{ width: 36, height: 36, borderRadius: 10 }}>
              <FileText size={17} strokeWidth={2} />
            </div>
            <span className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.05rem" }}>
              Fitment report
            </span>
          </div>
          <span className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 15 }}>
            {priceLabel}
          </span>
        </div>

        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white/85" style={{ fontSize: 14, margin: "0 0 6px" }}>
          Know exactly where you stand before a recruiter does.
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.65, margin: "0 0 16px" }}>
          Already generated from your CV and the {roleTitle} JD — unlock the full breakdown: your strengths, your gaps, and exactly how
          to fix your CV.
        </p>

        {visibleTags.length > 0 && (
          <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 18 }}>
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="bg-white/[0.05] border border-white/[0.08] font-[family-name:var(--font-poppins)] text-white/60"
                style={{ fontSize: 12, borderRadius: 999, padding: "6px 13px" }}
              >
                {tag}
              </span>
            ))}
            {extraTagCount > 0 && (
              <span
                className="border border-dashed border-white/[0.15] font-[family-name:var(--font-poppins)] text-white/40"
                style={{ fontSize: 12, borderRadius: 999, padding: "6px 13px" }}
              >
                +{extraTagCount} more
              </span>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
          {WHAT_YOU_GET.map((item, i) => (
            <div key={i} className="flex items-start" style={{ gap: 10 }}>
              <span
                className="flex items-center justify-center shrink-0 bg-[#ed1a24]/15 text-[#ed1a24] font-[family-name:var(--font-poppins)] font-bold"
                style={{ width: 18, height: 18, borderRadius: "50%", fontSize: 10, marginTop: 1 }}
              >
                {i + 1}
              </span>
              <span className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
                {item}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
          style={{ gap: 8, height: 48, padding: "0 24px", borderRadius: 8, fontSize: 14.5, border: "none", cursor: "pointer" }}
        >
          <Unlock size={15} strokeWidth={2} />
          Unlock full report — {priceLabel}
        </button>
      </div>

      <div className="border-t border-white/[0.08] bg-white/[0.02]" style={{ padding: 20 }}>
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 10.5, letterSpacing: "0.06em", margin: "0 0 12px" }}>
          Preview — what you&apos;ll get
        </p>
        <div className="select-none" style={{ opacity: 0.8, filter: "blur(3px)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="bg-white/[0.04]" style={{ borderRadius: 10, padding: 12 }}>
            <p className="flex items-start font-[family-name:var(--font-poppins)] text-white/70" style={{ gap: 6, fontSize: 12, fontStyle: "italic", lineHeight: 1.6, margin: 0 }}>
              <Quote size={12} strokeWidth={2} className="text-white/25 shrink-0" style={{ marginTop: 2 }} />
              {previewSummary ??
                "Strong overlap between your background and the core requirements for this role, with a few gaps worth closing before you apply..."}
            </p>
          </div>
          <div className="flex items-center" style={{ gap: 12 }}>
            <span className="font-[family-name:var(--font-poppins)] text-white/50 shrink-0" style={{ fontSize: 12, width: 110 }}>
              {previewCategory?.label ?? "Skills Match"}
            </span>
            <div className="bg-white/[0.08] overflow-hidden" style={{ height: 6, borderRadius: 6, flex: 1 }}>
              <div className="bg-[#ed1a24] h-full" style={{ borderRadius: 6, width: `${previewCategory?.score ?? 85}%` }} />
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ReportPaywallModal
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
