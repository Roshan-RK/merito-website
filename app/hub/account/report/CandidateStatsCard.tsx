import { Phone, Mail, MapPin } from "lucide-react";

// currentSalary/expectedSalary/noticePeriod/willingToRelocate are always
// "Not specified" — Merito's own applicant-intake flow sends that literal
// placeholder to IntervueBox for every candidate (specs/2026-07-17-intervuebox-
// integration-design.md, "Applicant Not specified/null placeholders" — vendor-
// confirmed contract, not a guess), and there's no API to read a different
// value back. Shown as-is rather than invented or hidden.
const NOT_SPECIFIED = "Not specified";

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
}: {
  email: string | null;
  phoneNumber: string | null;
  location: string | null;
  totalExperience: number | null;
}) {
  const hasContact = Boolean(phoneNumber || email || location);

  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 18 }}>
      {hasContact && (
        <div className="flex flex-wrap items-center border-b border-white/[0.08]" style={{ gap: 18, paddingBottom: 14, marginBottom: 14 }}>
          {phoneNumber && <ContactItem icon={<Phone size={13} strokeWidth={2} />} value={phoneNumber} />}
          {email && <ContactItem icon={<Mail size={13} strokeWidth={2} />} value={email} />}
          {location && <ContactItem icon={<MapPin size={13} strokeWidth={2} />} value={location} />}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 16 }}>
        <StatItem label="Total work experience" value={totalExperience != null ? `${totalExperience} years` : NOT_SPECIFIED} />
        <StatItem label="Current salary" value={NOT_SPECIFIED} />
        <StatItem label="Expected salary" value={NOT_SPECIFIED} />
        <StatItem label="Notice period" value={NOT_SPECIFIED} />
        <StatItem label="Willing to relocate" value={NOT_SPECIFIED} />
      </div>
    </div>
  );
}
