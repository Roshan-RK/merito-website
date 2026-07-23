import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getCandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";
import ResumeMatchCategoryCard from "./ResumeMatchCategoryCard";
import CandidateProfile from "./CandidateProfile";

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
    .select("role_title, score, name, resume_match_status, resume_match_raw, ib_applied_job_id")
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

  if (current.resume_match_status !== "READY" || !current.resume_match_raw) {
    redirect("/hub/account");
  }

  const report = current.resume_match_raw as ResumeMatchReportReady;

  const candidateDetails = current.ib_applied_job_id
    ? await getCandidateResumeDetails(current.ib_applied_job_id).catch((err) => {
        console.error("getCandidateResumeDetails failed, rendering report without candidate profile", err);
        return null;
      })
    : null;

  const displayName = current.name || user.email || "Candidate";
  const formattedDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
        <a
          href="/api/hub/report/export"
          download
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
          style={{ fontSize: 13, marginLeft: 16 }}
        >
          Download PDF
        </a>

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
            {report.summary}
          </p>
        </div>

        {candidateDetails && candidateDetails.skills.length > 0 && (
          <div style={{ margin: "0 0 32px" }}>
            <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
              Skills
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {candidateDetails.skills.map((skill) => (
                <span
                  key={skill}
                  className="bg-[#fdf8fb] border border-black/[0.08] font-[family-name:var(--font-poppins)] text-[#4b4b4d]"
                  style={{ fontSize: 12.5, borderRadius: 50, padding: "6px 14px" }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
          Match breakdown
        </h2>
        {report.categories.map((category) => (
          <ResumeMatchCategoryCard key={category.key} category={category} />
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Strengths
        </h2>
        {report.strongPoints.map((point, i) => (
          <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 8px" }}>
            ✓ {point}
          </p>
        ))}

        <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "32px 0 14px" }}>
          Gaps to address
        </h2>
        {report.weakPoints.map((point, i) => (
          <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 8px" }}>
            ✗ {point}
          </p>
        ))}

        {candidateDetails && (candidateDetails.education.length > 0 || candidateDetails.experience.length > 0) && (
          <CandidateProfile education={candidateDetails.education} experience={candidateDetails.experience} certifications={candidateDetails.certifications} />
        )}
      </div>
    </main>
  );
}
