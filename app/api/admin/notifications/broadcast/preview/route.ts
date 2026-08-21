import { requireAdmin } from "@/lib/adminAuth";
import { resolveBroadcastAudience, type FunnelStage } from "@/lib/adminCandidates";

const FUNNEL_STAGES: readonly FunnelStage[] = ["fitment_started", "report_unlocked", "interview_ready", "personality_completed", "reference_completed"];

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const funnelStages = url.searchParams
    .getAll("funnelStage")
    .filter((s): s is FunnelStage => (FUNNEL_STAGES as readonly string[]).includes(s));
  const roleTitles = url.searchParams.getAll("roleTitle");

  const [audience, allEligible] = await Promise.all([
    resolveBroadcastAudience({ funnelStages, roleTitles }),
    resolveBroadcastAudience({}),
  ]);

  const roleTitleOptions = Array.from(new Set(allEligible.map((c) => c.latestRoleTitle))).sort();

  return Response.json({ count: audience.length, roleTitleOptions });
}
