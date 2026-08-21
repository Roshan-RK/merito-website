import { requireAdmin } from "@/lib/adminAuth";
import { resolveBroadcastAudience, FUNNEL_STAGES, type FunnelStage } from "@/lib/adminCandidates";

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const funnelStages = url.searchParams
    .getAll("funnelStage")
    .filter((s): s is FunnelStage => (FUNNEL_STAGES as readonly string[]).includes(s));
  const roleTitles = url.searchParams.getAll("roleTitle");

  // resolveBroadcastAudience({}) already returns every eligible candidate --
  // stage/role filtering here is the same in-memory predicate
  // resolveBroadcastAudience itself applies, so a single call suffices
  // instead of re-running the 5 parallel queries + full listUsers sweep twice.
  const allEligible = await resolveBroadcastAudience({});

  const roleTitleOptions = Array.from(new Set(allEligible.map((c) => c.latestRoleTitle))).sort();

  const stageFilter = funnelStages.length > 0 ? new Set(funnelStages) : null;
  const roleFilter = roleTitles.length > 0 ? new Set(roleTitles) : null;
  const count = allEligible.filter((c) => {
    if (stageFilter && !stageFilter.has(c.funnelStage)) return false;
    if (roleFilter && !roleFilter.has(c.latestRoleTitle)) return false;
    return true;
  }).length;

  return Response.json({ count, roleTitleOptions });
}
