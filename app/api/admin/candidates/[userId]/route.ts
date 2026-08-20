import { requireAdmin, assertRecentAuth, ReauthRequiredError } from "@/lib/adminAuth";
import { deleteCandidate } from "@/lib/adminCandidates";
import { enforceAdminRateLimit, RateLimitExceededError } from "@/lib/adminRateLimit";

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { userId } = await params;

  try {
    assertRecentAuth(admin);
    await enforceAdminRateLimit(admin.email as string, "candidate.soft_delete");
    await deleteCandidate(userId, admin.email as string);
  } catch (error) {
    if (error instanceof ReauthRequiredError) {
      return Response.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof RateLimitExceededError) {
      return Response.json({ error: error.message }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "Failed to delete candidate.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
