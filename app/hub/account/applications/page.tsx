import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabaseAuthServer";
import { buildApplicationRows, type FitmentLeadRow } from "./applicationHistory";

const EYEBROW = "font-[family-name:var(--font-poppins)] font-bold uppercase text-white/40";

export default async function ApplicationsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/hub/login");
  }

  // Every fitment_leads row for this user -- this app has no multi-role
  // switcher yet (tracked separately), so this is a read-only history list,
  // same caveat as ApplicationsCard on the Overview panel.
  const { data: leads } = await supabase
    .from("fitment_leads")
    .select("id, role_title, score, resume_match_status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rows = buildApplicationRows((leads ?? []) as FitmentLeadRow[]);

  return (
    <main>
      <div className="mx-auto" style={{ maxWidth: 1040, padding: "28px 24px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <p className={EYEBROW} style={{ fontSize: 10.5, letterSpacing: "0.08em", margin: "0 0 6px" }}>
            Account
          </p>
          <h1 className="font-[family-name:var(--font-gabarito)] font-semibold text-white" style={{ fontSize: "1.7rem", margin: 0 }}>
            All applications
          </h1>
          <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, margin: "6px 0 0" }}>
            Every role you&apos;ve checked your fitment against.
          </p>
        </div>

        <div className="bg-[#141416] border border-white/[0.08] overflow-hidden" style={{ borderRadius: 14 }}>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center text-center" style={{ gap: 12, padding: "64px 24px" }}>
              <div
                className="flex items-center justify-center bg-white/[0.06] text-white/40"
                style={{ width: 48, height: 48, borderRadius: "50%" }}
              >
                <Briefcase size={20} strokeWidth={2} />
              </div>
              <p className="font-[family-name:var(--font-poppins)] text-white/50" style={{ fontSize: 13.5, maxWidth: 280 }}>
                No applications yet. Check your fit for a role to see it listed here.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {["Role", "Score", "Date checked", "Status"].map((heading) => (
                      <th
                        key={heading}
                        className="text-left font-[family-name:var(--font-poppins)] font-semibold uppercase text-white/40"
                        style={{ fontSize: 10.5, letterSpacing: "0.05em", padding: "12px 20px" }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                      <td
                        className="font-[family-name:var(--font-poppins)] font-medium text-white"
                        style={{ fontSize: 13.5, padding: "14px 20px" }}
                      >
                        {row.roleTitle}
                      </td>
                      <td className="font-mono font-semibold text-white" style={{ fontSize: 13.5, padding: "14px 20px" }}>
                        {row.scoreLabel}
                      </td>
                      <td className="font-mono text-white/40" style={{ fontSize: 12, padding: "14px 20px" }}>
                        {row.dateLabel}
                      </td>
                      <td style={{ padding: "14px 20px" }}>
                        <span
                          className={
                            row.statusLabel === "Report ready"
                              ? "inline-flex font-[family-name:var(--font-poppins)] font-semibold text-[#ed1a24] bg-[#ed1a24]/[0.12]"
                              : "inline-flex font-[family-name:var(--font-poppins)] font-semibold text-white/50 bg-white/[0.06]"
                          }
                          style={{ borderRadius: 50, padding: "4px 10px", fontSize: 11 }}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
