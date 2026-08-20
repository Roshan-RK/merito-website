import { requireAdmin } from "@/lib/adminAuth";
import { retryResumeMatch } from "@/lib/adminCandidates";

type RouteContext = { params: Promise<{ leadId: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { leadId } = await params;

  try {
    await retryResumeMatch(leadId, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retry resume match.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
