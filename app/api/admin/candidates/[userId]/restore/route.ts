import { requireAdmin } from "@/lib/adminAuth";
import { restoreCandidate } from "@/lib/adminCandidates";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { userId } = await params;

  try {
    await restoreCandidate(userId, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to restore candidate.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
