import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "When Merito HUB purchases can be refunded or cancelled.",
  alternates: { canonical: "/refund-policy" },
};

const UPDATED = "September 2026";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-[family-name:var(--font-gabarito)] font-semibold text-black"
      style={{ fontSize: "1.2rem", margin: "28px 0 8px" }}
    >
      {children}
    </h2>
  );
}

export default function RefundPolicyPage() {
  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "2rem", margin: "0 0 8px" }}>
          Refund &amp; Cancellation Policy
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 12px" }}>
          Last updated: {UPDATED}
        </p>
        <p
          className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]"
          style={{ fontSize: 12, margin: "0 0 32px", fontStyle: "italic" }}
        >
          This policy is current and under ongoing legal review.
        </p>

        <div className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <H2>The free fitment score</H2>
          <p>Your first fitment score for a role is free. There is nothing to refund or cancel.</p>

          <H2>Detailed report, personality assessment, reference checks</H2>
          <p>
            These are digital products delivered immediately after payment. Once the report or result has been generated and made
            available in your account, the purchase is non-refundable, because it has already been delivered in full.
          </p>

          <H2>Mock AI interview</H2>
          <p>
            Non-refundable once you have started the interview. If you have paid but not yet started, you may request a full refund
            within 7 days of purchase.
          </p>

          <H2>1:1 counselling session</H2>
          <p>
            You may reschedule a booked session free of charge up to 24 hours before the start time. Cancellations made more than 24
            hours before the session are refundable in full. Cancellations within 24 hours, or a no-show, are non-refundable. If the
            Merito expert cannot attend, you will be offered a new time or a full refund.
          </p>

          <H2>Technical failure</H2>
          <p>
            If a technical failure on our side prevents your paid report, assessment, interview, or session from being delivered and
            we are unable to resolve it, you are entitled to a full refund to your original payment method.
          </p>

          <H2>Duplicate or failed payments</H2>
          <p>
            If you are charged more than once for the same product, or charged for a transaction that failed, the extra amount is
            refunded in full.
          </p>

          <H2>How to request a refund</H2>
          <p>
            Email <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">admin@merito.ai</a> from the address on your
            account, with your order reference and the reason. We aim to respond within 3 business days. Approved refunds are issued to
            your original payment method through Razorpay and typically settle within 5&ndash;7 business days, depending on your bank.
          </p>

          <H2>Related</H2>
          <p>
            See also our{" "}
            <Link href="/terms" className="text-[#ed1a24] underline">Terms of Service</Link> and{" "}
            <Link href="/privacy" className="text-[#ed1a24] underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
