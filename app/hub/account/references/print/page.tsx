import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Manrope } from "next/font/google";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus, computeReferenceReport, type RefereeRole } from "@/lib/referenceChecks";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = { title: "Reference checks" };

// Printable/PDF-export target for the reference check report -- mirrors
// app/hub/account/report/print/page.tsx and .../personality/print/page.tsx's
// pattern (light theme, single continuous page, screenshotted by
// app/api/hub/references/export/route.tsx via headless Chromium).

const ROLE_LABEL: Record<RefereeRole, string> = {
  faculty: "Faculty",
  classmate: "Classmate",
  "internship-colleague": "Internship colleague",
  "internship-manager": "Internship manager",
  manager: "Manager",
  "team-lead": "Team lead",
  teammate: "Teammate",
  client: "Client",
  other: "Other",
};

function toneFor(score: number): { label: string; background: string; color: string } {
  if (score >= 4) return { label: "Strong", background: "#DCFCE7", color: "#15803D" };
  if (score >= 3) return { label: "Positive", background: "#FEF3C7", color: "#92400E" };
  if (score > 0) return { label: "Mixed", background: "#FEE2E2", color: "#B91C1C" };
  return { label: "No data", background: "#F1F5F9", color: "#475569" };
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

export default async function ReferencesPrintPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("role_title, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const current = leads?.[0];

  const status = await getReferenceCheckStatus(user.id);
  if (!status || status.status !== "completed") {
    redirect("/hub/account/references");
  }

  const report = computeReferenceReport(status.referees);
  const displayName = current?.name || "Candidate";
  const overallTone = toneFor(report.overallScore);
  const formattedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const sortedCategories = [...report.categoryScores].sort((a, b) => b.value - a.value);

  return (
    <div className={`${manrope.variable} sm:p-8`} style={{ background: "#FBF3F4", color: "#111827", fontFamily: "var(--font-manrope), system-ui, sans-serif", minHeight: "100vh", padding: "24px" }}>
      <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 20 }}>
        <div>
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <h1 className="font-bold" style={{ fontSize: 24, margin: 0, color: "#111827" }}>
              {displayName}
            </h1>
            {current?.role_title && (
              <span className="font-semibold text-white" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: "#EC1B25" }}>
                {current.role_title}
              </span>
            )}
          </div>
          <p style={{ fontSize: 14, margin: "4px 0 0", color: "#6B7280" }}>{formattedDate}</p>
        </div>
        <MeritoMark />
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between" style={{ gap: 20 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px", color: "#9CA3AF" }}>
              Reference check summary
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.65, margin: 0, color: "#374151" }}>
              Based on {report.referees.length} completed reference{report.referees.length === 1 ? "" : "s"}, averaged across {sortedCategories.length} work-quality categories.
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-center" style={{ gap: 8 }}>
            <span className="font-semibold" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: overallTone.background, color: overallTone.color }}>
              {overallTone.label}
            </span>
            <div className="relative" style={{ width: 96, height: 96 }}>
              <svg width={96} height={96} viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke="#F1F5F9" strokeWidth={9} />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={overallTone.color}
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - report.overallScore / 5)}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-bold" style={{ fontSize: 20, color: "#111827" }}>
                  {report.overallScore.toFixed(1)}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Out of 5</span>
          </div>
        </div>
      </Card>

      <h2 className="font-bold" style={{ fontSize: 18, margin: "0 0 10px", color: "#111827" }}>
        Category scores
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
        {sortedCategories.map((category) => {
          const tone = toneFor(category.value);
          return (
            <div key={category.category} className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 16, breakInside: "avoid" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <span className="font-semibold" style={{ fontSize: 14, color: "#111827" }}>
                  {category.label}
                </span>
                <span style={{ fontSize: 14 }}>
                  <span className="font-bold" style={{ color: tone.color }}>
                    {category.value > 0 ? category.value.toFixed(1) : "—"}
                  </span>
                  {category.values.length > 0 && <span style={{ color: "#9CA3AF" }}> ({category.values.join(", ")})</span>}
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 6, overflow: "hidden", background: "#E5E7EB" }}>
                <div style={{ height: "100%", borderRadius: 6, width: `${(category.value / 5) * 100}%`, background: tone.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="font-bold" style={{ fontSize: 18, margin: "0 0 10px", color: "#111827" }}>
        Referees
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {report.referees.map((referee, i) => (
          <div key={i} className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 16, breakInside: "avoid" }}>
            <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginBottom: referee.overallFeedback ? 8 : 0 }}>
              <span className="font-semibold" style={{ fontSize: 14, color: "#111827" }}>
                {referee.name}
              </span>
              <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                {ROLE_LABEL[referee.role]}
                {referee.organization ? ` · ${referee.organization}` : ""}
              </span>
            </div>
            {referee.overallFeedback && (
              <p style={{ fontSize: 13, lineHeight: 1.65, margin: 0, color: "#4B5563", fontStyle: "italic" }}>&ldquo;{referee.overallFeedback}&rdquo;</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
