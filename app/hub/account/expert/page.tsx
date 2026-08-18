import { redirect } from "next/navigation";
import { Quote } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { DEFAULT_LEVEL, PRODUCT_PRICING, formatPrice, type CandidateLevel } from "@/lib/razorpay/pricing";
import ExpertBookingCard from "./ExpertBookingCard";

// Static bio content, verbatim from mockups/merito-dashboard-v34.html's
// expert-guidance page (constants `ti`, `tc`, and the bio/testimonial copy
// inside component `fz`). No live data for the bio itself -- only the
// booking card below it (ExpertBookingCard) is wired to real state.
const NAME = "Rushikesh Humbe";
const TITLE = "Strategy & Growth Advisor";
const CREDENTIALS = "20+ years in strategy consulting & workforce development · COEP & IIM Ahmedabad";
const STATS = [
  { label: "Candidates coached", value: "600+" },
  { label: "Avg. rating", value: "4.9★" },
  { label: "Years experience", value: "20" },
];
const BIO =
  "Rushikesh spent two decades in strategy consulting and workforce development — including employability programs adopted nationwide — before bringing that lens to individual candidates. He reads your fitment report, personality results, and mock interview the way he'd assess talent for a growth strategy: where's the real leverage, and what's the fastest path to it.";
const TESTIMONIAL =
  "Rushikesh didn't just point out what was wrong with my resume — he explained why it mattered from a hiring manager's perspective. That reframing got me two callbacks the next week.";
const TESTIMONIAL_ATTRIBUTION = "Priya S., hired as DevOps Engineer";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

export default async function ExpertBioPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("candidate_level")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const level = (leads?.[0]?.candidate_level as CandidateLevel | null) ?? DEFAULT_LEVEL;
  const priceLabel = formatPrice(PRODUCT_PRICING.counselling[level]);

  const { data: counsellingRequest } = await supabase
    .from("counselling_requests")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const initials = NAME.split(" ")
    .map((part) => part[0])
    .join("");
  const firstName = NAME.split(" ")[0];

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 720, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Expert guidance
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0 }}>
            Meet your career expert
          </h1>
        </div>

        <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 20, padding: 24 }}>
          <div className="flex items-start flex-wrap" style={{ gap: 16, marginBottom: 20 }}>
            <div
              className="flex items-center justify-center shrink-0 border border-[#ed1a24]/30 bg-[#ed1a24]/15 font-[family-name:var(--font-gabarito)] font-semibold text-white"
              style={{ width: 64, height: 64, borderRadius: "50%", fontSize: 18 }}
            >
              {initials}
            </div>
            <div>
              <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: 17, margin: 0 }}>
                {NAME}
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13.5, margin: "2px 0 0" }}>
                {TITLE}
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 12, margin: "4px 0 0" }}>
                {CREDENTIALS}
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-3 divide-x divide-white/[0.08] border border-white/[0.08]"
            style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", marginBottom: 20 }}
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center" style={{ padding: "12px 8px" }}>
                <p className="font-[family-name:var(--font-gabarito)] font-semibold text-[#ed1a24]" style={{ fontSize: 18, margin: 0 }}>
                  {stat.value}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 10.5, lineHeight: 1.3, margin: "2px 0 0" }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <p className="font-[family-name:var(--font-poppins)] text-white/60" style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 20px" }}>
            {BIO}
          </p>

          <div className="border border-white/[0.08]" style={{ borderRadius: 12, background: "rgba(255,255,255,0.03)", padding: 16 }}>
            <Quote size={16} strokeWidth={2} className="text-[#ed1a24]" style={{ marginBottom: 6 }} />
            <p className="font-[family-name:var(--font-poppins)] italic text-white/75" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              &quot;{TESTIMONIAL}&quot;
            </p>
            <p className="font-[family-name:var(--font-poppins)] font-semibold text-white/40" style={{ fontSize: 11.5, margin: "8px 0 0" }}>
              — {TESTIMONIAL_ATTRIBUTION}
            </p>
          </div>
        </div>

        <ExpertBookingCard firstName={firstName} priceLabel={priceLabel} initialRequested={Boolean(counsellingRequest)} />
      </div>
    </main>
  );
}
