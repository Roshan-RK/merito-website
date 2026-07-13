"use client";

import { useState } from "react";

const FAQS = [
  { q: "Is the fitment score really free?", a: "Yes. Upload your CV, pick a job, and get your score with no sign-up and no payment. The detailed report is free too - you just create an account to unlock it." },
  { q: "What goes on my one-page profile?", a: "Your fitment to the role, your personality-to-job fit, your mock interview standing, verified references, and your key strengths - all on a single page you attach to job applications." },
  { q: "Who can see my Merito HUB profile?", a: "Only what you choose to share. The profile and the recruiter extension show your verified, approved credential - never raw scores and never your development gaps. You stay in control, and you can switch sharing off any time." },
  { q: "Do I have to leave LinkedIn to use this?", a: "No. Merito HUB makes your existing LinkedIn profile work harder - recruiters using our extension see your credential right where they already are." },
  { q: "Is this for freshers or experienced professionals?", a: "Both. Entry-level, mid-level, or senior - the platform adapts to where you are in your career." },
  { q: "How is this different from a resume builder?", a: "A resume builder makes your CV look nicer. Merito HUB tells you whether you actually fit the job, helps you prove it, and puts that proof in front of the people doing the hiring." },
];

export default function FaqAccordion() {
  const [open, setOpen] = useState(0);

  return (
    <div>
      {FAQS.map((f, i) => {
        const isOpen = open === i;
        return (
          <div
            key={f.q}
            onClick={() => setOpen(isOpen ? -1 : i)}
            className="bg-white border border-black/[0.08] cursor-pointer overflow-hidden transition-[border-left-color] duration-200"
            style={{
              borderRadius: 20,
              borderLeft: `6px solid ${isOpen ? "#ed1a24" : "transparent"}`,
              boxShadow: "0px 16px 36px rgba(17,35,89,0.06)",
              marginBottom: 10,
            }}
          >
            <div className="flex items-center justify-between" style={{ padding: "18px 22px", gap: 16 }}>
              <span
                className="font-[family-name:var(--font-poppins)]"
                style={{ fontSize: 16, fontWeight: isOpen ? 700 : 500, color: isOpen ? "#000" : "#4b4b4d" }}
              >
                {f.q}
              </span>
              <svg
                width="16"
                height="16"
                fill="none"
                stroke="#4b4b4d"
                strokeWidth="2"
                viewBox="0 0 24 24"
                className="flex-shrink-0 transition-transform duration-200"
                style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                <path d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {isOpen && (
              <div className="font-[family-name:var(--font-poppins)] text-[#66686d]" style={{ padding: "0 22px 18px", fontSize: 14, lineHeight: 1.75 }}>
                {f.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
