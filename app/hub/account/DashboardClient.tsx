"use client";

import { useEffect, useState } from "react";
import ProgressRail, { type InterviewStatus, type PersonalityStatus } from "./ProgressRail";
import ScoreCard from "./ScoreCard";
import BundlePromoCard from "./BundlePromoCard";
import ReportPaywallModal from "./ReportPaywallModal";
import PersonalityPaywallModal from "./PersonalityPaywallModal";
import ReferencesPaywallModal from "./ReferencesPaywallModal";
import InterviewPaywallModal from "./InterviewPaywallModal";
import CombinedExportModal from "./CombinedExportModal";
import CounsellingCard from "./CounsellingCard";
import CounsellingPaywallModal from "./CounsellingPaywallModal";
import type { ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import type { CandidateLevel } from "@/lib/razorpay/pricing";

export default function DashboardClient({
  leadId,
  roleTitle,
  level,
  bundleEligible,
  personalityUnlocked,
  referencesUnlocked,
  userEmail,
  score,
  prevScore,
  verdict,
  initialReportUnlocked,
  initialReport,
  initialInterviewStatus,
  referenceCheckStatus,
  personalityStatus,
  counsellingPriceLabel,
  initialCounsellingRequested,
}: {
  leadId: string;
  roleTitle: string;
  level: CandidateLevel;
  bundleEligible: boolean;
  personalityUnlocked: boolean;
  referencesUnlocked: boolean;
  userEmail: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  initialReportUnlocked: boolean;
  initialReport: ResumeMatchReportReady | null;
  initialInterviewStatus: InterviewStatus;
  referenceCheckStatus: "none" | "in_progress" | "completed";
  personalityStatus: PersonalityStatus;
  counsellingPriceLabel: string;
  initialCounsellingRequested: boolean;
}) {
  const [modal, setModal] = useState<"none" | "report" | "personality" | "references" | "interview" | "export" | "counselling">("none");
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [report, setReport] = useState<ResumeMatchReportReady | null>(initialReport);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>(initialInterviewStatus);
  const [counsellingRequested, setCounsellingRequested] = useState(initialCounsellingRequested);
  const [personalityUnlockedState, setPersonalityUnlockedState] = useState(personalityUnlocked);
  const [referencesUnlockedState, setReferencesUnlockedState] = useState(referencesUnlocked);

  // While the interview report is still generating, poll for it so the
  // dashboard updates live instead of requiring a manual refresh.
  useEffect(() => {
    if (interviewStatus !== "invited") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/hub/interview/status?role=${encodeURIComponent(roleTitle)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "ready") {
          setInterviewStatus("ready");
        }
      } catch {
        // Transient network error — next poll retries, nothing to surface.
      }
    }, 15_000);
    return () => clearInterval(interval);
  }, [interviewStatus, roleTitle]);

  return (
    <>
      <div
        className="mx-auto"
        style={{ maxWidth: 1440, padding: 24, display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 22 }}
      >
        <ProgressRail
          reportUnlocked={reportUnlocked}
          interviewStatus={interviewStatus}
          referenceCheckStatus={referenceCheckStatus}
          personalityStatus={personalityStatus}
          personalityUnlocked={personalityUnlockedState}
          referencesUnlocked={referencesUnlockedState}
          level={level}
          roleTitle={roleTitle}
          onOpenReportPaywall={() => setModal("report")}
          onOpenPersonalityPaywall={() => setModal("personality")}
          onOpenReferencesPaywall={() => setModal("references")}
          onOpenInterviewStart={() => setModal("interview")}
        />

        <div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.9rem", letterSpacing: "-0.03em", margin: "0 0 6px" }}>
            Hi — here&apos;s where you stand.
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "0 0 20px" }}>
            {reportUnlocked ? "Your detailed report is unlocked." : "1 step left to a profile recruiters can't ignore."}
          </p>

          <ScoreCard
            roleTitle={roleTitle}
            score={score}
            prevScore={prevScore}
            verdict={verdict}
            reportUnlocked={reportUnlocked}
            report={report}
            onOpenReportPaywall={() => setModal("report")}
          />

          {bundleEligible && (
            <BundlePromoCard level={level} onOpenPaywall={() => setModal("report")} />
          )}

          <CounsellingCard
            priceLabel={counsellingPriceLabel}
            requested={counsellingRequested}
            onOpenPaywall={() => setModal("counselling")}
          />
        </div>
      </div>

      <div className="mx-auto" style={{ maxWidth: 1440, padding: "0 24px 24px" }}>
        <button
          onClick={() => setModal("export")}
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ background: "none", border: "1px solid rgba(237,26,36,0.4)", borderRadius: 8, padding: "10px 16px", fontSize: 13, cursor: "pointer" }}
        >
          Download combined report
        </button>
      </div>

      {modal === "counselling" && (
        <CounsellingPaywallModal
          priceLabel={counsellingPriceLabel}
          onClose={() => setModal("none")}
          onRequested={() => {
            setCounsellingRequested(true);
            setModal("none");
          }}
        />
      )}
      {modal === "report" && (
        <ReportPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={(unlockedReport) => {
            setReportUnlocked(true);
            setReport(unlockedReport);
            setModal("none");
          }}
        />
      )}
      {modal === "personality" && (
        <PersonalityPaywallModal
          leadId={leadId}
          roleTitle={roleTitle}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={() => {
            setPersonalityUnlockedState(true);
            setModal("none");
            window.location.href = `/hub/account/personality?role=${encodeURIComponent(roleTitle)}`;
          }}
        />
      )}
      {modal === "references" && (
        <ReferencesPaywallModal
          leadId={leadId}
          level={level}
          bundleEligible={bundleEligible}
          onClose={() => setModal("none")}
          onUnlocked={() => {
            setReferencesUnlockedState(true);
            setModal("none");
            window.location.href = "/hub/account/references";
          }}
        />
      )}
      {modal === "interview" && (
        <InterviewPaywallModal
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
      {modal === "export" && (
        <CombinedExportModal
          roleTitle={roleTitle}
          reportUnlocked={reportUnlocked}
          personalityStatus={personalityStatus}
          interviewStatus={interviewStatus}
          referenceCheckStatus={referenceCheckStatus}
          onClose={() => setModal("none")}
        />
      )}
    </>
  );
}
