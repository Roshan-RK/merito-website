import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
import RequirementRow from "./RequirementRow";
import ActionPlanItem from "./ActionPlanItem";

export default async function FullReportPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, score")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!leads || leads.length === 0) {
    redirect("/hub/account");
  }

  const current = leads[0];
  const unlocked = await isReportUnlocked(user.id, current.role_title);

  if (!unlocked) {
    redirect("/hub/account");
  }

  const { data: reportRow } = await supabase
    .from("fitment_reports")
    .select("requirements, action_plan")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .maybeSingle();

  if (!reportRow) {
    redirect("/hub/account");
  }

  const sortedActionPlan = [...reportRow.action_plan].sort(
    (a: FitmentReportResult["actionPlan"][number], b: FitmentReportResult["actionPlan"][number]) =>
      a.priority - b.priority
  );

  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "48px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 820 }}>
        <Link
          href="/hub/account"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13 }}
        >
          ← Back to dashboard
        </Link>

        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.8rem", margin: "14px 0 4px" }}>
          Your detailed fitment report
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "0 0 28px" }}>
          {current.score.toFixed(1)} / 10 fit for {current.role_title}
        </p>

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
          Match breakdown
        </h2>
        {reportRow.requirements.map((r: FitmentReportResult["requirements"][number], i: number) => (
          <RequirementRow key={i} requirement={r.requirement} matchLevel={r.matchLevel} evidence={r.evidence} note={r.note} />
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Your action plan
        </h2>
        {sortedActionPlan.map((item: FitmentReportResult["actionPlan"][number], i: number) => (
          <ActionPlanItem key={i} priority={item.priority} action={item.action} why={item.why} />
        ))}
      </div>
    </main>
  );
}
