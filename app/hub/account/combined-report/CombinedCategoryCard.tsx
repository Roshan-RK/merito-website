import type { ResumeMatchCategory } from "@/lib/intervuebox/reports";
import { getMatchBand } from "../report/ResumeMatchGauge";
import { remapBand } from "./combinedBandColors";

export default function CombinedCategoryCard({ category }: { category: ResumeMatchCategory }) {
  const band = remapBand(getMatchBand(category.score));
  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 16, padding: "20px 22px" }}>
      <div className="flex items-baseline justify-between" style={{ marginBottom: 8 }}>
        <h4 className="font-[family-name:var(--font-inter)] font-semibold text-black" style={{ fontSize: 15, margin: 0 }}>
          {category.label}
        </h4>
        <span className="font-[family-name:var(--font-ibm-plex-mono)] font-semibold" style={{ fontSize: 13, color: band.textColor }}>
          {category.score}%
        </span>
      </div>
      <p className="font-[family-name:var(--font-inter)] text-[#6C6779]" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
        {category.comment}
      </p>
    </div>
  );
}
