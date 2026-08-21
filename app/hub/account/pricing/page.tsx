import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { isProductUnlocked } from "@/lib/productUnlocks";
import { DEFAULT_LEVEL, type CandidateLevel } from "@/lib/razorpay/pricing";
import type { InterviewStatus } from "@/app/hub/account/ProgressRail";
import { buildPricingCards, buildBundleSummary } from "./pricingCatalog";
import PricingCardsClient from "./PricingCardsClient";

export default async function PricingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  // Same level-resolution pattern as app/hub/account/page.tsx: latest lead's
  // candidate_level, falling back to DEFAULT_LEVEL when there isn't one yet
  // (this page is a pure reference page, so unlike the dashboard it still
  // renders -- at the default tier -- rather than redirecting away).
  const { data: lead } = await supabase
    .from("fitment_leads")
    .select("id, role_title, candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const level = (lead?.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

  const cards = buildPricingCards(level);
  const bundle = buildBundleSummary(level);

  // Purchasing needs a real lead/role to attach the unlock to -- without one
  // there's nothing to buy yet, so every card falls back to the read-only
  // "View on Overview" link (Overview itself handles the "no fitment score
  // yet" empty state).
  if (!lead) {
    return (
      <PricingCardsClient
        cards={cards}
        bundle={bundle}
        levelLabel={levelLabel}
        level={level}
        purchasable={false}
        leadId={null}
        roleTitle={null}
        userEmail={user.email ?? ""}
        reportUnlocked={false}
        personalityUnlocked={false}
        referencesUnlocked={false}
        interviewStatus="not_started"
        counsellingRequested={false}
      />
    );
  }

  const [reportUnlocked, personalityUnlocked, referencesUnlocked] = await Promise.all([
    isReportUnlocked(user.id, lead.role_title),
    isProductUnlocked(user.id, "personality"),
    isProductUnlocked(user.id, "references"),
  ]);

  const { data: interviewRow } = await supabase
    .from("fitment_interviews")
    .select("status")
    .eq("user_id", user.id)
    .eq("role_title", lead.role_title)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Deliberately simpler than Overview's version of this derivation: no
  // stuck_at/self-heal handling here (that's a live-status concern for the
  // dashboard, which the candidate is already on if any of that matters --
  // this page only needs to know "is there already an interview in flight,
  // yes or no" to decide whether to show a pay button or a view link).
  const interviewStatus: InterviewStatus = !interviewRow
    ? "not_started"
    : interviewRow.status === "ready"
      ? "ready"
      : interviewRow.status === "terminated"
        ? "terminated"
        : "invited";

  const { data: counsellingRequest } = await supabase.from("counselling_requests").select("id").eq("user_id", user.id).maybeSingle();

  return (
    <PricingCardsClient
      cards={cards}
      bundle={bundle}
      levelLabel={levelLabel}
      level={level}
      purchasable
      leadId={lead.id}
      roleTitle={lead.role_title}
      userEmail={user.email ?? ""}
      reportUnlocked={reportUnlocked}
      personalityUnlocked={personalityUnlocked}
      referencesUnlocked={referencesUnlocked}
      interviewStatus={interviewStatus}
      counsellingRequested={Boolean(counsellingRequest)}
    />
  );
}
