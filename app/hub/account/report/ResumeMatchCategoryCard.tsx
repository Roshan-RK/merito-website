import type { ComponentType } from "react";
import { Target, GraduationCap, Briefcase, MapPin, Building2, Crosshair } from "lucide-react";
import type { ResumeMatchCategory, ResumeMatchCategoryKey } from "@/lib/intervuebox/reports";
import { getMatchBandDark } from "./ResumeMatchGauge";

// Icon-per-dimension mapping matches mockups/merito-dashboard-v34.html's tA
// lookup exactly (Skills Match -> target, Role Relevance -> crosshair) --
// verified live in the rendered mockup, not assumed from the label text.
const CATEGORY_ICONS: Record<ResumeMatchCategoryKey, ComponentType<{ size?: number; strokeWidth?: number; className?: string }>> = {
  skillsMatch: Target,
  educationMatch: GraduationCap,
  experienceMatch: Briefcase,
  locationMatch: MapPin,
  domainMatch: Building2,
  roleRelevance: Crosshair,
};

export default function ResumeMatchCategoryCard({ category }: { category: ResumeMatchCategory }) {
  const band = getMatchBandDark(category.score);
  const Icon = CATEGORY_ICONS[category.key];
  return (
    <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: "16px 18px", breakInside: "avoid" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <h3 className="flex items-center font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ gap: 8, fontSize: "1.05rem", margin: 0 }}>
          <Icon size={14} strokeWidth={2} className="text-white/40" />
          {category.label}
        </h3>
        <span className="font-[family-name:var(--font-poppins)] font-semibold" style={{ fontSize: 13, color: band.textColor }}>
          {category.score}%
        </span>
      </div>
      <div className="overflow-hidden" style={{ height: 6, borderRadius: 6, marginBottom: 10, background: band.trackColor }}>
        <div
          style={{
            borderRadius: 6,
            width: `${Math.min(100, Math.max(0, category.score))}%`,
            height: "100%",
            background: band.textColor,
          }}
        />
      </div>
      <p className="font-[family-name:var(--font-poppins)] text-white/55" style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
        {category.comment}
      </p>
    </div>
  );
}
