import { getSupabaseServerClient } from "@/lib/supabase";
import { getInterviewReport, getInterviewCandidateStatus } from "./interviewReports";
import { buildReportRaw } from "./reportRaw";

export type SweepResult = { ready: number; appeared: number; terminated: number; errors: number };

// Shared by the webhook handler (app/api/webhooks/intervuebox/route.ts) and
// the cron backstop (app/api/cron/interview-sweep/route.ts). IntervueBox's
// webhook payload shape is undocumented, so neither caller parses it for
// identifiers -- any validly-signed webhook hit, or any cron tick, re-checks
// every row we still have as "invited" against the vendor's Reports and
// Candidates APIs. See specs/2026-07-17-intervuebox-integration-design.md
// (Open Item #2) and docs/superpowers/specs/2026-08-19-intervuebox-magic-link-resume-voice-design.md.
export async function sweepPendingInterviews(): Promise<SweepResult> {
  const supabase = getSupabaseServerClient();
  const result: SweepResult = { ready: 0, appeared: 0, terminated: 0, errors: 0 };

  const { data: pending, error: pendingError } = await supabase
    .from("fitment_interviews")
    .select("id, user_id, role_title, ib_agent_id, ib_candidate_id")
    .eq("status", "invited");

  if (pendingError || !pending) return result;

  const concurrency = Number(process.env.WEBHOOK_SWEEP_CONCURRENCY) || 10;
  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (row) => {
        try {
          const report = await getInterviewReport(row.ib_agent_id, row.ib_candidate_id);
          if (report.status === "READY") {
            // Conditional update, mirroring the terminated branch below: only
            // the sweep pass that actually flips the row off "invited" gets
            // rows back, so only that pass tells the candidate their report
            // landed -- prevents a duplicate notification when the webhook and
            // the cron backstop race on the same row.
            const { data: flipped, error: flipError } = await supabase
              .from("fitment_interviews")
              .update({
                status: "ready",
                report_raw: buildReportRaw(report),
                updated_at: new Date().toISOString(),
              })
              .eq("id", row.id)
              .eq("status", "invited")
              .select("id");
            if (flipError) {
              console.error("Sweep: ready-flip update failed", { row, error: flipError });
              result.errors += 1;
              return;
            }
            if (flipped && flipped.length > 0) {
              await supabase.from("hub_notifications").insert({
                user_id: row.user_id,
                message: `Your ${row.role_title} mock interview report is ready.`,
                category: "interview",
                created_by: "system",
              });
              result.ready += 1;
            }
            return;
          }

          // Report isn't ready yet -- only now check the candidate's raw
          // status (an extra vendor call), so the happy READY path above
          // never pays for it. null means no session yet at all -- a
          // normal, expected value, not an error.
          const candidateStatus = await getInterviewCandidateStatus(row.ib_agent_id, row.ib_candidate_id);

          if (candidateStatus === "TERMINATED") {
            // Conditional update: only the sweep pass that actually flips
            // the row from "invited" gets rows back, so only that pass
            // inserts the notification -- prevents a duplicate when the
            // webhook and the cron backstop race on the same row.
            const { data: flipped, error: flipError } = await supabase
              .from("fitment_interviews")
              .update({ status: "terminated", ib_interview_status: "TERMINATED" })
              .eq("id", row.id)
              .eq("status", "invited")
              .select("id");
            if (flipError) {
              // A genuine DB error here is distinct from losing the
              // conditional-update race (flipped simply comes back empty in
              // that case) -- surface it as an error instead of silently
              // treating it the same as "another sweep pass already won".
              console.error("Sweep: terminated-flip update failed", { row, error: flipError });
              result.errors += 1;
              return;
            }
            if (flipped && flipped.length > 0) {
              await supabase.from("hub_notifications").insert({
                user_id: row.user_id,
                message: `Your ${row.role_title} mock interview was interrupted. You can resume it from your dashboard whenever you're ready.`,
                category: "interview",
                created_by: "system",
              });
              result.terminated += 1;
            }
            return;
          }

          await supabase.from("fitment_interviews").update({ ib_interview_status: candidateStatus }).eq("id", row.id);
          if (candidateStatus === "APPEARED") {
            result.appeared += 1;
          }
        } catch (err) {
          console.error("Sweep: per-row check failed", { row, error: err });
          result.errors += 1;
        }
      })
    );
  }

  return result;
}
