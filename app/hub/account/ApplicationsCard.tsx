import Link from "next/link";

export type Application = {
  id: string;
  roleTitle: string;
  score: number;
  createdAt: string;
};

// Each row links to that role's Overview via `?lead=<id>` -- the hub-wide
// active-role selector that the TopBar switcher also drives. The row whose
// id matches `currentLeadId` is highlighted and marked "Current".
export default function ApplicationsCard({ applications, currentLeadId }: { applications: Application[]; currentLeadId: string }) {
  if (applications.length === 0) return null;

  return (
    <section id="applications" style={{ scrollMarginTop: 82 }} data-testid="applications-card">
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
              data-testid={`application-row-${app.id}`}
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
                  data-testid={`interview-score-${app.id}`}
                >
                  {app.score.toFixed(1)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="font-[family-name:var(--font-poppins)] text-white/35" style={{ fontSize: 11.5, margin: "8px 2px 0", lineHeight: 1.5 }}>
        Select any application to load its fitment score and report on this dashboard. Your personality test and reference checks are shared across every application.
      </p>
    </section>
  );
}
