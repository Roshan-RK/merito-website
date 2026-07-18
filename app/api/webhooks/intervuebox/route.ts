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

  // The webhook delivery body's per-event JSON shape isn't documented by
  // IntervueBox, so this handler doesn't parse it for identifiers at all.
  // Instead, any validly-signed hit re-checks every row we ourselves still
  // have as "invited" against the Reports API, using IDs captured at
  // invitation time (see specs/2026-07-17-intervuebox-integration-design.md,
  // Open Item #2).
  const supabase = getSupabaseServerClient();
  const { data: pending, error: pendingError } = await supabase
    .from("fitment_interviews")
    .select("user_id, role_title, ib_agent_id, ib_candidate_id")
    .eq("status", "invited");

  if (pendingError || !pending) {
    return Response.json({ received: true });
  }

  for (const row of pending) {
    try {
      const report = await getInterviewReport(row.ib_agent_id, row.ib_candidate_id);
      if (report.status !== "READY") continue;

      await supabase
        .from("fitment_interviews")
        .update({
          status: "ready",
          report_raw: {
            overallSkillScore: report.overallSkillScore,
            skillReport: report.skillReport,
            overallReport: report.overallReport,
            shareableReportLink: report.shareableReportLink,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id)
        .eq("role_title", row.role_title);
    } catch (err) {
      console.error("Webhook sweep: getInterviewReport failed for a pending row", { row, error: err });
    }
  }

  return Response.json({ received: true });
}
