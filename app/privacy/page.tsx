import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Merito collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <main className="bg-[#fdf8fb]" style={{ minHeight: "60vh", padding: "64px 20px" }}>
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "2rem", margin: "0 0 8px" }}>
          Privacy Policy
        </h1>
        <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 13, margin: "0 0 32px" }}>
          Last updated: July 2026
        </p>

        <div className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 14, lineHeight: 1.8 }}>
          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What we collect
          </h2>
          <p>
            When you use Merito HUB to check your fitment for a role, we collect the email
            address, target role, job description, and CV you provide. Your CV is parsed to
            extract its text content, which we store to generate your fitment score and, if
            you unlock it, your detailed fitment report — so you don&apos;t need to re-upload
            your CV every time you return.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            How we use it
          </h2>
          <p>
            Your CV and job description text are used to generate your fitment score and
            report via an AI model, and to build your Merito HUB profile. If you&apos;re
            looking for a new role, we may also use this information to match you with
            relevant opportunities through Merito&apos;s recruitment services.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            What we share
          </h2>
          <p>
            We never share your raw fitment score, gaps, or CV content with recruiters or
            third parties without your explicit action. Once your Merito HUB profile supports
            it, you will control exactly which sections of your profile are visible to
            recruiters.
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            Data retention and deletion
          </h2>
          <p>
            We retain your CV text and fitment data for as long as your account is active.
            You can request deletion of your data at any time by contacting us at{" "}
            <a href="mailto:admin@merito.ai" className="text-[#ed1a24] underline">
              admin@merito.ai
            </a>
            .
          </p>

          <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.2rem", margin: "24px 0 8px" }}>
            Contact
          </h2>
          <p>
            Questions about this policy or your data can be sent to{" "}
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
