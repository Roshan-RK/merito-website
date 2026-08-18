import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Manrope } from "next/font/google";
import { Phone, Mail, MapPin, GraduationCap, Briefcase, CheckCircle2, XCircle } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isReportUnlocked } from "@/lib/reportUnlocks";
import { getCandidateResumeDetails, type ResumeMatchReportReady } from "@/lib/intervuebox/reports";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = { title: "Fitment report" };

// This route is the printable/PDF-export target for the fitment report --
// app/api/hub/report/export/route.tsx screenshots this exact URL via
// headless Chromium to produce the downloadable PDF, and the "Preview
// export format" action on ../page.tsx opens it directly. Matches the
// mockup's own light-mode PDF template (function `cl` in
// mockups/merito-dashboard-v34.html) verbatim -- colors, tone thresholds,
// and copy read from that source, not guessed -- rather than reusing the
// dashboard's dark theme the way the export used to (it screenshotted
// /hub/account/report as-is before this route existed).

const NOT_SPECIFIED = "Not specified";

function toneFor(score: number): { label: string; background: string; color: string } {
  if (score >= 8.5) return { label: "Excellent Match", background: "#DCFCE7", color: "#15803D" };
  if (score >= 6.5) return { label: "Good Match", background: "#FEE2E2", color: "#B91C1C" };
  if (score >= 4.5) return { label: "Fair Match", background: "#FEF3C7", color: "#92400E" };
  return { label: "Weak Match", background: "#F1F5F9", color: "#475569" };
}

function MeritoMark() {
  return <Image src="/logo.png" alt="Merito" width={128} height={36} style={{ height: 26, width: "auto" }} />;
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 20, marginBottom: 16 }}>
      {children}
    </div>
  );
}

