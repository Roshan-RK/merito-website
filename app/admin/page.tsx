import { getSupabaseServerClient } from "@/lib/supabase";
import { Table, TableRow, TableCell } from "@/app/admin/_components/Table";

const REFERENCE_STATUSES = ["initiated", "in_progress", "completed", "cancelled"] as const;

async function getFunnelCounts() {
  const supabase = getSupabaseServerClient();

  const [{ data: leadRows }, { count: reportsUnlocked }, { count: interviewsStarted }, { count: interviewsCompleted }, { count: personalityCompleted }, { data: referenceRows }] =
    await Promise.all([
      supabase.from("fitment_leads").select("user_id"),
      supabase.from("report_unlocks").select("*", { count: "exact", head: true }),
      supabase.from("fitment_interviews").select("*", { count: "exact", head: true }).eq("status", "invited"),
      supabase.from("fitment_interviews").select("*", { count: "exact", head: true }).eq("status", "ready"),
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
    ["Personality test completed", stats.personalityCompleted],
    ...REFERENCE_STATUSES.map((s): [string, number] => [`References — ${s}`, stats.referenceCounts[s]]),
  ];

  return (
    <Table>
      <tbody>
        {rows.map(([label, value]) => (
          <TableRow key={label}>
            <TableCell>{label}</TableCell>
            <TableCell align="right">
              <strong className="text-black">{value}</strong>
            </TableCell>
          </TableRow>
        ))}
      </tbody>
    </Table>
  );
}
