"use client";

import { FileText } from "lucide-react";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { Application } from "./ApplicationsCard";

// Grounded in real data only: each row is a past fitment check completing.
// The mockup also shows a "New job match" activity type, but there's no
// job-matching/recommendation feature behind this app yet, so that row type
// is intentionally not reproduced here.
export default function RecentActivityCard({ applications }: { applications: Application[] }) {
  if (applications.length === 0) return null;

  return (
    <section>
      <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 11, letterSpacing: "0.08em", margin: "0 0 10px" }}>
        Recent activity
      </p>
      <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 16, padding: 6 }}>
        {applications.slice(0, 3).map((app, i) => (
          <div
            key={app.id}
            className="flex items-center"
            style={{ gap: 12, padding: "12px 14px", borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center justify-center bg-[#ed1a24]/12 text-[#ed1a24] shrink-0" style={{ width: 30, height: 30, borderRadius: 8 }}>
              <FileText size={14} strokeWidth={2} />
            </div>
            <div>
              <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                Your fitment score for {app.roleTitle} is ready — {app.score.toFixed(1)}/10
              </p>
              <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11.5, margin: "2px 0 0" }}>
                {formatRelativeTime(app.createdAt)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
