export default function RecruiterActivityPanel({ viewCount }: { viewCount: number }) {
  if (viewCount === 0) return null;

  return (
    <div className="bg-white border border-black/[0.08]" style={{ borderRadius: 14, padding: 18 }}>
      <p className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ fontSize: 13, margin: 0 }}>
        Viewed by recruiters {viewCount} time{viewCount === 1 ? "" : "s"} in the last 30 days
      </p>
      <p className="font-[family-name:var(--font-poppins)] text-[#9c9c9c]" style={{ fontSize: 12, margin: "6px 0 0" }}>
        Recruiters using the Merito extension have checked out your profile.
      </p>
    </div>
  );
}
