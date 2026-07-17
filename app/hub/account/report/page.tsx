import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import type { FitmentReportResult } from "@/lib/generateFitmentReport";
import CategorySection from "./CategorySection";
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
    .select("role_title, score, name")
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
    .select("verdict_summary, categories, action_plan")
    .eq("user_id", user.id)
    .eq("role_title", current.role_title)
    .maybeSingle();

  if (!reportRow) {
    redirect("/hub/account");
  }

  const displayName = current.name || user.email || "Candidate";
  const formattedDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const sortedActionPlan = [...reportRow.action_plan].sort(
    (a: FitmentReportResult["actionPlan"][number], b: FitmentReportResult["actionPlan"][number]) =>
      a.priority - b.priority
  );

  // Rows generated under an earlier report schema (before this phase's
  // migration renamed/restructured this column) won't match the current
  // shape — filter them out rather than crash; a free CV re-check
  // regenerates the row under the current schema.
  const categories = (reportRow.categories as FitmentReportResult["categories"]).filter(
    (c) => c && Array.isArray(c.requirements)
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

        <div className="flex items-center justify-between flex-wrap" style={{ margin: "14px 0 4px", gap: 12 }}>
          <div>
            <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.8rem", margin: 0 }}>
              {displayName}
            </h1>
            <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: "4px 0 0" }}>
              {current.score.toFixed(1)} / 10 fit for {current.role_title} · {formattedDate}
            </p>
          </div>
          <Image src="/logo.png" alt="Merito" width={100} height={28} style={{ height: 24, width: "auto" }} />
        </div>

        <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 20, margin: "20px 0 32px" }}>
          <p
            className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]"
            style={{ fontSize: 10, letterSpacing: "0.06em", margin: "0 0 8px" }}
          >
            Assessment summary
          </p>
          <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
            {reportRow.verdict_summary}
          </p>
        </div>

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
          Match breakdown
        </h2>
        {categories.map((c: FitmentReportResult["categories"][number], i: number) => (
          <CategorySection
            key={i}
            category={c.category}
            matchedCount={c.matchedCount}
            totalCount={c.totalCount}
            requirements={c.requirements}
          />
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Your action plan
        </h2>
        {sortedActionPlan.map((item: FitmentReportResult["actionPlan"][number], i: number) => (
          <ActionPlanItem key={i} priority={item.priority} action={item.action} why={item.why} effort={item.effort} />
        ))}
      </div>
    </main>
  );
}
