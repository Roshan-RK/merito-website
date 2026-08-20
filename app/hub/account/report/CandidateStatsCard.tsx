import { Phone, Mail, MapPin } from "lucide-react";
import type { CandidateExperience } from "@/lib/intervuebox/reports";

// currentSalary/expectedSalary/noticePeriod/willingToRelocate are always
// "Not specified" — Merito's own applicant-intake flow sends that literal
// placeholder to IntervueBox for every candidate (specs/2026-07-17-intervuebox-
// integration-design.md, "Applicant Not specified/null placeholders" — vendor-
// confirmed contract, not a guess), and there's no API to read a different
// value back. Shown as-is rather than invented or hidden.
const NOT_SPECIFIED = "Not specified";

// Used when the vendor's experience array is simply empty (fresher / no work
// history parsed) — distinct from NOT_SPECIFIED, which is reserved for the
// applicant-intake placeholder fields above.
const NO_EXPERIENCE = "Not available";

// IntervueBox's resume-parse experience array has no isCurrent/current flag —
// verified against 3 live candidates on 2026-08-17. Two of three had a
// literal "Present" in experience[0].duration (e.g. "2023-Present",
// "Jun 2026 – Present"); the third's dates were relative ("1 year") but its
// role ordering (Associate Consultant > System Engineer > Graduate Trainee >
// Management Intern, most-senior-first) matched the same most-recent-first
// convention. experience[0] is the reliable "current" entry; there is no
// separate "relevant experience" figure anywhere in the API (the resume-match
// experienceMatch.comment sometimes mentions a relevant-years figure in free
// text, but format is inconsistent across candidates and not safe to parse),
// so we show real totalExperience instead of fabricating one.
function currentRole(experience: CandidateExperience[]): { company: string; designation: string } | null {
  const latest = experience[0];
  if (!latest) return null;
  return { company: latest.company || NO_EXPERIENCE, designation: latest.position || NO_EXPERIENCE };
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11, margin: "0 0 4px" }}>
        {label}
      </p>
      <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13, margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function ContactItem({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <span className="flex items-center text-white/55" style={{ gap: 6 }}>
      {icon}
      <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13 }}>
        {value}
      </span>
    </span>
  );
}

export default function CandidateStatsCard({
  email,
  phoneNumber,
  location,
  totalExperience,
  experience,
}: {
  email: string | null;
  phoneNumber: string | null;
  location: string | null;
  totalExperience: number | null;
  experience: CandidateExperience[];
}) {
  const hasContact = Boolean(phoneNumber || email || location);
  const current = currentRole(experience);

  return (
    <div style={{ borderRadius: 14, padding: 18, background: "rgb(29,25,31)", border: "1px solid rgb(49,47,55)" }}>
      {hasContact && (
        <div className="flex flex-wrap items-center" style={{ gap: 18, paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid rgb(49,47,55)" }}>
          {phoneNumber && <ContactItem icon={<Phone size={13} strokeWidth={2} />} value={phoneNumber} />}
          {email && <ContactItem icon={<Mail size={13} strokeWidth={2} />} value={email} />}
          {location && <ContactItem icon={<MapPin size={13} strokeWidth={2} />} value={location} />}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 16 }}>
        <StatItem label="Total experience" value={totalExperience != null ? `${totalExperience} years` : NOT_SPECIFIED} />
        <StatItem label="Current company" value={current ? current.company : NO_EXPERIENCE} />
        <StatItem label="Current designation" value={current ? current.designation : NO_EXPERIENCE} />
        <StatItem label="Current salary" value={NOT_SPECIFIED} />
        <StatItem label="Expected salary" value={NOT_SPECIFIED} />
        <StatItem label="Notice period" value={NOT_SPECIFIED} />
        <StatItem label="Willing to relocate" value={NOT_SPECIFIED} />
      </div>
    </div>
  );
}
