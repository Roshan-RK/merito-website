import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Merito collects, uses, shares, and protects your data.",
  alternates: { canonical: "/privacy" },
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

export default function PrivacyPage() {
  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "2rem", margin: "0 0 8px" }}>
          Privacy Policy
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 12px" }}>
          Last updated: {UPDATED}
        </p>
        <p
          className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]"
          style={{ fontSize: 12, margin: "0 0 32px", fontStyle: "italic" }}
        >
          This policy is current and under ongoing legal review; we may refine wording without changing how we actually handle your data.
        </p>

        <div className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <H2>Who we are</H2>
          <p>
            Merito HUB is operated by Career Corner Education Pvt. Ltd (&ldquo;Merito&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), an
            AI-enabled recruitment company registered in India. This policy covers merito.ai, the Merito HUB product, and the Merito
            HUB browser extension. For anything in this policy, or to exercise your rights, contact{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">admin@merito.ai</a>.
          </p>

          <H2>What we collect</H2>
          <p>
            <strong className="text-black">Information you give us.</strong> When you check your fitment for a role, we collect your
            name, email address, phone number, target role, experience level, the job description you provide, and the CV you upload.
            Your CV is parsed to extract its text, which we store so you don&apos;t have to re-upload it each visit. If you create an
            account, add a personality assessment, take a mock interview, or invite references, we collect the responses, results, and
            reference feedback tied to your profile. If you make a payment, our payment processor collects your payment details
            directly &mdash; we receive only a transaction reference and status, never your full card or bank details.
          </p>
          <p>
            <strong className="text-black">Information we collect automatically.</strong> IP address, browser type and version, device
            type and operating system, pages viewed, time spent, referring source, and similar technical data &mdash; through cookies
            and similar technologies (see below).
          </p>

          <H2>Cookies and tracking technologies</H2>
          <p>
            We and our analytics and advertising partners use cookies, pixels, and local storage to keep you signed in, remember your
            progress, measure how the site performs, understand which campaigns bring people to us, and show and measure ads on
            third-party platforms. Partners used for this include Google (Tag Manager, Analytics), Meta (Facebook/Instagram pixel),
            and LinkedIn (Insight Tag). You can control non-essential cookies through your browser settings and through each
            platform&apos;s own ad settings; blocking them will not stop you from using the free fitment score.
          </p>

          <H2>How we use your information</H2>
          <p>
            To generate your fitment score and detailed report; to build and maintain your Merito HUB profile; to run the personality
            assessment, mock interview, and reference checks you choose to add; to process payments and provide support; to operate,
            secure, and improve the site; to measure and improve our marketing; to match you with relevant roles through Merito&apos;s
            recruitment services if you are looking for a new role; and to meet legal and regulatory obligations.
          </p>

          <H2>Legal basis for processing</H2>
          <p>
            Where the GDPR or similar laws apply, we process personal data on the basis of your consent, the performance of a contract
            with you, our legitimate interests in operating and improving our services, and compliance with legal obligations. Where
            India&apos;s Digital Personal Data Protection Act, 2023 applies, we process your personal data on the basis of your consent
            or for legitimate uses permitted under that Act.
          </p>

          <H2>Service providers and sharing</H2>
          <p>We share personal data only with:</p>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            <li><strong className="text-black">Sub-processors that run the product</strong> &mdash; cloud hosting and database (Supabase, Vercel), AI model provider for scoring and report generation (Anthropic), mock-interview provider (Manavritti Solutions Pvt Ltd / IntervueBox), payment processing (Razorpay), customer chat (Zoho SalesIQ), and bot protection (Google reCAPTCHA).</li>
            <li><strong className="text-black">Analytics and advertising partners</strong> &mdash; Google, Meta, and LinkedIn, as described under Cookies above.</li>
            <li><strong className="text-black">Recruiters and hiring managers</strong> &mdash; only the parts of your Merito HUB profile you have explicitly chosen to share, and only with recruiters you have applied to or who are hiring through Merito. We never share your raw score, your gaps, or your CV content with a recruiter without your action. You can revoke this visibility at any time.</li>
            <li><strong className="text-black">Legal authorities</strong> &mdash; where required by law, or to protect our rights, users, or the public.</li>
          </ul>
          <p>We do not sell your personal data.</p>

          <H2>International data transfers</H2>
          <p>
            We are based in India and our providers may process data in India, the United States, the European Union, and other
            jurisdictions. Where we transfer personal data across borders, we rely on your consent and on contractual protections with
            our providers.
          </p>

          <H2>Data retention and deletion</H2>
          <p>
            We keep your CV text, fitment data, and profile for as long as your account is active, and for a reasonable period
            afterwards to meet legal, accounting, and dispute-resolution needs, after which it is deleted or anonymised. You can
            request deletion of your data at any time by emailing{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">admin@merito.ai</a>; we will action verified requests
            within the timelines required by applicable law.
          </p>

          <H2>Your rights</H2>
          <p>
            Subject to applicable law, you can request access to your personal data, correction of inaccurate data, deletion, a copy
            of your data in a portable format, restriction of or objection to certain processing, and withdrawal of consent at any
            time (without affecting processing already carried out). To exercise any of these, contact{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">admin@merito.ai</a>. If you are in the EU/UK you may
            also complain to your local data protection authority.
          </p>

          <H2>Data security</H2>
          <p>
            We use administrative, technical, and physical safeguards appropriate to the sensitivity of the data, including encryption
            in transit, access controls, and vetted sub-processors. No method of transmission or storage is completely secure, and we
            cannot guarantee absolute security.
          </p>

          <H2>Children</H2>
          <p>
            Merito HUB is not intended for anyone under 18. We do not knowingly collect personal data from minors; if you believe a
            minor has provided us data, contact us and we will delete it.
          </p>

          <H2>Automated processing</H2>
          <p>
            Your fitment score and reports are generated with the help of an AI model. These are decision-support tools reviewed by
            human recruiters and hiring managers &mdash; no hiring decision is made solely by automated means through Merito HUB.
          </p>

          <H2>Links to other sites</H2>
          <p>We are not responsible for the privacy practices of third-party sites linked from ours.</p>

          <H2>Changes to this policy</H2>
          <p>
            We may update this policy from time to time. We will post the revised version here with a new &ldquo;last updated&rdquo;
            date; continued use of the site after that constitutes acceptance.
          </p>

          <H2>Grievance officer and contact</H2>
          <p>
            For questions, complaints, or to exercise your rights under India&apos;s Digital Personal Data Protection Act, 2023 or any
            other applicable law, contact our Grievance Officer:
          </p>
          <p style={{ margin: "8px 0 0" }}>
            Grievance Officer, Career Corner Education Pvt. Ltd<br />
            Email: <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">admin@merito.ai</a>
          </p>
        </div>
      </div>
    </main>
  );
}
