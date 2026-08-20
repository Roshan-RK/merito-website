import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Manrope } from "next/font/google";
import { Quote } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { getReferenceCheckStatus, computeReferenceReport, type RefereeRole } from "@/lib/referenceChecks";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = { title: "Reference checks" };

// Printable/PDF-export target for the reference check report. Rebuilt to
// mirror the mockup's dedicated `u9` testimonial-wall PDF template
// (mockups/merito-dashboard-v34.html) rather than the generic
// fitment-report-style layout the first pass used -- see
// app/api/hub/references/export/route.tsx for the headless-Chromium caller.

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

// Cycles per referee index, matching the mockup's u4 avatar palette.
const AVATAR_COLORS = ["#EC1B25", "#2563EB", "#D97706"];

function toneFor(score: number): string {
  if (score >= 4) return "#15803D";
  if (score >= 3) return "#B45309";
  if (score > 0) return "#B91C1C";
  return "#9CA3AF";
}

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function StarRating({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} viewBox="0 0 20 20" className="h-4 w-4" fill={star <= rounded ? "#D97706" : "#E5E7EB"}>
          <path d="M10 1.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z" />
        </svg>
      ))}
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

  // report.categoryScores[c].values[i] lines up with report.referees[i] --
  // computeReferenceReport builds both from the same filtered/ordered
  // `completed` list, so pivoting per-category values back into a
  // per-referee scores[] array (matching the mockup's referee.scores shape)
  // is safe here.
  const refereeScores = report.referees.map((_, i) => report.categoryScores.map((c) => c.values[i]));

  return (
    <div
      className={`${manrope.variable} p-6 sm:p-8`}
      style={{ background: "#FEFCF8", color: "#111827", fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
    >
      <div className="mb-5 flex items-center justify-between flex-wrap" style={{ gap: 10 }}>
        <div className="flex items-center font-bold" style={{ gap: 6, fontSize: 18, color: "#EC1B25" }}>
          <Image src="/logo.png" alt="Merito" width={128} height={36} style={{ height: 22, width: "auto" }} />
        </div>
        {current?.role_title && (
          <span className="font-semibold" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: "#DBEAFE", color: "#1D4ED8" }}>
            {current.role_title}
          </span>
        )}
      </div>

      <div className="mb-6 text-center">
        <div className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.02em", color: "#9CA3AF" }}>
          What people say working with
        </div>
        <h1 className="font-bold" style={{ marginTop: 4, fontSize: 24, color: "#111827" }}>
          {displayName}
        </h1>
        <div className="flex flex-col items-center" style={{ marginTop: 12, gap: 6 }}>
          <StarRating value={report.overallScore} />
          <div style={{ fontSize: 14, color: "#6B7280" }}>
            <span className="font-bold" style={{ color: "#111827" }}>
              {report.overallScore} / 5
            </span>{" "}
            from {report.referees.length} references
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
        {report.referees.map((referee, i) => (
          <div key={i} className="relative border" style={{ background: "#fff", borderColor: "#F1E9DC", borderRadius: 16, padding: 20, breakInside: "avoid" }}>
            <Quote className="mb-2 h-6 w-6" style={{ color: "#F3E4C8" }} fill="#F3E4C8" />
            <p className="italic leading-relaxed" style={{ marginBottom: 16, fontSize: 13.5, color: "#374151" }}>
              {referee.overallFeedback}
            </p>
            <div className="flex items-center" style={{ gap: 10 }}>
              <div
                className="grid shrink-0 place-items-center rounded-full font-bold text-white"
                style={{ height: 36, width: 36, fontSize: 12, background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
              >
                {initialsFor(referee.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold" style={{ fontSize: 13, color: "#111827" }}>
                  {referee.name}
                </div>
                <div className="truncate" style={{ fontSize: 11, color: "#9CA3AF" }}>
                  {ROLE_LABEL[referee.role]}
                  {referee.organization ? ` · ${referee.organization}` : ""}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border" style={{ background: "#fff", borderColor: "#F1E9DC", borderRadius: 16, padding: 20 }}>
        <div className="font-bold" style={{ marginBottom: 12, fontSize: 16, color: "#111827" }}>
          Category breakdown
        </div>
        <div className="flex flex-col" style={{ gap: 12 }}>
          {report.categoryScores.map((category, c) => {
            const color = toneFor(category.value);
            return (
              <div key={category.category}>
                <div className="flex items-center justify-between" style={{ marginBottom: 4, fontSize: 14 }}>
                  <span style={{ color: "#374151" }}>{category.label}</span>
                  <span className="font-bold" style={{ color }}>
                    {category.value > 0 ? category.value.toFixed(1) : "—"}
                    {refereeScores.length > 0 && (
                      <span className="font-normal" style={{ color: "#9CA3AF" }}>
                        {" "}
                        ({refereeScores.map((scores) => scores[c]).join(", ")})
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 8, overflow: "hidden", background: "#F5EEDD" }}>
                  <div style={{ height: "100%", borderRadius: 8, width: `${(category.value / 5) * 100}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
