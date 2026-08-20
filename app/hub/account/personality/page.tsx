import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { nameFromEmail, type Scores, type Validity } from "@/lib/personality";
import { isProductUnlocked } from "@/lib/productUnlocks";
import { DEFAULT_LEVEL, type CandidateLevel } from "@/lib/razorpay/pricing";
import PersonalityTestClient from "./PersonalityTestClient";
import PersonalityLockedState from "./PersonalityLockedState";

export default async function PersonalityTestPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const current = leads?.[0];

  const { role } = await searchParams;
  let roleTitle = typeof role === "string" ? role : null;

  if (!roleTitle) {
    roleTitle = current?.role_title ?? null;
  }

  if (!roleTitle || !current) {
    redirect("/hub/account");
  }

  const level = (current.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;

  const [personalityUnlocked, referencesUnlocked] = await Promise.all([
    isProductUnlocked(user.id, "personality"),
    isProductUnlocked(user.id, "references"),
  ]);
  const bundleEligible = !personalityUnlocked && !referencesUnlocked;

  if (!personalityUnlocked) {
    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
              Personality test
            </h1>
            <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: 0 }}>
              Part of your profile &mdash; done once, applies to every application.
            </p>
          </div>
          <PersonalityLockedState leadId={current.id} roleTitle={roleTitle} level={level} bundleEligible={bundleEligible} />
        </div>
      </main>
    );
  }

  const { data: existing } = await supabase
    .from("personality_tests")
    .select("scores, validity")
    .eq("user_id", user.id)
    .eq("role_title", roleTitle)
    .maybeSingle();

  const initialResult =
    existing && existing.scores && existing.validity
      ? { scores: existing.scores as Scores, validity: existing.validity as Validity }
      : null;

  const candidateName = nameFromEmail(user.email ?? "");

  return (
    <main>
      <div className="mx-auto" style={{ padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
            Personality test
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: 0 }}>
            Part of your profile &mdash; done once, applies to every application.
          </p>
        </div>
        <PersonalityTestClient roleTitle={roleTitle} candidateName={candidateName} initialResult={initialResult} />
      </div>
    </main>
  );
}
