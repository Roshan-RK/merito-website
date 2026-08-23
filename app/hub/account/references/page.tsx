import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus, MIN_REFERENCES, REFERENCE_CATEGORIES } from "@/lib/referenceChecks";
import { isProductUnlocked } from "@/lib/productUnlocks";
import { DEFAULT_LEVEL, type CandidateLevel } from "@/lib/razorpay/pricing";
import ReferencesClient from "./ReferencesClient";
import ReferencesLockedState from "./ReferencesLockedState";

export default async function ReferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Note: ?lead= param is accepted for URL consistency but not used
  // (references are candidate-wide)

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const current = leads?.[0];
  if (!current) {
    redirect("/hub/account");
  }

  const level = (current.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;

  const [referencesUnlocked, personalityUnlocked] = await Promise.all([
    isProductUnlocked(user.id, "references"),
    isProductUnlocked(user.id, "personality"),
  ]);
  const bundleEligible = !referencesUnlocked && !personalityUnlocked;

  if (!referencesUnlocked) {
    return (
      <main>
        <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
              Reference checks
            </h1>
            <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: 0 }}>
              Part of your profile. Done once, applies to every application.
            </p>
          </div>
          <ReferencesLockedState leadId={current.id} level={level} bundleEligible={bundleEligible} />
        </div>
      </main>
    );
  }

  const status = await getReferenceCheckStatus(user.id);

  return (
    <main>
      <div className="mx-auto" style={{ padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.6rem", margin: "0 0 6px" }}>
            Reference checks
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 14, margin: 0 }}>
            Invite people who&apos;ve worked with you to rate you across {REFERENCE_CATEGORIES.length} categories. {MIN_REFERENCES}{" "}
            completed references unlock this step.
          </p>
        </div>
        <ReferencesClient initialStatus={status} />
      </div>
    </main>
  );
}
