"use client";

import { useState } from "react";
import TopBar from "./TopBar";
import ProgressRail from "./ProgressRail";
import ScoreCard from "./ScoreCard";
import ReportPaywallModal from "./ReportPaywallModal";
import ChangeRoleModal from "./ChangeRoleModal";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";

export default function DashboardClient({
  roleTitle,
  score,
  prevScore,
  verdict,
  initialReportUnlocked,
  initialReport,
}: {
  roleTitle: string;
  score: number;
  prevScore: number | null;
  verdict: string;
  initialReportUnlocked: boolean;
  initialReport: FitmentReportResult | null;
}) {
  const [modal, setModal] = useState<"none" | "report" | "changeRole">("none");
  const [reportUnlocked, setReportUnlocked] = useState(initialReportUnlocked);
  const [report, setReport] = useState<FitmentReportResult | null>(initialReport);

  return (
    <>
      <TopBar roleTitle={roleTitle} onChangeRole={() => setModal("changeRole")} />

      <div
        className="mx-auto"
        style={{ maxWidth: 1440, padding: 24, display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", gap: 22 }}
      >
        <ProgressRail reportUnlocked={reportUnlocked} onOpenReportPaywall={() => setModal("report")} />

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
        </div>
      </div>

      {modal === "report" && (
        <ReportPaywallModal
          roleTitle={roleTitle}
          onClose={() => setModal("none")}
          onUnlocked={(unlockedReport) => {
            setReportUnlocked(true);
            setReport(unlockedReport);
            setModal("none");
          }}
        />
      )}
      {modal === "changeRole" && (
        <ChangeRoleModal onClose={() => setModal("none")} onRoleChanged={() => setModal("none")} />
      )}
    </>
  );
}
