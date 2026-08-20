import { Eye } from "lucide-react";

export default function RecruiterActivityPanel({ viewCount }: { viewCount: number }) {
  if (viewCount === 0) return null;

  return (
    <div className="flex items-center bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 14, padding: 16, gap: 12 }}>
      <div className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24] shrink-0" style={{ width: 34, height: 34, borderRadius: 9 }}>
        <Eye size={16} strokeWidth={2} />
      </div>
      <div>
        <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13, margin: 0 }}>
          Viewed by recruiters {viewCount} time{viewCount === 1 ? "" : "s"} in the last 30 days
        </p>
        <p className="font-[family-name:var(--font-poppins)] text-white/45" style={{ fontSize: 12, margin: "3px 0 0" }}>
          Recruiters using the Merito extension have checked out your profile.
        </p>
      </div>
    </div>
  );
}
