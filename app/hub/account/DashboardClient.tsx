"use client";

import { useEffect, useState } from "react";
import ProgressRail, { type InterviewStatus, type PersonalityStatus } from "./ProgressRail";
import ScoreCard from "./ScoreCard";
import BundlePromoCard from "./BundlePromoCard";
import OnboardingBanner from "./OnboardingBanner";
import QuickTipsCard from "./QuickTipsCard";
import ApplicationsCard, { type Application } from "./ApplicationsCard";
import RecentActivityCard from "./RecentActivityCard";
import ReportPaywallModal from "./ReportPaywallModal";
import PersonalityPaywallModal from "./PersonalityPaywallModal";
import ReferencesPaywallModal from "./ReferencesPaywallModal";
import InterviewPaywallModal from "./InterviewPaywallModal";
import GenerateReportModal from "./GenerateReportModal";
import CounsellingCard from "./CounsellingCard";
import CounsellingPaywallModal from "./CounsellingPaywallModal";
import OnboardingTour from "./OnboardingTour";
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
  userName,
  score,
  verdict,
  initialReportUnlocked,
  initialReport,
  initialInterviewStatus,
  interviewInvitedAt,
  referenceCheckStatus,
  personalityStatus,
  counsellingPriceLabel,
  initialCounsellingRequested,
  applications,
  recruiterActivity,
}: {
  leadId: string;
  roleTitle: string;
  level: CandidateLevel;
  bundleEligible: boolean;
  personalityUnlocked: boolean;
  referencesUnlocked: boolean;
  userEmail: string;
  userName: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  initialReportUnlocked: boolean;
  initialReport: ResumeMatchReportReady | null;
  initialInterviewStatus: InterviewStatus;
  interviewInvitedAt: string | null;
  referenceCheckStatus: "none" | "in_progress" | "completed";
  personalityStatus: PersonalityStatus;
  counsellingPriceLabel: string;
  initialCounsellingRequested: boolean;
  applications: Application[];
  recruiterActivity: React.ReactNode;
}) {
  const [modal, setModal] = useState<"none" | "report" | "personality" | "references" | "interview" | "generate" | "counselling" | "tour">("none");
  const [interviewModalAlreadyInvited, setInterviewModalAlreadyInvited] = useState(false);
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [, setReport] = useState<ResumeMatchReportReady | null>(initialReport);
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>(initialInterviewStatus);
  const [counsellingRequested, setCounsellingRequested] = useState(initialCounsellingRequested);
  const [personalityUnlockedState, setPersonalityUnlockedState] = useState(personalityUnlocked);
  const [referencesUnlockedState, setReferencesUnlockedState] = useState(referencesUnlocked);

  const doneCount =
    1 +
    (reportUnlocked ? 1 : 0) +
    (personalityStatus === "ready" ? 1 : 0) +
    (referenceCheckStatus === "completed" ? 1 : 0) +
    (interviewStatus === "ready" ? 1 : 0);
  const totalSteps = 5;

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

  const otherApplications = applications.filter((app) => app.id !== leadId);

  return (
    <>
      <div className="mx-auto" style={{ maxWidth: 1040, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", letterSpacing: "-0.02em", margin: "0 0 6px" }}>
            Hi {userName} — here&apos;s how you stand for {roleTitle}
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, margin: 0 }}>
            {doneCount} of {totalSteps} steps complete — each one strengthens the case a recruiter sees.
          </p>
        </div>

        <OnboardingBanner roleTitle={roleTitle} />

        <QuickTipsCard onStartTour={() => setModal("tour")} />

        <ScoreCard roleTitle={roleTitle} score={score} verdict={verdict} />

        <ProgressRail
          reportUnlocked={reportUnlocked}
          interviewStatus={interviewStatus}
          interviewInvitedAt={interviewInvitedAt}
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
          onOpenInterviewCheck={() => {
            setInterviewModalAlreadyInvited(true);
            setModal("interview");
          }}
          onOpenGenerateReport={() => setModal("generate")}
        />

        {bundleEligible && <BundlePromoCard level={level} onOpenPaywall={() => setModal("report")} />}

        {recruiterActivity}

        <section id="guidance" style={{ scrollMarginTop: 82 }}>
          <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 10px" }}>
            Guidance
          </p>
          <CounsellingCard
            priceLabel={counsellingPriceLabel}
            requested={counsellingRequested}
            onOpenPaywall={() => setModal("counselling")}
          />
        </section>

        <RecentActivityCard applications={otherApplications} />

        <ApplicationsCard applications={applications} currentLeadId={leadId} />
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
          onUnlocked={(unlockedReport, selection) => {
            setReportUnlocked(true);
            setReport(unlockedReport);
            if (selection === "bundle") {
              setPersonalityUnlockedState(true);
              setReferencesUnlockedState(true);
            }
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
          alreadyInvited={interviewModalAlreadyInvited}
          onClose={() => {
            setInterviewModalAlreadyInvited(false);
            setModal("none");
          }}
          onStarted={(status) => {
            setInterviewStatus(status);
            setInterviewModalAlreadyInvited(false);
            setModal("none");
          }}
        />
      )}
      {modal === "generate" && (
        <GenerateReportModal
          roleTitle={roleTitle}
          reportUnlocked={reportUnlocked}
          personalityStatus={personalityStatus}
          interviewStatus={interviewStatus}
          referenceCheckStatus={referenceCheckStatus}
          onClose={() => setModal("none")}
        />
      )}
      {modal === "tour" && <OnboardingTour onClose={() => setModal("none")} />}
    </>
  );
}
