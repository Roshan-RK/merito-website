import { getSupabaseServerClient } from "@/lib/supabase";

const REFERENCE_STATUSES = ["initiated", "in_progress", "completed", "cancelled"] as const;

async function getFunnelCounts() {
  const supabase = getSupabaseServerClient();

  const [{ data: leadRows }, { count: reportsUnlocked }, { count: interviewsStarted }, { count: interviewsCompleted }, { count: interviewsTerminated }, { count: personalityCompleted }, { data: referenceRows }] =
    await Promise.all([
      supabase.from("fitment_leads").select("user_id"),
      supabase.from("report_unlocks").select("*", { count: "exact", head: true }),
      supabase.from("fitment_interviews").select("*", { count: "exact", head: true }).eq("status", "invited"),
      supabase.from("fitment_interviews").select("*", { count: "exact", head: true }).eq("status", "ready"),
      supabase.from("fitment_interviews").select("*", { count: "exact", head: true }).eq("status", "terminated"),
      supabase.from("personality_tests").select("*", { count: "exact", head: true }),
      supabase.from("reference_checks").select("status"),
    ]);

  const fitmentStarted = new Set((leadRows ?? []).map((r) => r.user_id)).size;

  const referenceCounts: Record<string, number> = Object.fromEntries(REFERENCE_STATUSES.map((s) => [s, 0]));
  for (const row of referenceRows ?? []) {
    if (row.status in referenceCounts) referenceCounts[row.status] += 1;
  }

  return {
    fitmentStarted,
    reportsUnlocked: reportsUnlocked ?? 0,
    interviewsStarted: interviewsStarted ?? 0,
    interviewsCompleted: interviewsCompleted ?? 0,
    interviewsTerminated: interviewsTerminated ?? 0,
    personalityCompleted: personalityCompleted ?? 0,
    referenceCounts,
  };
}

export default async function AdminFunnelPage() {
  const stats = await getFunnelCounts();

  const rows: Array<[string, number]> = [
    ["Fitment check started", stats.fitmentStarted],
    ["Report unlocked (paid)", stats.reportsUnlocked],
    ["Interview started", stats.interviewsStarted],
    ["Interview completed", stats.interviewsCompleted],
    ["Interview terminated", stats.interviewsTerminated],
    ["Personality test completed", stats.personalityCompleted],
    ...REFERENCE_STATUSES.map((s): [string, number] => [`References — ${s}`, stats.referenceCounts[s]]),
  ];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} style={{ borderBottom: "1px solid #eee" }}>
            <td className="font-[family-name:var(--font-poppins)] text-black" style={{ padding: "10px 0", fontSize: 14 }}>
              {label}
            </td>
            <td className="font-[family-name:var(--font-poppins)] font-semibold text-black" style={{ padding: "10px 0", fontSize: 14, textAlign: "right" }}>
              {value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
