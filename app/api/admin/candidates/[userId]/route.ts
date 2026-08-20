import { requireAdmin } from "@/lib/adminAuth";
import { deleteCandidate } from "@/lib/adminCandidates";

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { userId } = await params;

  try {
    await deleteCandidate(userId, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete candidate.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
