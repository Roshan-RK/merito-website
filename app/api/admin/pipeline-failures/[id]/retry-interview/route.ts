import { requireAdmin } from "@/lib/adminAuth";
import { retryInterviewFromFailure } from "@/lib/pipelineFailures";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const admin = await requireAdmin();
  const { id } = await params;

  try {
    await retryInterviewFromFailure(id, admin.email as string);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to retry interview.";
    return Response.json({ error: message }, { status: 409 });
  }

  return Response.json({ ok: true });
}
