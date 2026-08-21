import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Manrope } from "next/font/google";
import { ShieldCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { isProductUnlocked } from "@/lib/productUnlocks";
import {
  TRAITS,
  TRAIT_NAME,
  TRAIT_MEANING,
  TRAIT_WORK_IMPLICATION,
  BANDS,
  traitLevel,
  validityFlags,
  nameFromEmail,
  type Scores,
  type Validity,
  type TraitKey,
} from "@/lib/personality";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = { title: "Personality test" };

// Printable/PDF-export target for the personality report -- mirrors
// app/hub/account/report/print/page.tsx's pattern (light theme, single
// continuous page, screenshotted by app/api/hub/personality/export/route.tsx
// via headless Chromium). Per-trait accent colors match the mockup's own
// light PDF template and its locked-state preview teaser (PersonalityLockedState's
// PREVIEW_TRAITS) verbatim -- each trait gets a distinct color rather than
// one flat accent, since personality traits aren't a pass/fail verdict.

const TRAIT_COLOR: Record<TraitKey, string> = {
  C: "#EC1B25",
  ES: "#3B82F6",
  A: "#22C55E",
  O: "#A855F7",
  E: "#F59E0B",
};

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

export default async function PersonalityPrintPage({
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
    .select("role_title")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const { role } = await searchParams;
  const roleTitle = (typeof role === "string" ? role : null) ?? leads?.[0]?.role_title ?? null;

  if (!roleTitle) {
    redirect("/hub/account");
  }

  const unlocked = await isProductUnlocked(user.id, "personality");
  const { data: existing } = await supabase
    .from("personality_tests")
    .select("scores, validity")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!unlocked || !existing?.scores || !existing?.validity) {
    redirect("/hub/account/personality");
  }

  const scores = existing.scores as Scores;
  const validity = existing.validity as Validity;
  const displayName = nameFromEmail(user.email ?? "");
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const flags = validityFlags(validity);
  const formattedDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const validityCells: { label: string; value: string; verdict: string; ok: boolean; note: string }[] = [
    {
      label: "Acquiescence (agree bias)",
      value: `${validity.meanRaw.toFixed(2)} avg`,
      verdict: validity.meanRaw >= 3.6 ? "Leans to agreeing" : validity.meanRaw <= 2.4 ? "Leans to disagreeing" : "Balanced",
      ok: validity.meanRaw < 3.6 && validity.meanRaw > 2.4,
      note: "Balanced ≈ 3.0 · higher = agrees regardless of content",
    },
    {
      label: "Central tendency",
      value: `${Math.round(validity.pctMid)}% midpoint`,
      verdict: validity.pctMid >= 40 ? "High midpoint use" : validity.pctMid >= 25 ? "Some midpoint use" : "Decisive",
      ok: validity.pctMid < 40,
      note: "Share of “neither” answers · high = fence-sitting",
    },
    {
      label: "Consistency",
      value: `${validity.incon.toFixed(2)} avg gap`,
      verdict: validity.incon >= 1.5 ? "High, possibly careless" : validity.incon >= 1.0 ? "Moderate" : "Consistent",
      ok: validity.incon < 1.5,
      note: "Agreement across similar item pairs · lower = consistent",
    },
    {
      label: "Social desirability",
      value: `${validity.sd.toFixed(2)} avg`,
      verdict: validity.sd >= 4 ? "Elevated" : validity.sd >= 3.25 ? "Moderate" : "Low",
      ok: validity.sd < 4,
      note: "Impression-management items · high = presenting favourably",
    },
  ];

  return (
    <div className={`${manrope.variable} sm:p-8`} style={{ background: "#FBF3F4", color: "#111827", fontFamily: "var(--font-manrope), system-ui, sans-serif", minHeight: "100vh", padding: "24px" }}>
      <div className="flex items-start justify-between flex-wrap" style={{ gap: 12, marginBottom: 20 }}>
        <div>
          <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
            <h1 className="font-bold" style={{ fontSize: 24, margin: 0, color: "#111827" }}>
              {displayName}
            </h1>
            <span className="font-semibold text-white" style={{ fontSize: 12, borderRadius: 50, padding: "4px 12px", background: "#EC1B25" }}>
              {roleTitle}
            </span>
          </div>
          <p style={{ fontSize: 14, margin: "4px 0 0", color: "#6B7280" }}>{formattedDate}</p>
        </div>
        <MeritoMark />
      </div>

      <Card>
        <p className="font-semibold uppercase" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 6px", color: "#9CA3AF" }}>
          Personality profile · Big Five (OCEAN)
        </p>
        <p style={{ fontSize: 13, margin: "0 0 18px", color: "#EC1B25" }}>fit signal for {roleTitle}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {TRAITS.map((t) => {
            const color = TRAIT_COLOR[t];
            return (
              <div key={t}>
                <div className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                  <span className="font-semibold" style={{ fontSize: 13.5, color: "#111827" }}>
                    {TRAIT_NAME[t]}
                  </span>
                  <span className="font-semibold" style={{ fontSize: 12.5, color }}>
                    {scores[t].pct}% · {BANDS[scores[t].band]}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 6, overflow: "hidden", background: "#E5E7EB" }}>
                  <div style={{ height: "100%", borderRadius: 6, width: `${scores[t].pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12, marginBottom: 16 }}>
        {TRAITS.map((t) => {
          const s = scores[t];
          const level = traitLevel(s.pct);
          const color = TRAIT_COLOR[t];
          return (
            <div key={t} className="border" style={{ background: "#fff", borderColor: "#F1E3E5", borderRadius: 16, padding: 16, breakInside: "avoid" }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                <span className="font-semibold" style={{ fontSize: 14, color: "#111827" }}>
                  {TRAIT_NAME[t]}
                </span>
                <span className="font-bold" style={{ fontSize: 20, color }}>
                  {s.pct}%
                </span>
              </div>
              <div>
                <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: "0.06em", color }}>
                  What it measures{"  "}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.6, color: "#4B5563" }}>{TRAIT_MEANING[t]}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <span className="font-bold uppercase" style={{ fontSize: 10, letterSpacing: "0.06em", color }}>
                  At work{"  "}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.6, color: "#4B5563" }}>{TRAIT_WORK_IMPLICATION[t][level](firstName)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <Card>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
          <ShieldCheck size={16} strokeWidth={2} style={{ color: "#6B7280" }} />
          <span className="font-bold" style={{ fontSize: 16, color: "#111827" }}>
            Response quality &amp; validity checks
          </span>
        </div>
        <p style={{ fontSize: 12, margin: "0 0 16px", color: "#9CA3AF" }}>
          Automated checks on how the questionnaire was answered &mdash; not part of the personality result itself.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
          {validityCells.map((c) => (
            <div key={c.label} style={{ background: "#F9FAFB", borderRadius: 12, padding: 14 }}>
              <p style={{ fontSize: 12, margin: "0 0 3px", color: "#9CA3AF" }}>{c.label}</p>
              <p className="font-bold" style={{ fontSize: 15, margin: "0 0 3px", color: "#111827" }}>
                {c.value}
              </p>
              <p style={{ color: c.ok ? "#15803D" : "#B45309", fontSize: 12.5, fontWeight: 600, margin: 0 }}>{c.verdict}</p>
              <p style={{ fontSize: 11, margin: "4px 0 0", color: "#6B7280" }}>{c.note}</p>
            </div>
          ))}
        </div>
        <div
          style={{
            borderRadius: 12,
            padding: "14px 16px",
            marginTop: 16,
            fontSize: 13,
            lineHeight: 1.6,
            background: flags.length === 0 ? "#DCFCE7" : "#FEF3C7",
            color: flags.length === 0 ? "#15803D" : "#92400E",
          }}
        >
          {flags.length === 0
            ? "Validity checks passed. The response pattern looks honest and attentive, so the scores can be read at face value."
            : `Interpret with some caution. The response pattern shows signs of ${flags.join(", ")}. Treat the trait scores as indicative and confirm anything important in a structured interview.`}
        </div>
      </Card>
    </div>
  );
}
