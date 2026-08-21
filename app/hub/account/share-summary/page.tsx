import { redirect } from "next/navigation";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getReferenceCheckStatus } from "@/lib/referenceChecks";
import { nameFromEmail } from "@/lib/personality";
import { getAbsoluteUrl } from "@/lib/site";

const SECTION_COPY: Record<string, { label: string; blurb: string }> = {
  fitment: { label: "Role Fitment Analysis", blurb: "CV matched against the job description" },
  personality: { label: "Personality Profile", blurb: "Big Five (OCEAN) traits measured" },
  interview: { label: "AI Video Interview", blurb: "Proctored, skill-scored interview" },
  references: { label: "Reference Check", blurb: "Rated by verified former colleagues" },
};
const SECTION_ORDER = ["fitment", "personality", "interview", "references"] as const;

export default async function ShareSummaryPage({
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

  const params = await searchParams;
  const includeParam = typeof params.include === "string" ? params.include : "";
  const include = new Set(includeParam.split(",").filter(Boolean));

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, name, resume_match_status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const currentLead = leads?.[0];
  const roleTitle = currentLead?.role_title ?? "-";
  const displayName = currentLead?.name || nameFromEmail(user.email ?? "");

  let fitmentDone = false;
  if (include.has("fitment") && currentLead) {
    const unlocked = await isReportUnlocked(user.id, currentLead.role_title);
    fitmentDone = unlocked && currentLead.resume_match_status === "READY";
  }

  let personalityDone = false;
  if (include.has("personality")) {
    const { data: existing } = await supabase
      .from("personality_tests")
      .select("scores, validity")
      .eq("user_id", user.id)
      .maybeSingle();
    personalityDone = Boolean(existing?.scores && existing?.validity);
  }

  let interviewDone = false;
  if (include.has("interview")) {
    let query = supabase.from("fitment_interviews").select("status, updated_at").eq("user_id", user.id);
    if (currentLead) query = query.eq("role_title", currentLead.role_title);
    const { data: row } = await query.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    interviewDone = row?.status === "ready";
  }

  let referencesDone = false;
  if (include.has("references")) {
    const status = await getReferenceCheckStatus(user.id);
    referencesDone = status?.status === "completed";
  }

  const doneMap: Record<string, boolean> = {
    fitment: fitmentDone,
    personality: personalityDone,
    interview: interviewDone,
    references: referencesDone,
  };
  const completedSections = SECTION_ORDER.filter((key) => include.has(key) && doneMap[key]);
  const reportDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main style={{ width: "100%" }}>
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
          breakAfter: "page",
          background: "#12121f",
        }}
      >
        <Image src="/logo.png" alt="Merito" width={140} height={38} style={{ height: 32, width: "auto", marginBottom: 40 }} />
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 13, letterSpacing: "0.1em", margin: "0 0 16px" }}>
          Verified Candidate Profile
        </p>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "2.6rem", textAlign: "center", margin: "0 0 10px" }}>
          {displayName}
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#c7c7cf]" style={{ fontSize: 16, margin: "0 0 24px" }}>
          {roleTitle}
        </p>
        <span className="font-bold uppercase text-[#16803c] bg-[#eefdf1]" style={{ fontSize: 12, borderRadius: 50, padding: "6px 16px" }}>
          ✓ Verified
        </span>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, marginTop: 30 }}>
          {reportDate}
        </p>
      </section>

      <section
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: 60, breakAfter: "page", background: "#fff" }}
      >
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 12, letterSpacing: "0.08em", margin: "0 0 24px" }}>
          What was assessed
        </p>
        {completedSections.map((key) => (
          <div key={key} className="flex items-start" style={{ gap: 16, marginBottom: 20 }}>
            <span style={{ color: "#16803c", fontSize: 22, fontWeight: 700 }}>✓</span>
            <div>
              <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 20, margin: "0 0 4px" }}>
                {SECTION_COPY[key].label}
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, margin: 0 }}>
                {SECTION_COPY[key].blurb}
              </p>
            </div>
          </div>
        ))}
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, marginTop: 30, fontStyle: "italic" }}>
          Every claim backed by evidence, not just a CV.
        </p>
      </section>

      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
          textAlign: "center",
          background: "#fdf8fb",
        }}
      >
        <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.8rem", margin: "0 0 14px" }}>
          Built on Merito <span style={{ color: "#ed1a24" }}>HUB</span>
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 15, lineHeight: 1.7, maxWidth: 460, margin: "0 0 26px" }}>
          Merito HUB turns scattered credentials into one verified, evidence-backed profile employers can trust.
        </p>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 15, margin: "0 0 8px" }}>
          Build your own verified profile
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 14 }}>{getAbsoluteUrl("/hub")}</p>
      </section>
    </main>
  );
}
