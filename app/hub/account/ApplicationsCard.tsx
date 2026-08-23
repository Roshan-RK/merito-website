import Link from "next/link";

export type Application = {
  id: string;
  roleTitle: string;
  score: number;
  createdAt: string;
};

// There's no per-application deep-link yet -- every report/interview/etc.
// page always reflects `leads[0]` (the latest lead), regardless of which
// row a candidate looks at here. Rows are display-only until a real
// ?lead= selector exists (tracked as the multi-role-switcher project), so
// this card is a status list, not a switcher.
export default function ApplicationsCard({ applications, currentLeadId }: { applications: Application[]; currentLeadId: string }) {
  if (applications.length === 0) return null;

  return (
    <section id="applications" style={{ scrollMarginTop: 82 }}>
      <div className="flex items-center justify-between" style={{ margin: "0 0 10px" }}>
        <p className="font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40" style={{ fontSize: 11, letterSpacing: "0.08em", margin: 0 }}>
          Your applications
        </p>
        <Link
          href="/hub/account/applications"
          className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] hover:text-white transition-colors"
          style={{ fontSize: 11.5 }}
        >
          View all →
        </Link>
      </div>
      <div className="bg-[#141416] border border-white/[0.08]" style={{ borderRadius: 16, padding: 6 }}>
        {applications.map((app, i) => {
          const isCurrent = app.id === currentLeadId;
          return (
            <Link
              key={app.id}
              href={`?lead=${app.id}`}
              className="block"
            >
              <div
                className={isCurrent ? "bg-[#ed1a24]/[0.06]" : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "13px 14px",
                  borderRadius: 10,
                  borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
              >
                <div>
                  <p className="font-[family-name:var(--font-poppins)] font-semibold text-white" style={{ fontSize: 13.5, margin: 0 }}>
                    {app.roleTitle}
                    {isCurrent && (
                      <span className="font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24]" style={{ fontSize: 10.5, marginLeft: 8, textTransform: "uppercase" }}>
                        Current
                      </span>
                    )}
                  </p>
                  <p className="font-[family-name:var(--font-poppins)] text-white/40" style={{ fontSize: 11.5, margin: "2px 0 0" }}>
                    {new Date(app.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div
                  className="flex items-center justify-center font-[family-name:var(--font-poppins)] font-bold text-[#ed1a24]"
                  style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #ed1a24", fontSize: 12.5, flexShrink: 0 }}
                >
                  {app.score.toFixed(1)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="font-[family-name:var(--font-poppins)] text-white/35" style={{ fontSize: 11.5, margin: "8px 2px 0", lineHeight: 1.5 }}>
        Your dashboard shows detail for your most recent application only. Older applications are listed for reference.
      </p>
    </section>
  );
}
