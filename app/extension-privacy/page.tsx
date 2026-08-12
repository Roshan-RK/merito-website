import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merito Recruiter Preview Extension — Privacy Policy",
  description: "How the Merito Recruiter Preview browser extension collects, uses, and protects data.",
};

export default function ExtensionPrivacyPage() {
  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "2rem", margin: "0 0 8px" }}>
          Merito Recruiter Preview Extension — Privacy Policy
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 32px" }}>
          Last updated: August 2026
        </p>

        <div className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <p>
            This policy covers the Merito Recruiter Preview browser extension specifically —
            for how Merito HUB (the website) handles candidate data, see our{" "}
            <a href="/privacy" className="text-[#ed1a24] underline">
              main Privacy Policy
            </a>
            .
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What the extension does
          </h2>
          <p>
            The extension shows a recruiter (the extension&apos;s user) a candidate&apos;s Merito
            Hub report, or a fitment score against a job description the recruiter provides,
            while the recruiter is viewing that candidate&apos;s public LinkedIn profile page.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What we collect
          </h2>
          <p>From the recruiter using the extension:</p>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20 }}>
            <li>Their work email and company name, used to confirm they&apos;re a recruiter before scoring profiles that aren&apos;t yet on Merito.</li>
            <li>The job description text they paste or upload, used to score candidates against it.</li>
          </ul>
          <p>From the LinkedIn profile page the recruiter is currently viewing:</p>
          <ul style={{ margin: "0 0 16px", paddingLeft: 20 }}>
            <li>The candidate&apos;s LinkedIn profile URL, name, headline, listed experience, education, and skills — read directly from the page the recruiter is already viewing.</li>
          </ul>
          <p>
            The extension does not read pages other than public LinkedIn profile pages
            (<code>linkedin.com/in/*</code>), and does not run on any other site.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            How we use it
          </h2>
          <p>
            If the candidate already has a Merito Hub account, we show the recruiter that
            candidate&apos;s existing verified report. If not, the profile data listed above is
            used to build a synthetic representation of the candidate&apos;s public profile,
            which is sent to our resume-matching partner, IntervueBox, solely to compute a
            fitment score against the recruiter&apos;s job description. This is never presented
            to the candidate as, or confused with, a real submitted resume — it&apos;s purely a
            scoring input.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What we share
          </h2>
          <p>
            We share the minimum data described above with IntervueBox, our resume-matching
            service provider, solely to compute the fitment score. We do not sell any data
            collected by this extension to third parties, and we do not share a candidate&apos;s
            LinkedIn data with anyone other than the recruiter who was already viewing that
            candidate&apos;s own public profile.
          </p>
          <p>
            If a candidate is shortlisted and chooses to claim their profile (via a link the
            recruiter shares with them directly — Merito never contacts a candidate without
            their own action), they provide their own real email at that point and control
            their resulting Merito Hub account from there.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            Data retention and deletion
          </h2>
          <p>
            Recruiter verification data and job-description text are retained while the
            recruiter&apos;s account with us is active. You can request deletion of any data
            collected via this extension at any time by contacting{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">
              admin@merito.ai
            </a>
            .
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            Contact
          </h2>
          <p>
            Questions about this policy can be sent to{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">
              admin@merito.ai
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