export default async function ReportPrintPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, score, name, resume_match_status, resume_match_raw, ib_applied_job_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const current = leads?.[0];
  if (!current) {
    redirect("/hub/account");
  }

  const unlocked = await isReportUnlocked(user.id, current.role_title);
  if (!unlocked || current.resume_match_status !== "READY" || !current.resume_match_raw) {
    redirect("/hub/account/report");
  }

  const report = current.resume_match_raw as ResumeMatchReportReady;
  const candidateDetails = current.ib_applied_job_id
    ? await getCandidateResumeDetails(current.ib_applied_job_id).catch(() => null)
    : null;

  const displayName = current.name || "Candidate";
  const tone = toneFor(current.score);
  const percent = Math.round(current.score * 10);
  const formattedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const sortedCategories = [...report.categories].sort((a, b) => b.score - a.score);

  return (
    <div className={`${manrope.variable} sm:p-8`} style={{ background: "#FBF3F4", color: "#111827", fontFamily: "var(--font-manrope), system-ui, sans-serif", minHeight: "100vh", padding: "24px" }}>
      <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 20 }}>
        <div>
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <h1 className="font-bold" style={{ fontSize: 24, margin: 0, color: "#111827" }}>
              {displayName}
            </h1>
            <span className="font-semibold text-white" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: "#EC1B25" }}>
              {current.role_title}
            </span>
          </div>
          <p style={{ fontSize: 14, margin: "4px 0 0", color: "#6B7280" }}>{formattedDate}</p>
        </div>
        <MeritoMark />
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-4" style={{ gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, color: "#374151" }}>
            {candidateDetails?.phoneNumber && (
              <span className="flex items-center" style={{ gap: 8 }}>
                <Phone size={14} strokeWidth={2} style={{ color: "#9CA3AF" }} /> {candidateDetails.phoneNumber}
              </span>
            )}
            {user.email && (
              <span className="flex items-center" style={{ gap: 8 }}>
                <Mail size={14} strokeWidth={2} style={{ color: "#9CA3AF" }} /> {user.email}
              </span>
            )}
            {candidateDetails?.location && (
              <span className="flex items-center" style={{ gap: 8 }}>
                <MapPin size={14} strokeWidth={2} style={{ color: "#9CA3AF" }} /> {candidateDetails.location}
              </span>
            )}
          </div>
          {[
            { label: "Total work experience", value: candidateDetails?.totalExperience != null ? `${candidateDetails.totalExperience} years` : NOT_SPECIFIED },
            { label: "Current salary", value: NOT_SPECIFIED },
            { label: "Expected salary", value: NOT_SPECIFIED },
          ].map((stat) => (
            <div key={stat.label}>
              <p style={{ fontSize: 12, margin: "0 0 3px", color: "#9CA3AF" }}>{stat.label}</p>
              <p className="font-semibold" style={{ fontSize: 14, margin: 0, color: "#111827" }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between" style={{ gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px", color: "#9CA3AF" }}>
              Resume match for {current.role_title}
            </p>
            {candidateDetails && candidateDetails.skills.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {candidateDetails.skills.map((skill) => (
                  <span key={skill} className="border" style={{ fontSize: 12, borderRadius: 50, padding: "6px 14px", borderColor: "#E5E7EB", color: "#374151" }}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-center" style={{ gap: 8 }}>
            <span className="font-semibold" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: tone.background, color: tone.color }}>
              {tone.label}
            </span>
            <div className="relative" style={{ width: 96, height: 96 }}>
              <svg width={96} height={96} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#DCFCE7" strokeWidth={9} />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - current.score / 10)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold" style={{ fontSize: 20, color: "#111827" }}>
                  {percent}%
                </span>
              </div>
            </div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Overall match</span>
          </div>
        </div>
      </Card>

      <Card>
        <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 8px", color: "#9CA3AF" }}>
          Assessment summary
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.7, margin: 0, color: "#374151" }}>{report.summary}</p>
      </Card>

      <h2 className="font-bold" style={{ fontSize: 18, margin: "0 0 10px", color: "#111827" }}>
        Dimension scores
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
        {sortedCategories.map((category) => (
          <div key={category.key} className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 16, breakInside: "avoid" }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <span className="font-semibold" style={{ fontSize: 14, color: "#111827" }}>
                {category.label}
              </span>
              <span className="font-bold" style={{ fontSize: 14, color: "#16A34A" }}>
                {category.score}%
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 6, overflow: "hidden", marginBottom: 10, background: "#E5E7EB" }}>
              <div style={{ height: "100%", borderRadius: 6, width: `${category.score}%`, background: "#16A34A" }} />
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: "#4B5563" }}>{category.comment}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
        <div style={{ background: "#F0FDF4", borderRadius: 16, padding: 16 }}>
          <p className="font-semibold uppercase" style={{ fontSize: 12, letterSpacing: "0.06em", margin: "0 0 10px", color: "#15803D" }}>
            Strong points
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {report.strongPoints.map((point, i) => (
              <div key={i} className="flex items-start" style={{ gap: 8, fontSize: 13, lineHeight: 1.6, color: "#166534" }}>
                <CheckCircle2 size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
                {point}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: "#FEF2F2", borderRadius: 16, padding: 16 }}>
          <p className="font-semibold uppercase" style={{ fontSize: 12, letterSpacing: "0.06em", margin: "0 0 10px", color: "#B91C1C" }}>
            Weak points
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {report.weakPoints.map((point, i) => (
              <div key={i} className="flex items-start" style={{ gap: 8, fontSize: 13, lineHeight: 1.6, color: "#991B1B" }}>
                <XCircle size={14} strokeWidth={2} style={{ marginTop: 2, flexShrink: 0 }} />
                {point}
              </div>
            ))}
          </div>
        </div>
      </div>

      {candidateDetails && (candidateDetails.education.length > 0 || candidateDetails.experience.length > 0) && (
        <>
          <h2 className="font-bold" style={{ fontSize: 18, margin: "0 0 10px", color: "#111827" }}>
            Candidate profile
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
            {candidateDetails.education.length > 0 && (
              <div className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 16 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
                  <GraduationCap size={16} strokeWidth={2} style={{ color: "#EC1B25" }} />
                  <span className="font-semibold" style={{ fontSize: 14 }}>Education</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {candidateDetails.education.map((e, i) => (
                    <div key={i}>
                      <div className="font-medium" style={{ fontSize: 14, color: "#111827" }}>{e.qualification}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{e.college} · {e.location}</div>
                      <div style={{ fontSize: 12, color: "#9CA3AF" }}>{e.duration}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {candidateDetails.experience.length > 0 && (
              <div className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 16 }}>
                <div className="flex items-center" style={{ gap: 8, marginBottom: 12 }}>
                  <Briefcase size={16} strokeWidth={2} style={{ color: "#EC1B25" }} />
                  <span className="font-semibold" style={{ fontSize: 14 }}>Experience</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {candidateDetails.experience.map((e, i) => (
                    <div key={i}>
                      <div className="font-medium" style={{ fontSize: 14, color: "#111827" }}>{e.position}</div>
                      <div style={{ fontSize: 12, color: "#6B7280" }}>{e.company} · {e.duration}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
