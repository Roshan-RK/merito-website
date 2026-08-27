import { getSupabaseServerClient } from "@/lib/supabase";
import { getInterviewReport, getInterviewCandidateStatus } from "./interviewReports";
import { buildReportRaw } from "./reportRaw";

type Row = {
  id: string;
  user_id: string;
  role_title: string;
  ib_agent_id: string;
  ib_candidate_id: string;
  status: string;
};

// One-row version of sweepPendingInterviews()'s per-row vendor check, so the
// status route (and, later, the SSR self-heals) reconcile against IntervueBox
// the same way the cron sweep does instead of each hand-rolling a READY-only
// subset. Writes any resulting fitment_interviews change, inserts the READY /
// TERMINATED hub_notifications row, and returns the candidate-facing status.
// Never throws -- a vendor error resolves to the row's current mapped status.
export async function reconcileInterviewRow(
  row: Row
): Promise<"ready" | "terminated" | "appeared" | "invited"> {
  const supabase = getSupabaseServerClient();
  try {
    const report = await getInterviewReport(row.ib_agent_id, row.ib_candidate_id);
    if (report.status === "READY") {
      // Conditional flip: gated on the row being "invited" or "terminated"
      // (i.e. not already "ready") so a re-check that races an
      // already-completed flip gets 0 rows back and inserts no duplicate
      // "report is ready" notification -- while still recovering a
      // "terminated" row whose report was generated after the fact (e.g. an
      // admin ran generateInterviewReport on a terminated session). Was
      // `.eq("status","invited")`, which stranded that terminated row on the
      // "interrupted" card despite a real report existing.
      const { data: flipped } = await supabase
        .from("fitment_interviews")
        .update({
          status: "ready",
          report_raw: buildReportRaw(report),
          // A row that self-resolves here may have had stuck_at set by a
          // doomed resume/launch call racing the report's real arrival --
          // clear it so the admin "Interview stuck" count stops counting it.
          stuck_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .in("status", ["invited", "terminated"])
        .select("id");
      if (flipped && flipped.length > 0) {
        await supabase.from("hub_notifications").insert({
          user_id: row.user_id,
          message: `Your ${row.role_title} mock interview report is ready.`,
          category: "interview",
          created_by: "system",
        });
      }
      return "ready";
    }

    // Report isn't ready -- only now pay for the extra candidate-status call
    // (mirrors the sweep). null means no session yet at all: expected, not an
    // error.
    const candidateStatus = await getInterviewCandidateStatus(row.ib_agent_id, row.ib_candidate_id);

    if (candidateStatus === "TERMINATED") {
      // Conditional flip: only the caller that actually moves the row off
      // "invited" gets rows back, so only it inserts the notification --
      // prevents a duplicate when a sweep tick and a page poll race.
      const { data: flipped } = await supabase
        .from("fitment_interviews")
        .update({ status: "terminated", ib_interview_status: "TERMINATED" })
        .eq("id", row.id)
        .eq("status", "invited")
        .select("id");
      if (flipped && flipped.length > 0) {
        await supabase.from("hub_notifications").insert({
          user_id: row.user_id,
          message: `Your ${row.role_title} mock interview was interrupted. You can resume it from your dashboard whenever you're ready.`,
          category: "interview",
          created_by: "system",
        });
      }
      return "terminated";
    }

    if (candidateStatus === "APPEARED") {
      await supabase.from("fitment_interviews").update({ ib_interview_status: "APPEARED" }).eq("id", row.id);
      return "appeared";
    }

    if (candidateStatus) {
      await supabase.from("fitment_interviews").update({ ib_interview_status: candidateStatus }).eq("id", row.id);
    }
    return row.status === "terminated" ? "terminated" : "invited";
  } catch (err) {
    console.error("reconcileInterviewRow failed, leaving row as-is", { rowId: row.id, error: err });
    return row.status === "terminated" ? "terminated" : "invited";
  }
}
