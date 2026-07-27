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
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 11.5, margin: "0 0 4px" }}>
        {label}
      </p>
      <p className="font-[family-name:var(--font-gabarito)] font-semibold text-black" style={{ fontSize: 14.5, margin: 0 }}>
        {value}
      </p>
    </div>
  );
}

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center text-[#4b4b4d]" style={{ gap: 8 }}>
      {icon}
      <span className="font-[family-name:var(--font-poppins)]" style={{ fontSize: 13.5 }}>
        {value}
      </span>
    </div>
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
  return (
    <div
      className="bg-white border border-black/[0.08]"
      style={{
        borderRadius: 14,
        padding: 20,
        margin: "20px 0 24px",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)",
        gap: 24,
      }}
    >
      <div className="flex flex-col" style={{ gap: 10, borderRight: "1px solid rgba(0,0,0,0.08)", paddingRight: 24 }}>
        {phoneNumber && <ContactRow icon={<Phone size={14} />} value={phoneNumber} />}
        {email && <ContactRow icon={<Mail size={14} />} value={email} />}
        {location && <ContactRow icon={<MapPin size={14} />} value={location} />}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 18 }}>
        <StatItem label="Total work experience" value={totalExperience != null ? `${totalExperience} years` : NOT_SPECIFIED} />
        <StatItem label="Current salary" value={NOT_SPECIFIED} />
        <StatItem label="Expected salary" value={NOT_SPECIFIED} />
        <StatItem label="Notice period" value={NOT_SPECIFIED} />
        <StatItem label="Willing to relocate" value={NOT_SPECIFIED} />
      </div>
    </div>
  );
}
