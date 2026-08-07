import crypto from "crypto";
import { getSupabaseServerClient } from "@/lib/supabase";
import { getInterviewReport } from "@/lib/intervuebox/interviewReports";

export const runtime = "nodejs";

function verifySignature(secret: string, rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => kv.split("=").map((s) => s.trim()))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject stale timestamps so a captured, validly-signed request can't be
  // replayed indefinitely — same 5-minute tolerance window Stripe and most
  // major webhook providers default to.
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const signatureBuf = Buffer.from(signature, "utf8");
  // timingSafeEqual throws on length mismatch instead of returning false —
  // guard explicitly so a malformed signature 401s instead of 500ing.
  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(request: Request) {
  const secret = process.env.INTERVUEBOX_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-ib-signature");
  if (!verifySignature(secret, rawBody, signatureHeader)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  // TEMP (remove after capturing a real payload): dump every validly-signed
  // delivery so a dashboard "Test" hit on any subscribed event reveals the
  // undocumented per-event JSON shape in the deploy logs.
  console.log("[intervuebox webhook] raw delivery", rawBody);

  // The webhook delivery body's per-event JSON shape isn't documented by
  // IntervueBox, so this handler doesn't parse it for identifiers at all.
  // Instead, any validly-signed hit re-checks every row we ourselves still
  // have as "invited" against the Reports API, using IDs captured at
  // invitation time (see specs/2026-07-17-intervuebox-integration-design.md,
  // Open Item #2).
  const supabase = getSupabaseServerClient();
  const { data: pending, error: pendingError } = await supabase
    .from("fitment_interviews")
    .select("id, user_id, role_title, ib_agent_id, ib_candidate_id")
    .eq("status", "invited");

  if (pendingError || !pending) {
    return Response.json({ received: true });
  }

  const concurrency = Number(process.env.WEBHOOK_SWEEP_CONCURRENCY) || 10;
  for (let i = 0; i < pending.length; i += concurrency) {
    const batch = pending.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (row) => {
        try {
          const report = await getInterviewReport(row.ib_agent_id, row.ib_candidate_id);
          if (report.status !== "READY") return;

          await supabase
            .from("fitment_interviews")
            .update({
              status: "ready",
              report_raw: {
                overallScore: report.overallScore,
                skillMetrics: report.skillMetrics,
                overallSummary: report.overallSummary,
                strengths: report.strengths,
                areasOfImprovement: report.areasOfImprovement,
                shareableReportLink: report.shareableReportLink,
                approxDurationMinutes: report.approxDurationMinutes,
                flagForSuspiciousActivity: report.flagForSuspiciousActivity,
                integrityCheck: report.integrityCheck,
                videoReport: report.videoReport,
                feedbackToInterviewer: report.feedbackToInterviewer,
                roadmap: report.roadmap,
                criteriaEvaluationTable: report.criteriaEvaluationTable,
                interviewTitle: report.interviewTitle,
                skillReport: report.skillReport,
                overallSkillScore: report.overallSkillScore,
                answers: report.answers,
                knowledgeAnswers: report.knowledgeAnswers,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        } catch (err) {
          console.error("Webhook sweep: getInterviewReport failed for a pending row", { row, error: err });
        }
      })
    );
  }

  return Response.json({ received: true });
}
