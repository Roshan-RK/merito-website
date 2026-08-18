import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus, MIN_REFERENCES, REFERENCE_CATEGORIES } from "@/lib/referenceChecks";
import { isProductUnlocked } from "@/lib/productUnlocks";
import { DEFAULT_LEVEL, type CandidateLevel } from "@/lib/razorpay/pricing";
import ReferencesClient from "./ReferencesClient";
import ReferencesLockedState from "./ReferencesLockedState";
import ExportPreviewButton from "../ExportPreviewButton";

export default async function ReferencesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
              Part of your profile — done once, applies to every application.
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
      <div className="mx-auto" style={{ maxWidth: 820, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div className="print:hidden flex items-center justify-end flex-wrap" style={{ gap: 12 }}>
          {status?.status === "completed" && (
            <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
              <ExportPreviewButton
                exportUrl="/api/hub/references/export"
                downloadFilename="reference-check-report.pdf"
                title="Reference check — export preview"
              />
              <a
                href="/api/hub/references/export"
                download
                className="flex items-center bg-white/[0.06] hover:bg-white/[0.1] transition-colors font-[family-name:var(--font-poppins)] font-semibold text-white"
                style={{ gap: 6, fontSize: 12.5, borderRadius: 50, padding: "7px 14px", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Download size={13} strokeWidth={2} /> Download PDF
              </a>
            </div>
          )}
        </div>
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
