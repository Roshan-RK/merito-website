import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import DashboardClient from "./DashboardClient";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, score, verdict, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    return (
      <main style={{ padding: "48px 20px", maxWidth: 640, margin: "0 auto" }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.6rem" }}>
          No fitment scores yet
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 14 }}>
          Head back to the HUB to check your fit for a role.
        </p>
      </main>
    );
  }

  const current = leads[0];
  const prevForSameRole = leads.find((l, i) => i > 0 && l.role_title === current.role_title);

  const reportUnlocked = await isReportUnlocked(user.id, current.role_title);

  let report: FitmentReportResult | null = null;
  if (reportUnlocked) {
    const { data: reportRow } = await supabase
      .from("fitment_reports")
      .select("verdict_summary, categories, action_plan")
      .eq("user_id", user.id)
      .eq("role_title", current.role_title)
      .maybeSingle();
    if (reportRow) {
      report = {
        verdictSummary: reportRow.verdict_summary,
        categories: reportRow.categories,
        actionPlan: reportRow.action_plan,
      };
    }
  }

  return (
    <DashboardClient
      roleTitle={current.role_title}
      score={current.score}
      prevScore={prevForSameRole ? prevForSameRole.score : null}
      verdict={current.verdict}
      initialReportUnlocked={reportUnlocked}
      initialReport={report}
    />
  );
}
