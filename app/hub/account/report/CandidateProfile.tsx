import type { ComponentType, ReactNode } from "react";
import { GraduationCap, Briefcase, Award, ChevronDown } from "lucide-react";
import type { CandidateEducation, CandidateExperience } from "@/lib/intervuebox/reports";

// Native <details>/<summary> gives us expand/collapse for free — no client
// component, no state, matches the mockup's accordion without adding any
// interactivity logic to what was a pure server-rendered panel.
function AccordionSection({
  icon: Icon,
  title,
  count,
  defaultOpen,
  children,
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: "0 16px" }}>
      <summary className="flex items-center justify-between" style={{ padding: "14px 0", cursor: "pointer", listStyle: "none" }}>
        <span className="flex items-center font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ gap: 10, fontSize: 13.5 }}>
          <Icon size={15} strokeWidth={2} className="text-white/45" />
          {title}
          <span className="font-normal text-white/40" style={{ fontSize: 12 }}>
            ({count})
          </span>
        </span>
        <ChevronDown size={15} strokeWidth={2} className="shrink-0 text-white/40 transition-transform group-open:rotate-180" />
      </summary>
      <div style={{ paddingBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </details>
  );
}

export default function CandidateProfile({
  education,
  experience,
  certifications,
}: {
  education: CandidateEducation[];
  experience: CandidateExperience[];
  certifications: string[];
}) {
  if (education.length === 0 && experience.length === 0 && certifications.length === 0) return null;

  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
        Candidate profile
      </p>
      <div className="flex flex-col" style={{ gap: 10 }}>
        {education.length > 0 && (
          <AccordionSection icon={GraduationCap} title="Education" count={education.length} defaultOpen>
            {education.map((e, i) => (
              <div key={i} className="bg-white/[0.04]" style={{ borderRadius: 10, padding: 12 }}>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13, margin: 0 }}>
                  {e.qualification}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12, margin: "3px 0 0" }}>
                  {e.college} · {e.duration}
                </p>
              </div>
            ))}
          </AccordionSection>
        )}
        {experience.length > 0 && (
          <AccordionSection icon={Briefcase} title="Experience" count={experience.length} defaultOpen>
            {experience.map((e, i) => (
              <div key={i} className="bg-white/[0.04]" style={{ borderRadius: 10, padding: 12 }}>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13, margin: 0 }}>
                  {e.position}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 12, margin: "3px 0 0" }}>
                  {e.company} · {e.duration}
                </p>
              </div>
            ))}
          </AccordionSection>
        )}
        {certifications.length > 0 && (
          <AccordionSection icon={Award} title="Certifications" count={certifications.length}>
            {certifications.map((c, i) => (
              <div key={i} className="bg-white/[0.04]" style={{ borderRadius: 10, padding: 12 }}>
                <p className="font-[family-name:var(--font-poppins)] text-white" style={{ fontSize: 13, margin: 0 }}>
                  {c}
                </p>
              </div>
            ))}
          </AccordionSection>
        )}
      </div>
    </div>
  );
}
