import type { CandidateEducation, CandidateExperience } from "@/lib/intervuebox/reports";

export default function CandidateProfile({
  education,
  experience,
  certifications,
}: {
  education: CandidateEducation[];
  experience: CandidateExperience[];
  certifications: string[];
}) {
  return (
    <div style={{ marginTop: 32 }}>
      <h2 className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: "1.3rem", margin: "0 0 14px" }}>
        Candidate profile
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 24 }}>
        {education.length > 0 && (
          <div>
            <h3 className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Education
            </h3>
            {education.map((e, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5, margin: 0 }}>
                  {e.qualification}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
                  {e.college} · {e.duration}
                </p>
              </div>
            ))}
          </div>
        )}
        {experience.length > 0 && (
          <div>
            <h3 className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
              Experience
            </h3>
            {experience.map((e, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13.5, margin: 0 }}>
                  {e.position}
                </p>
                <p className="font-[family-name:var(--font-poppins)] text-[#4b4b4d]" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
                  {e.company} · {e.duration}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      {certifications.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 className="font-[family-name:var(--font-poppins)] font-bold uppercase text-[#9c9c9c]" style={{ fontSize: 11, letterSpacing: "0.06em", margin: "0 0 10px" }}>
            Certifications
          </h3>
          {certifications.map((c, i) => (
            <p key={i} className="font-[family-name:var(--font-poppins)] text-black" style={{ fontSize: 13, margin: "0 0 6px" }}>
              {c}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
