"use client";

import { useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import { FileText, Brain, Users, Mic, UserRound, Package } from "lucide-react";
import type { CandidateLevel } from "@/lib/razorpay/pricing";
import type { InterviewStatus } from "@/app/hub/account/ProgressRail";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import ReportPaywallModal from "@/app/hub/account/ReportPaywallModal";
import PersonalityPaywallModal from "@/app/hub/account/PersonalityPaywallModal";
import ReferencesPaywallModal from "@/app/hub/account/ReferencesPaywallModal";
import InterviewPaywallModal from "@/app/hub/account/InterviewPaywallModal";
import CounsellingPaywallModal from "@/app/hub/account/CounsellingPaywallModal";
import type { PricingCard, PricingCardKey, BundleSummary } from "./pricingCatalog";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

const CARD_ICONS: Record<PricingCardKey, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  report: FileText,
  personality: Brain,
  references: Users,
  interview: Mic,
  counselling: UserRound,
};

const ctaButtonStyle = "font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] bg-transparent";

type Modal = "none" | "report" | "personality" | "references" | "interview" | "counselling";

export default function PricingCardsClient({
  cards,
  bundle,
  level,
  purchasable,
  leadId,
  roleTitle,
  userEmail,
  reportUnlocked: initialReportUnlocked,
  personalityUnlocked: initialPersonalityUnlocked,
  referencesUnlocked: initialReferencesUnlocked,
  interviewStatus: initialInterviewStatus,
  counsellingRequested: initialCounsellingRequested,
}: {
  cards: PricingCard[];
  bundle: BundleSummary;
  level: CandidateLevel;
  purchasable: boolean;
  leadId: string | null;
  roleTitle: string | null;
  userEmail: string;
  reportUnlocked: boolean;
  personalityUnlocked: boolean;
  referencesUnlocked: boolean;
  interviewStatus: InterviewStatus;
  counsellingRequested: boolean;
}) {
  const [modal, setModal] = useState<Modal>("none");
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [personalityUnlocked, setPersonalityUnlocked] = useState(initialPersonalityUnlocked);
  const [referencesUnlocked, setReferencesUnlocked] = useState(initialReferencesUnlocked);
  const [interviewStatus, setInterviewStatus] = useState(initialInterviewStatus);
  const [counsellingRequested, setCounsellingRequested] = useState(initialCounsellingRequested);
  const [, setReport] = useState<ResumeMatchReportReady | null>(null);

  // All three pieces have to still be unowned -- if even one (report
  // included) was already bought solo, the bundle isn't a valid purchase
  // anymore (can't re-sell what's already unlocked, and there's no single
  // "view" destination for a bundle that was never actually bought as one).
  const bundleEligible = purchasable && !reportUnlocked && !personalityUnlocked && !referencesUnlocked;
  const bundlePartiallyOwned = purchasable && !bundleEligible;
  const counsellingCard = cards.find((c) => c.key === "counselling");

  function ctaFor(card: PricingCard) {
    if (!purchasable) {
      return (
        <Link href={leadId ? `/hub/account?lead=${encodeURIComponent(leadId)}` : "/hub/account"} className={ctaButtonStyle} style={{ fontSize: 12.5 }}>
          Get this on Overview →
        </Link>
      );
    }

    if (card.key === "report") {
      if (reportUnlocked) {
        return (
          <Link href={leadId ? `/hub/account/report?lead=${encodeURIComponent(leadId)}` : "/hub/account/report"} className={ctaButtonStyle} style={{ fontSize: 12.5 }}>
            View report →
          </Link>
        );
      }
      return (
        <button onClick={() => setModal("report")} className={ctaButtonStyle} style={{ fontSize: 12.5, cursor: "pointer" }}>
          Get this now →
        </button>
      );
    }

    if (card.key === "personality") {
      if (personalityUnlocked) {
        return (
          <Link href={`/hub/account/personality?role=${encodeURIComponent(roleTitle ?? "")}`} className={ctaButtonStyle} style={{ fontSize: 12.5 }}>
            View results →
          </Link>
        );
      }
      return (
        <button onClick={() => setModal("personality")} className={ctaButtonStyle} style={{ fontSize: 12.5, cursor: "pointer" }}>
          Get this now →
        </button>
      );
    }

    if (card.key === "references") {
      if (referencesUnlocked) {
        return (
          <Link href="/hub/account/references" className={ctaButtonStyle} style={{ fontSize: 12.5 }}>
            View references →
          </Link>
        );
      }
      return (
        <button onClick={() => setModal("references")} className={ctaButtonStyle} style={{ fontSize: 12.5, cursor: "pointer" }}>
          Get this now →
        </button>
      );
    }

    if (card.key === "interview") {
      if (interviewStatus !== "not_started") {
        return (
          <Link
            href={leadId ? `/hub/account/interview?lead=${encodeURIComponent(leadId)}` : "/hub/account/interview"}
            className={ctaButtonStyle}
            style={{ fontSize: 12.5 }}
          >
            View on Overview →
          </Link>
        );
      }
      return (
        <button onClick={() => setModal("interview")} className={ctaButtonStyle} style={{ fontSize: 12.5, cursor: "pointer" }}>
          Get this now →
        </button>
      );
    }

    // counselling
    if (counsellingRequested) {
      return (
        <span className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12.5 }}>
          Already requested
        </span>
      );
    }
    return (
      <button onClick={() => setModal("counselling")} className={ctaButtonStyle} style={{ fontSize: 12.5, cursor: "pointer" }}>
        Get this now →
      </button>
    );
  }

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 1040, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Account
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0 }}>
            Pricing
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
            Everything you can add to your profile, all in one place.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
          {cards.map((card) => {
            const Icon = CARD_ICONS[card.key];
            return (
              <div key={card.key} className="bg-[#141416] border border-white/[0.08] flex flex-col" style={{ borderRadius: 14, padding: 18 }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <div className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24]" style={{ width: 36, height: 36, borderRadius: 10 }}>
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  {card.inBundle && (
                    <span
                      className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40 bg-white/[0.06]"
                      style={{ fontSize: 9.5, letterSpacing: "0.05em", borderRadius: 50, padding: "3px 9px" }}
                    >
                      In bundle
                    </span>
                  )}
                </div>

                <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 4px" }}>
                  {card.label}
                </h3>
                <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 16px", flex: 1 }}>
                  {card.description}
                </p>

                <div className="flex items-baseline" style={{ gap: 6, marginBottom: 12 }}>
                  <span className="font-[family-name:var(--font-gabarito)] font-bold text-white" style={{ fontSize: 20 }}>
                    {card.priceLabel}
                  </span>
                  {card.bundlePriceLabel && (
                    <span className="text-white/40" style={{ fontSize: 11.5 }}>
                      · {card.bundlePriceLabel} bundled
                    </span>
                  )}
                </div>

                {ctaFor(card)}
              </div>
            );
          })}

          <div
            className={bundlePartiallyOwned ? "border border-white/[0.08] flex flex-col" : "border border-[#ed1a24]/30 flex flex-col"}
            style={{
              background: bundlePartiallyOwned ? "#141416" : "linear-gradient(to bottom right, #1a0507, #141416)",
              borderRadius: 14,
              padding: 20,
              opacity: bundlePartiallyOwned ? 0.5 : 1,
            }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div
                className={bundlePartiallyOwned ? "flex items-center justify-center bg-white/[0.06] text-white/40" : "flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24]"}
                style={{ width: 40, height: 40, borderRadius: 10 }}
              >
                <Package size={18} strokeWidth={2} />
              </div>
              <span
                className={
                  bundlePartiallyOwned
                    ? "font-[family-name:var(--font-poppins)] font-bold uppercase bg-white/[0.06] text-white/40"
                    : "font-[family-name:var(--font-poppins)] font-bold uppercase bg-[#ed1a24] text-white"
                }
                style={{ fontSize: 9.5, letterSpacing: "0.05em", borderRadius: 50, padding: "4px 10px" }}
              >
                {bundlePartiallyOwned ? "Not applicable" : "Best value"}
              </span>
            </div>

            <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 4px" }}>
              Full Profile Bundle
            </h3>
            <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 16px" }}>
              Report, personality test, and reference checks together.
            </p>

            {bundlePartiallyOwned ? (
              <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12.5, lineHeight: 1.6, flex: 1, margin: 0 }}>
                Not applicable — you already own at least one of these separately. Buy what's left individually above.
              </p>
            ) : (
              <>
                <div className="flex items-baseline" style={{ gap: 8, marginBottom: 6 }}>
                  <span className="font-[family-name:var(--font-gabarito)] font-bold text-white" style={{ fontSize: 24 }}>
                    {bundle.bundlePriceLabel}
                  </span>
                  <span className="text-white/35" style={{ fontSize: 12.5, textDecoration: "line-through" }}>
                    {bundle.soloTotalLabel}
                  </span>
                </div>
                <p className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 11.5, color: "#3FCB8C", margin: "0 0 16px" }}>
                  You save {bundle.savingsLabel}
                </p>

                {bundleEligible ? (
                  <button
                    onClick={() => setModal("report")}
                    className="text-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                    style={{ borderRadius: 8, padding: "11px 16px", fontSize: 13.5, border: "none", cursor: "pointer" }}
                  >
                    Get the bundle now →
                  </button>
                ) : (
                  <Link
                    href={leadId ? `/hub/account?lead=${encodeURIComponent(leadId)}` : "/hub/account"}
                    className="text-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
                    style={{ borderRadius: 8, padding: "11px 16px", fontSize: 13.5 }}
                  >
                    Get the bundle on Overview →
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 640, margin: 0 }}>
          Only the personality test is discounted inside the bundle. Report and reference pricing stay identical either way, so bundling never
          costs more than buying separately.
        </p>
      </div>

      {modal === "report" && leadId && roleTitle && (
        <ReportPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={(unlockedReport, selection) => {
            setReportUnlocked(true);
            setReport(unlockedReport);
            if (selection === "bundle") {
              setPersonalityUnlocked(true);
              setReferencesUnlocked(true);
            }
            setModal("none");
          }}
        />
      )}
      {modal === "personality" && leadId && roleTitle && (
        <PersonalityPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={() => {
            setPersonalityUnlocked(true);
            setModal("none");
            window.location.href = `/hub/account/personality?role=${encodeURIComponent(roleTitle)}`;
          }}
        />
      )}
      {modal === "references" && leadId && (
        <ReferencesPaywallModal
          leadId={leadId}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={() => {
            setReferencesUnlocked(true);
            setModal("none");
            window.location.href = "/hub/account/references";
          }}
        />
      )}
      {modal === "interview" && leadId && roleTitle && (
        <InterviewPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
          level={level}
          userEmail={userEmail}
          onClose={() => setModal("none")}
          onStarted={(status) => {
            setInterviewStatus(status);
            setModal("none");
          }}
        />
      )}
      {modal === "counselling" && counsellingCard && (
        <CounsellingPaywallModal
          priceLabel={counsellingCard.priceLabel}
          onClose={() => setModal("none")}
          onRequested={() => {
            setCounsellingRequested(true);
            setModal("none");
          }}
        />
      )}
    </main>
  );
}
