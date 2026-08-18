import { redirect } from "next/navigation";
import Link from "next/link";
import type { ComponentType } from "react";
import { FileText, Brain, Users, Mic, UserRound, Package } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { DEFAULT_LEVEL, type CandidateLevel } from "@/lib/razorpay/pricing";
import { buildPricingCards, buildBundleSummary, type PricingCardKey } from "./pricingCatalog";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

const CARD_ICONS: Record<PricingCardKey, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  report: FileText,
  personality: Brain,
  references: Users,
  interview: Mic,
  counselling: UserRound,
};

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
    .select("candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const level = (lead?.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
  const levelLabel = level.charAt(0).toUpperCase() + level.slice(1);

  const cards = buildPricingCards(level);
  const bundle = buildBundleSummary(level);

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 1040, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Account
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0 }}>
            Pricing
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
            Priced for where you are in your career right now.
          </p>

          <div
            className="inline-flex items-center bg-[#ed1a24]/10 border border-[#ed1a24]/25"
            style={{ gap: 8, borderRadius: 50, padding: "7px 14px", marginTop: 14 }}
          >
            <span className="bg-[#ed1a24]" style={{ width: 6, height: 6, borderRadius: "50%" }} />
            <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 12.5 }}>
              Your pricing tier: {levelLabel}-level
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 14 }}>
          {cards.map((card) => {
            const Icon = CARD_ICONS[card.key];
            return (
              <div
                key={card.key}
                className="bg-[#141416] border border-white/[0.08] flex flex-col"
                style={{ borderRadius: 14, padding: 18 }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
                  <div
                    className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24]"
                    style={{ width: 36, height: 36, borderRadius: 10 }}
                  >
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  {card.inBundle && (
                    <span
                      className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40 bg-white/[0.06]"
                      style={{ fontSize: 9.5, letterSpacing: "0.05em", borderRadius: 50, padding: "3px 9px" }}
                    >
                      In bundle
                    </span>
                  )}
                </div>

                <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 4px" }}>
                  {card.label}
                </h3>
                <p
                  className="font-[family-name:var(--font-poppins)] text-white/50"
                  style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 16px", flex: 1 }}
                >
                  {card.description}
                </p>

                <div className="flex items-baseline" style={{ gap: 6, marginBottom: 12 }}>
                  <span className="font-[family-name:var(--font-gabarito)] font-bold text-white" style={{ fontSize: 20 }}>
                    {card.priceLabel}
                  </span>
                  {card.bundlePriceLabel && (
                    <span className="text-white/40" style={{ fontSize: 11.5 }}>
                      · {card.bundlePriceLabel} bundled
                    </span>
                  )}
                </div>

                <Link
                  href="/hub/account"
                  className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]"
                  style={{ fontSize: 12.5 }}
                >
                  Get this on Overview →
                </Link>
              </div>
            );
          })}

          <div
            className="border border-[#ed1a24]/30 flex flex-col"
            style={{ background: "linear-gradient(to bottom right, #1a0507, #141416)", borderRadius: 14, padding: 20 }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div className="flex items-center justify-center bg-[#ed1a24]/15 text-[#ed1a24]" style={{ width: 40, height: 40, borderRadius: 10 }}>
                <Package size={18} strokeWidth={2} />
              </div>
              <span
                className="font-[family-name:var(--font-poppins)] font-bold uppercase bg-[#ed1a24] text-white"
                style={{ fontSize: 9.5, letterSpacing: "0.05em", borderRadius: 50, padding: "4px 10px" }}
              >
                Best value
              </span>
            </div>

            <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 15, margin: "0 0 4px" }}>
              Full Profile Bundle
            </h3>
            <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 12.5, lineHeight: 1.6, margin: "0 0 16px" }}>
              Report, personality test, and reference checks together.
            </p>

            <div className="flex items-baseline" style={{ gap: 8, marginBottom: 6 }}>
              <span className="font-[family-name:var(--font-gabarito)] font-bold text-white" style={{ fontSize: 24 }}>
                {bundle.bundlePriceLabel}
              </span>
              <span className="text-white/35" style={{ fontSize: 12.5, textDecoration: "line-through" }}>
                {bundle.soloTotalLabel}
              </span>
            </div>
            <p className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 11.5, color: "#3FCB8C", margin: "0 0 16px" }}>
              You save {bundle.savingsLabel}
            </p>

            <Link
              href="/hub/account"
              className="text-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
              style={{ borderRadius: 8, padding: "11px 16px", fontSize: 13.5 }}
            >
              Get the bundle on Overview →
            </Link>
          </div>
        </div>

        <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 640, margin: 0 }}>
          Only the personality test is discounted inside the bundle. Report and reference pricing stay identical either
          way, so bundling never costs more than buying separately.
        </p>
      </div>
    </main>
  );
}
