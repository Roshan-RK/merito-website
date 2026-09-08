import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Merito HUB.",
  alternates: { canonical: "/terms" },
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

export default function TermsPage() {
  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "2rem", margin: "0 0 8px" }}>
          Terms of Service
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 12px" }}>
          Last updated: {UPDATED}
        </p>
        <p
          className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]"
          style={{ fontSize: 12, margin: "0 0 32px", fontStyle: "italic" }}
        >
          These terms are current and under ongoing legal review.
        </p>

        <div className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <H2>1. Who we are</H2>
          <p>
            Merito HUB is operated by Career Corner Education Pvt. Ltd (&ldquo;Merito&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By
            accessing merito.ai, the Merito HUB product, or the Merito HUB browser extension, you agree to these Terms. If you do not
            agree, do not use the service.
          </p>

          <H2>2. What Merito HUB is</H2>
          <p>
            Merito HUB is a set of tools that score how well your profile fits a target role and help you build a verified,
            candidate-controlled profile: a free CV fitment score, a paid detailed report, a personality assessment, an AI mock
            interview, reference checks, and optional 1:1 career guidance. Scores and reports are decision-support tools, not a
            guarantee of an interview, an offer, or any hiring outcome.
          </p>

          <H2>3. Eligibility and your account</H2>
          <p>
            You must be at least 18 years old to use Merito HUB. You are responsible for the accuracy of the information you provide
            and for keeping your account credentials secure. You may not use the service on behalf of someone else without their
            authorisation, upload another person&apos;s CV without their consent, or use the service unlawfully.
          </p>

          <H2>4. The free fitment score</H2>
          <p>
            The first fitment score for a role is free and does not require an account. To view your detailed report and to build your
            profile you create a free account. We may rate-limit or decline requests we believe to be automated, abusive, or
            fraudulent.
          </p>

          <H2>5. Payments</H2>
          <p>
            Paid products are priced as shown at checkout, in Indian Rupees, and are charged through our payment processor, Razorpay.
            Prices may change, but the price shown at the time of your purchase is the price that applies to that purchase. Refunds and
            cancellations are governed by our{" "}
            <Link href="/refund-policy" className="text-[#ed1a24] underline">Refund &amp; Cancellation Policy</Link>.
          </p>

          <H2>6. Your content and your profile</H2>
          <p>
            You keep ownership of your CV, your assessment responses, and the other content you provide. You grant Merito a licence to
            store and process that content to operate the service as described in our{" "}
            <Link href="/privacy" className="text-[#ed1a24] underline">Privacy Policy</Link>. You control which parts of your Merito HUB
            profile are visible to recruiters, and you can revoke that visibility at any time.
          </p>

          <H2>7. Reference checks</H2>
          <p>
            When you invite a referee, you confirm you have a genuine professional relationship with them and a reasonable basis to
            expect their feedback. Referees provide feedback voluntarily and may decline.
          </p>

          <H2>8. Acceptable use</H2>
          <p>
            You agree not to reverse-engineer, scrape, or overload the service; not to upload malware or unlawful, infringing, or
            misleading content; not to misrepresent your identity or experience; and not to use the service to build a competing
            product.
          </p>

          <H2>9. Intellectual property</H2>
          <p>
            The Merito HUB software, scoring methodology, report formats, branding, and site content are owned by Merito or its
            licensors. These Terms do not transfer any of those rights to you.
          </p>

          <H2>10. Third-party services</H2>
          <p>
            The service relies on third parties (including Anthropic, Manavritti Solutions Pvt Ltd, Razorpay, Supabase, and Zoho). Your
            use of features they power is also subject to their terms, and we are not responsible for their acts or omissions beyond
            what applicable law requires.
          </p>

          <H2>11. Disclaimers</H2>
          <p>
            The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We do not warrant that scores or reports are
            error-free, that the service will be uninterrupted, or that using Merito HUB will result in any particular career outcome.
          </p>

          <H2>12. Limitation of liability</H2>
          <p>
            To the maximum extent permitted by law, Merito will not be liable for indirect, incidental, or consequential losses, or
            for lost opportunities. Our total liability for any claim relating to the service is limited to the amount you paid us for
            the product giving rise to the claim in the 12 months before the claim.
          </p>

          <H2>13. Suspension and termination</H2>
          <p>
            You may stop using the service and request account deletion at any time. We may suspend or terminate access if you breach
            these Terms or use the service in a way that risks harm to Merito or others.
          </p>

          <H2>14. Changes to these Terms</H2>
          <p>
            We may update these Terms from time to time. We will post the revised version here with a new date; continued use after
            that constitutes acceptance.
          </p>

          <H2>15. Governing law</H2>
          <p>
            These Terms are governed by the laws of India. The courts of Pune, Maharashtra have exclusive jurisdiction over any
            dispute, subject to any non-waivable rights you have under the law of your place of residence.
          </p>

          <H2>16. Contact</H2>
          <p>
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">admin@merito.ai</a>
          </p>
        </div>
      </div>
    </main>
  );
}
