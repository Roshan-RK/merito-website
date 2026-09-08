import Link from "next/link";
import RevealOnScroll from "@/components/anim/RevealOnScroll";
import { PRODUCT_PRICING, formatPrice } from "@/lib/razorpay/pricing";

// Public, pre-signup pricing. Numbers come from the same PRODUCT_PRICING table
// the authenticated checkout uses, so this display can never drift from what a
// visitor is actually charged. Entry-level rates shown; only the mock interview
// and 1:1 session cost more at senior level, and that is called out inline.
type Row = {
  label: string;
  price: number;
  seniorPrice?: number;
  desc: string;
  inBundle?: boolean;
};

const PAID: Row[] = [
  {
    label: "Detailed Report",
    price: PRODUCT_PRICING.report.entry,
    desc: "A full breakdown of your fitment score, skill gaps, and the exact CV fixes for this role.",
    inBundle: true,
  },
  {
    label: "Personality Assessment",
    price: PRODUCT_PRICING.personality.entry,
    desc: "A Big Five (OCEAN) assessment mapping how you work and relate to others, matched to the role.",
    inBundle: true,
  },
  {
    label: "Reference Checks",
    price: PRODUCT_PRICING.references.entry,
    desc: "We verify at least 3 professional references you invite and compile their feedback into your profile.",
    inBundle: true,
  },
  {
    label: "Mock AI Interview",
    price: PRODUCT_PRICING.interview.entry,
    seniorPrice: PRODUCT_PRICING.interview.senior,
    desc: "A realistic AI interview matched to your role, with a scored performance report to practise against.",
  },
  {
    label: "1:1 Counselling Session",
    price: PRODUCT_PRICING.counselling.entry,
    seniorPrice: PRODUCT_PRICING.counselling.senior,
    desc: "A Merito career expert reviews your results and gives you a straight, personalised plan.",
  },
];

const BUNDLE_PRICE = PRODUCT_PRICING.bundle.entry;
const BUNDLE_SOLO_TOTAL =
  PRODUCT_PRICING.report.entry + PRODUCT_PRICING.personality.entry + PRODUCT_PRICING.references.entry;
const BUNDLE_SAVING = BUNDLE_SOLO_TOTAL - BUNDLE_PRICE;

export default function PricingSection() {
  return (
    <section id="pricing" className="bg-white" style={{ padding: "56px 0", scrollMarginTop: 110 }}>
      <div className="max-w-[1340px] mx-auto px-5">
        <RevealOnScroll>
          <div className="flex flex-col items-center text-center" style={{ gap: 16 }}>
            <span
              className="inline-flex items-center bg-[#ed1a24] text-white font-[family-name:var(--font-poppins)] font-bold uppercase"
              style={{ borderRadius: 50, padding: "6px 16px", fontSize: 11, letterSpacing: "0.04em" }}
            >
              Pricing
            </span>
            <h2
              className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
              style={{ fontSize: "clamp(2rem,3.5vw,3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: 0, maxWidth: 860 }}
            >
              Your first score is <span className="text-[#ed1a24]">free.</span> Everything else is pay-as-you-go.
            </h2>
            <p className="font-[family-name:var(--font-poppins)] font-medium text-[#4b4b4d]" style={{ fontSize: 17, lineHeight: 1.65, margin: 0, maxWidth: 720 }}>
              No subscription. Buy only the parts of your profile you want, once.
            </p>
          </div>
        </RevealOnScroll>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 16, marginTop: 40 }}>
          <RevealOnScroll>
            <div className="flex flex-col h-full bg-[#fdf8fb] border border-[#f4d8d8]" style={{ borderRadius: 18, padding: "24px 22px" }}>
              <span className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#ed1a24]" style={{ fontSize: 10, letterSpacing: "0.05em" }}>
                Start here
              </span>
              <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "10px 0 0" }}>
                CV Fitment Score
              </h3>
              <p className="font-[family-name:var(--font-gabarito)] font-bold text-[#ed1a24]" style={{ fontSize: "1.8rem", margin: "8px 0 0" }}>
                Free
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 16px" }}>
                Your fitment score against the exact role you&apos;re targeting. No sign-up for the first one.
              </p>
              <a
                href="#fit-checker"
                className="inline-flex items-center justify-center font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors mt-auto"
                style={{ height: 46, borderRadius: 8, fontSize: 14 }}
              >
                Check my fitment - free
              </a>
            </div>
          </RevealOnScroll>

          {PAID.map((r, i) => (
            <RevealOnScroll key={r.label} delay={i * 0.05}>
              <div
                className="flex flex-col h-full bg-white border border-black/[0.08]"
                style={{ borderRadius: 18, padding: "24px 22px", boxShadow: "0px 12px 36px rgba(17,35,89,0.05)" }}
              >
                <h3 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: 0 }}>
                  {r.label}
                </h3>
                <p className="font-[family-name:var(--font-gabarito)] font-bold text-black" style={{ fontSize: "1.6rem", margin: "8px 0 0" }}>
                  {formatPrice(r.price)}
                  {r.seniorPrice && r.seniorPrice !== r.price ? (
                    <span className="font-[family-name:var(--font-poppins)] font-medium text-[#9c9c9c]" style={{ fontSize: 12 }}>
                      {" "}· {formatPrice(r.seniorPrice)} at senior level
                    </span>
                  ) : null}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 0" }}>
                  {r.desc}
                </p>
                {r.inBundle ? (
                  <p className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 11.5, margin: "10px 0 0" }}>
                    Included in the Full Profile Bundle
                  </p>
                ) : null}
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll delay={0.1}>
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-[#0a0a0a]"
            style={{ borderRadius: 18, padding: "24px 26px", marginTop: 16, gap: 16 }}
          >
            <div>
              <p className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.2rem", margin: 0 }}>
                Full Profile Bundle — {formatPrice(BUNDLE_PRICE)}
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-[rgba(255,255,255,0.7)]" style={{ fontSize: 13, margin: "6px 0 0" }}>
                Detailed report + personality assessment + reference checks. Save {formatPrice(BUNDLE_SAVING)} versus buying them separately ({formatPrice(BUNDLE_SOLO_TOTAL)}).
              </p>
            </div>
            <a
              href="#fit-checker"
              className="inline-flex items-center justify-center flex-shrink-0 font-[family-name:var(--font-poppins)] font-semibold text-white bg-[#ed1a24] hover:bg-[#c8151e] transition-colors"
              style={{ height: 48, padding: "0 22px", borderRadius: 8, fontSize: 14 }}
            >
              Start with your free score
            </a>
          </div>
        </RevealOnScroll>

        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c] text-center" style={{ fontSize: 12, margin: "18px 0 0" }}>
          Prices in INR, charged securely via Razorpay. See our{" "}
          <Link href="/refund-policy" className="underline">Refund &amp; Cancellation Policy</Link>.
        </p>
      </div>
    </section>
  );
}
