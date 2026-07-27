"use client";

import { useState } from "react";

const FAQS = [
  { q: "Will my current employer or network see that I'm using this?", a: "No. Nothing about your Merito activity is visible to anyone unless you choose to share it. Your fitment score, reports, and profile are private by default - you decide exactly what's shown, and to whom." },
  { q: "Who is Merito HUB actually for?", a: "Anyone trying to prove they're a stronger candidate than their CV alone suggests - from a student applying for their first role, to a manager pushing for the next step up, to a senior leader making a confidential move. The scoring changes by stage; the core idea doesn't." },
  { q: "Is the fitment score really free?", a: "Yes. Upload your CV, name the job you're targeting, and get your score with no sign-up and no payment. Your first detailed report is free too - you just create an account to unlock it." },
  { q: "What actually goes on my Merito profile?", a: "Whichever of your fitment score, personality-to-role map, verified references, and mock interview results you choose to include. Nothing is added without your approval." },
  { q: "Who can see my Merito HUB profile?", a: "Only recruiters and hiring managers you've applied to, or who are hiring through Merito and viewing your LinkedIn profile via our extension - and only the parts of your profile you've approved for that. You can revoke visibility at any time." },
  { q: "Do I have to leave LinkedIn to use this?", a: "No. Merito HUB works alongside LinkedIn; your existing profile stays exactly as it is. Recruiters hiring through Merito simply see your verified Merito credential layered alongside it." },
  { q: "How is this different from a resume builder or LinkedIn Premium?", a: "A resume builder formats what you already claim about yourself. LinkedIn Premium gives you visibility metrics about your own profile. Neither one gives a recruiter independent, verified proof of your fit, your working style, or your references. Merito HUB does, and puts that proof directly in front of the person deciding, at the moment they're deciding." },
  { q: "Does an AI decide whether I get hired?", a: "No. Merito HUB scores fit and surfaces evidence; it doesn't make hiring decisions. Every score is a data point a human recruiter or hiring manager reviews - it's designed to get you seen and fairly considered, not to replace their judgment." },
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
